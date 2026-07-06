package admin

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"strconv"
	"strings"

	"github.com/go-playground/validator/v10"
)

var validate = newValidator()

func newValidator() *validator.Validate {
	v := validator.New()
	// Report validation errors by JSON field name so the frontend can attach
	// them to the right form inputs.
	v.RegisterTagNameFunc(func(fld reflect.StructField) string {
		name := strings.Split(fld.Tag.Get("json"), ",")[0]
		if name == "-" || name == "" {
			return fld.Name
		}
		return name
	})
	return v
}

// ResourceConfig configures a generic struct-backed CRUD resource for model M.
type ResourceConfig[M any] struct {
	// ID is the URL slug of the resource (e.g. "posts").
	ID          string
	Name        string
	Description string
	// Icon is a lucide icon name shown in the sidebar.
	Icon string
	// DataSource provides persistence; see datasource/gormds and datasource/memory.
	DataSource DataSource[M]
	// CreateForm / EditForm are DTO prototypes reflected into the create/edit
	// form schemas (jsonschema + uischema + validate tags). When nil, M is used.
	CreateForm any
	EditForm   any
	// Actions enables operations; defaults to view/create/edit/delete/search.
	Actions []ActionType
	// ExcludeColumns removes JSON field names from the list view.
	ExcludeColumns []string
	// LinkPattern maps column JSON names to link templates.
	LinkPattern map[string]string
	// IDField is the JSON name of the primary key (default "id").
	IDField string
	// Authorize gates every action when set; return ErrForbidden to deny.
	Authorize func(ctx context.Context, identity Identity, action ActionType) error
	// DefaultLimit is the list page size (default 20).
	DefaultLimit int
}

type crudResource[M any] struct {
	cfg       ResourceConfig[M]
	overrides *resourceOverrides
	actions   map[ActionType]bool
}

// NewResource builds a Resource with generic CRUD behavior for model M:
// list view reflected from M's table tags, create/edit forms reflected from
// the DTOs' jsonschema/uischema tags, and actions executed via the DataSource.
func NewResource[M any](cfg ResourceConfig[M], opts ...ResourceOption) Resource {
	if cfg.ID == "" {
		panic("admin: ResourceConfig.ID is required")
	}
	if cfg.DataSource == nil {
		panic(fmt.Sprintf("admin: resource %q has no DataSource", cfg.ID))
	}
	if cfg.Name == "" {
		cfg.Name = humanizeFieldName(strings.ToUpper(cfg.ID[:1]) + cfg.ID[1:])
	}
	if cfg.IDField == "" {
		cfg.IDField = "id"
	}
	if cfg.DefaultLimit <= 0 {
		cfg.DefaultLimit = 20
	}
	if len(cfg.Actions) == 0 {
		cfg.Actions = []ActionType{ActionView, ActionCreate, ActionEdit, ActionDelete, ActionSearch}
	}
	overrides := newResourceOverrides()
	for _, opt := range opts {
		opt(overrides)
	}
	actions := make(map[ActionType]bool, len(cfg.Actions))
	for _, a := range cfg.Actions {
		actions[a] = true
	}
	// Fail fast on bad table tags / valuefrom templates.
	var m M
	if _, err := ModelToTableColumns(&m, nil); err != nil {
		panic(fmt.Sprintf("admin: resource %q: %v", cfg.ID, err))
	}
	return &crudResource[M]{cfg: cfg, overrides: overrides, actions: actions}
}

func (r *crudResource[M]) ID() string { return r.cfg.ID }

func (r *crudResource[M]) actionURL(req Request, action ActionType, dynamicPath string) string {
	u := req.BasePath + "/resources/" + r.cfg.ID + "/action?action=" + string(action)
	if dynamicPath != "" {
		u += "&dynamicPath=" + url.QueryEscape(dynamicPath)
	}
	return u
}

func (r *crudResource[M]) Info(ctx context.Context, req Request) ResourceInfo {
	supported := make([]ActionButton, 0, 2)
	if r.actions[ActionCreate] {
		supported = append(supported, ActionButton{
			Type: ButtonPrimary, Label: "Create", Icon: "plus",
			Behavior: BehaviorOpenSheet, ActionType: ActionCreate,
			OnClick: r.actionURL(req, ActionCreate, ""),
		})
	}
	supported = append(supported, r.overrides.tableActions...)
	return ResourceInfo{
		ID:               r.cfg.ID,
		Name:             r.cfg.Name,
		Description:      r.cfg.Description,
		Icon:             r.cfg.Icon,
		Type:             ResourceTable,
		DataURL:          r.actionURL(req, ActionView, ""),
		DefaultAction:    ActionView,
		SupportedActions: supported,
	}
}

func (r *crudResource[M]) authorize(ctx context.Context, req Request, action ActionType) error {
	if !r.actions[action] {
		return fmt.Errorf("%w: action %q not supported by resource %q", ErrBadInput, action, r.cfg.ID)
	}
	if r.cfg.Authorize != nil {
		return r.cfg.Authorize(ctx, req.Identity, action)
	}
	return nil
}

func (r *crudResource[M]) Schema(ctx context.Context, req Request, action ActionType) (any, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	switch action {
	case ActionView:
		return r.tableSchema()
	case ActionCreate, ActionEdit:
		return r.formSchema(req, action)
	default:
		return nil, fmt.Errorf("%w: no schema for action %q", ErrBadInput, action)
	}
}

func (r *crudResource[M]) tableSchema() (*TableSchema, error) {
	var m M
	columns, err := ModelToTableColumns(&m, &TableColumnOptions{
		ExcludeFields: r.cfg.ExcludeColumns,
		LinkPattern:   r.cfg.LinkPattern,
	})
	if err != nil {
		return nil, err
	}
	filtered := columns[:0]
	for i := range columns {
		if b, ok := r.overrides.columns[columns[i].Name]; ok {
			if b.omit {
				continue
			}
			b.apply(&columns[i])
		}
		filtered = append(filtered, columns[i])
	}
	return &TableSchema{UIType: "table", Type: ActionView, Columns: filtered}, nil
}

func (r *crudResource[M]) formModel(action ActionType) any {
	var form any
	if action == ActionCreate {
		form = r.cfg.CreateForm
	} else {
		form = r.cfg.EditForm
	}
	if form == nil {
		var m M
		form = &m
	}
	return form
}

func (r *crudResource[M]) formSchema(req Request, action ActionType) (*FormSchema, error) {
	form := r.formModel(action)
	schema := reflectSchema(form)
	uiSchema, err := ModelToUISchema(form)
	if err != nil {
		return nil, err
	}
	fieldOverrides := make(UISchema, len(r.overrides.fields))
	for name, b := range r.overrides.fields {
		fieldOverrides[name] = b.toUISchema()
	}
	uiSchema = MergeUISchema(uiSchema, fieldOverrides)

	label := "Create"
	if action == ActionEdit {
		label = "Save"
	}
	return &FormSchema{
		UIType:   "form",
		Type:     action,
		Schema:   schema,
		UISchema: uiSchema,
		SupportedActions: []ActionButton{{
			Type: ButtonPrimary, Label: label, Icon: "check",
			Behavior: BehaviorSubmit, ActionType: action,
			OnClick: r.actionURL(req, action, req.DynamicPath),
		}},
	}, nil
}

func (r *crudResource[M]) Fetch(ctx context.Context, req Request, action ActionType, formData map[string]any) (*ActionResponse, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	switch action {
	case ActionView:
		return r.list(ctx, req)
	case ActionEdit:
		id := r.idFrom(req, formData)
		if id == "" {
			return nil, fmt.Errorf("%w: missing id for edit", ErrBadInput)
		}
		item, err := r.cfg.DataSource.Get(ctx, id)
		if err != nil {
			return nil, err
		}
		data, err := toMap(item)
		if err != nil {
			return nil, err
		}
		return Detail(data), nil
	case ActionSearch:
		query := req.Query.Get("query")
		if query == "" && formData != nil {
			if q, ok := formData["query"].(string); ok {
				query = q
			}
		}
		items, err := r.cfg.DataSource.Search(ctx, query, r.cfg.DefaultLimit)
		if err != nil {
			return nil, err
		}
		return SearchResults(items), nil
	default:
		return nil, fmt.Errorf("%w: cannot fetch action %q", ErrBadInput, action)
	}
}

func (r *crudResource[M]) list(ctx context.Context, req Request) (*ActionResponse, error) {
	limit := r.cfg.DefaultLimit
	if l, err := strconv.Atoi(req.Query.Get("limit")); err == nil && l > 0 {
		limit = l
	}
	page, err := r.cfg.DataSource.List(ctx, ListParams{After: req.Query.Get("after"), Limit: limit})
	if err != nil {
		return nil, err
	}

	items := make([]Item, 0, len(page.Items))
	for i := range page.Items {
		data, err := toMap(page.Items[i])
		if err != nil {
			return nil, err
		}
		rowID := stringifyID(data[r.cfg.IDField])
		var rowActions []ActionButton
		if r.actions[ActionEdit] && rowID != "" {
			rowActions = append(rowActions, ActionButton{
				Type: ButtonSecondary, Label: "Edit", Icon: "pencil",
				Behavior: BehaviorOpenSheet, ActionType: ActionEdit,
				OnClick: r.actionURL(req, ActionEdit, rowID),
			})
		}
		if r.actions[ActionDelete] && rowID != "" {
			rowActions = append(rowActions, ActionButton{
				Type: ButtonDanger, Label: "Delete", Icon: "trash",
				Behavior: BehaviorConfirmDialog, ActionType: ActionDelete,
				OnClick: r.actionURL(req, ActionDelete, rowID),
			})
		}
		items = append(items, Item{Data: data, Actions: rowActions})
	}

	var nextURL, prevURL *string
	if page.NextCursor != "" {
		u := r.actionURL(req, ActionView, "") + "&after=" + url.QueryEscape(page.NextCursor) + "&limit=" + strconv.Itoa(limit)
		nextURL = &u
	}
	if page.PrevCursor != "" {
		u := r.actionURL(req, ActionView, "") + "&after=" + url.QueryEscape(page.PrevCursor) + "&limit=" + strconv.Itoa(limit)
		prevURL = &u
	}
	info := r.Info(ctx, req)
	return Paginated(items, info.SupportedActions, nextURL, prevURL), nil
}

func (r *crudResource[M]) Act(ctx context.Context, req Request, action ActionType, data map[string]any) (*ActionResponse, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	switch action {
	case ActionCreate:
		return r.create(ctx, data)
	case ActionEdit:
		return r.update(ctx, req, data)
	case ActionDelete:
		id := r.idFrom(req, data)
		if id == "" {
			return nil, fmt.Errorf("%w: missing id for delete", ErrBadInput)
		}
		if err := r.cfg.DataSource.Delete(ctx, id); err != nil {
			return nil, err
		}
		return Detail(map[string]any{"deleted": true, "id": id}), nil
	case ActionSearch:
		query, _ := data["query"].(string)
		items, err := r.cfg.DataSource.Search(ctx, query, r.cfg.DefaultLimit)
		if err != nil {
			return nil, err
		}
		return SearchResults(items), nil
	default:
		return nil, fmt.Errorf("%w: cannot execute action %q", ErrBadInput, action)
	}
}

func (r *crudResource[M]) create(ctx context.Context, data map[string]any) (*ActionResponse, error) {
	dto, err := r.bindForm(ActionCreate, data)
	if err != nil {
		return nil, err
	}
	var item M
	if err := convertVia(dto, &item); err != nil {
		return nil, err
	}
	if err := r.cfg.DataSource.Create(ctx, &item); err != nil {
		return nil, err
	}
	out, err := toMap(item)
	if err != nil {
		return nil, err
	}
	return Detail(out), nil
}

func (r *crudResource[M]) update(ctx context.Context, req Request, data map[string]any) (*ActionResponse, error) {
	id := r.idFrom(req, data)
	if id == "" {
		return nil, fmt.Errorf("%w: missing id for edit", ErrBadInput)
	}
	dto, err := r.bindForm(ActionEdit, data)
	if err != nil {
		return nil, err
	}
	patch := make(map[string]any)
	if err := convertVia(dto, &patch); err != nil {
		return nil, err
	}
	delete(patch, r.cfg.IDField)
	item, err := r.cfg.DataSource.Update(ctx, id, patch)
	if err != nil {
		return nil, err
	}
	out, err := toMap(item)
	if err != nil {
		return nil, err
	}
	return Detail(out), nil
}

// bindForm converts raw action data into a typed DTO and validates it.
func (r *crudResource[M]) bindForm(action ActionType, data map[string]any) (any, error) {
	proto := r.formModel(action)
	t := reflect.TypeOf(proto)
	for t.Kind() == reflect.Ptr {
		t = t.Elem()
	}
	dto := reflect.New(t).Interface()
	if err := convertVia(data, dto); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrBadInput, err)
	}
	if err := validate.Struct(dto); err != nil {
		var verrs validator.ValidationErrors
		if errors.As(err, &verrs) {
			fields := make(map[string]string, len(verrs))
			for _, fe := range verrs {
				fields[fe.Field()] = fe.Tag()
			}
			return nil, &ValidationError{Fields: fields}
		}
		return nil, err
	}
	return dto, nil
}

func (r *crudResource[M]) idFrom(req Request, data map[string]any) string {
	if id := strings.TrimPrefix(req.DynamicPath, "/"); id != "" {
		return id
	}
	if data != nil {
		return stringifyID(data[r.cfg.IDField])
	}
	return ""
}

// toMap converts any value to a JSON object map.
func toMap(v any) (map[string]any, error) {
	var out map[string]any
	if err := convertVia(v, &out); err != nil {
		return nil, err
	}
	return out, nil
}

// convertVia converts between arbitrary shapes through a JSON round-trip.
func convertVia(from, to any) error {
	b, err := json.Marshal(from)
	if err != nil {
		return err
	}
	return json.Unmarshal(b, to)
}

func stringifyID(v any) string {
	switch id := v.(type) {
	case nil:
		return ""
	case string:
		return id
	case float64:
		// JSON numbers decode as float64; render integers without decimals.
		if id == float64(int64(id)) {
			return strconv.FormatInt(int64(id), 10)
		}
		return strconv.FormatFloat(id, 'f', -1, 64)
	default:
		return fmt.Sprintf("%v", id)
	}
}
