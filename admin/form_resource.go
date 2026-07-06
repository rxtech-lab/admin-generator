package admin

import (
	"context"
	"fmt"
	"net/url"
	"strings"
)

// FormResourceConfig configures a form-only / custom-action resource.
//
// Where NewResource gives you generic CRUD backed by a DataSource, a form
// resource lets the host serve a dynamic JSON Schema and own the read/write
// handlers itself. The frontend renders the schema with react-jsonschema-form,
// prefills it from Fetch, and posts the submitted values back to Act. Use it
// for settings pages, single-record configuration, or bespoke actions such as
// "top up a user's balance".
//
// Frontend interaction contract (important):
//
//   - The admin UI requests the resource's schema for the "view" action, so
//     Schema is invoked with action == ActionView. Return a *FormSchema whose
//     Type is ActionEdit — that makes the UI render the form inline, prefill it
//     via Fetch(ActionEdit), and submit it via Act(ActionEdit).
//   - Fetch is therefore called with ActionEdit to load the current values
//     (return a Detail response). It is optional; when nil an empty record is
//     returned so the form renders blank.
//   - Act is called with ActionEdit carrying the submitted form values.
type FormResourceConfig struct {
	// ID is the URL slug of the resource (e.g. "app-config").
	ID          string
	Name        string
	Description string
	// Icon is a lucide icon name shown in the sidebar.
	Icon string
	// Authorize gates every action when set; return ErrForbidden to deny.
	Authorize func(ctx context.Context, identity Identity, action ActionType) error
	// Schema returns the *FormSchema for an action. Set FormSchema.Type to
	// ActionEdit (see the contract above). Required.
	Schema func(ctx context.Context, req Request, action ActionType) (*FormSchema, error)
	// Fetch returns the current record for prefill as a Detail response.
	// Optional; defaults to an empty record.
	Fetch func(ctx context.Context, req Request, action ActionType, formData map[string]any) (*ActionResponse, error)
	// Act handles the submit. Required.
	Act func(ctx context.Context, req Request, action ActionType, data map[string]any) (*ActionResponse, error)
}

type formResource struct{ cfg FormResourceConfig }

// NewFormResource builds a form-only Resource from handler closures. It
// implements the admin.Resource interface directly, so the host controls the
// JSON Schema (including values computed at request time, e.g. enums populated
// from a live catalog) and both the read and write handlers.
func NewFormResource(cfg FormResourceConfig) Resource {
	if cfg.ID == "" {
		panic("admin: FormResourceConfig.ID is required")
	}
	if cfg.Schema == nil {
		panic(fmt.Sprintf("admin: form resource %q has no Schema func", cfg.ID))
	}
	if cfg.Act == nil {
		panic(fmt.Sprintf("admin: form resource %q has no Act func", cfg.ID))
	}
	if cfg.Name == "" {
		cfg.Name = humanizeFieldName(strings.ToUpper(cfg.ID[:1]) + cfg.ID[1:])
	}
	return &formResource{cfg: cfg}
}

func (r *formResource) ID() string { return r.cfg.ID }

func (r *formResource) actionURL(req Request, action ActionType, dynamicPath string) string {
	u := req.BasePath + "/resources/" + r.cfg.ID + "/action?action=" + string(action)
	if dynamicPath != "" {
		u += "&dynamicPath=" + url.QueryEscape(dynamicPath)
	}
	return u
}

func (r *formResource) authorize(ctx context.Context, req Request, action ActionType) error {
	if r.cfg.Authorize != nil {
		return r.cfg.Authorize(ctx, req.Identity, action)
	}
	return nil
}

func (r *formResource) Info(ctx context.Context, req Request) ResourceInfo {
	return ResourceInfo{
		ID:            r.cfg.ID,
		Name:          r.cfg.Name,
		Description:   r.cfg.Description,
		Icon:          r.cfg.Icon,
		Type:          ResourceForm,
		DataURL:       r.actionURL(req, ActionView, ""),
		DefaultAction: ActionView,
	}
}

func (r *formResource) Schema(ctx context.Context, req Request, action ActionType) (any, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	return r.cfg.Schema(ctx, req, action)
}

func (r *formResource) Fetch(ctx context.Context, req Request, action ActionType, formData map[string]any) (*ActionResponse, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	if r.cfg.Fetch != nil {
		return r.cfg.Fetch(ctx, req, action, formData)
	}
	return Detail(map[string]any{}), nil
}

func (r *formResource) Act(ctx context.Context, req Request, action ActionType, data map[string]any) (*ActionResponse, error) {
	if err := r.authorize(ctx, req, action); err != nil {
		return nil, err
	}
	return r.cfg.Act(ctx, req, action, data)
}

// FormSchemaFromModel reflects a struct's jsonschema/uischema tags into a
// *FormSchema for the given action. The host may mutate the returned Schema
// before serving it — e.g. set an Enum on a property from a live catalog:
//
//	fs, _ := admin.FormSchemaFromModel(cfg, admin.ActionEdit, "Save", url)
//	if p, ok := fs.Schema.Properties.Get("default_host_model"); ok {
//	    p.Enum = modelIDs
//	}
func FormSchemaFromModel(model any, action ActionType, submitLabel, onClick string) (*FormSchema, error) {
	schema := reflectSchema(model)
	ui, err := ModelToUISchema(model)
	if err != nil {
		return nil, err
	}
	return &FormSchema{
		UIType:           "form",
		Type:             action,
		Schema:           schema,
		UISchema:         ui,
		SupportedActions: []ActionButton{SubmitButton(submitLabel, action, onClick)},
	}, nil
}

// SubmitButton is a convenience for building the submit ActionButton a
// FormSchema advertises. label defaults to "Save" when empty.
func SubmitButton(label string, action ActionType, onClick string) ActionButton {
	if label == "" {
		label = "Save"
	}
	return ActionButton{
		Type:       ButtonPrimary,
		Label:      label,
		Icon:       "check",
		Behavior:   BehaviorSubmit,
		ActionType: action,
		OnClick:    onClick,
	}
}
