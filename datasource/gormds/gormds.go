// Package gormds adapts a gorm.DB to admin.DataSource.
package gormds

import (
	"context"
	"errors"
	"fmt"
	"reflect"
	"strconv"
	"strings"
	"sync"

	"github.com/rxtech-lab/admin-generator/admin"
	"gorm.io/gorm"
	"gorm.io/gorm/schema"
)

// DataSource is a GORM-backed admin.DataSource for model T. Pagination is
// offset-based behind opaque cursors, ordered by the primary key.
type DataSource[T any] struct {
	db           *gorm.DB
	searchFields []string // JSON names searched with LIKE
	titleField   string   // JSON name used as search result title
	preloads     []string // gorm association names to eager-load
	order        string   // ORDER BY clause for List (default: primary key asc)
	parseOnce    sync.Once
	parseErr     error
	pkColumn     string
	jsonToColumn map[string]string
	columnToJSON map[string]string
	jsonToField  map[string]string // JSON name -> Go struct field name
}

type Option[T any] func(*DataSource[T])

// WithPreloads eager-loads the named gorm associations on List and Get, so
// related fields referenced by valuefrom column templates (e.g.
// "{{.Author.Name}}") are populated.
func WithPreloads[T any](associations ...string) Option[T] {
	return func(d *DataSource[T]) { d.preloads = append(d.preloads, associations...) }
}

// WithSearchFields sets the JSON field names Search matches with LIKE. The
// first one doubles as the result title unless WithTitleField overrides it.
func WithSearchFields[T any](fields ...string) Option[T] {
	return func(d *DataSource[T]) { d.searchFields = fields }
}

// WithTitleField sets the JSON field used as the search result title.
func WithTitleField[T any](field string) Option[T] {
	return func(d *DataSource[T]) { d.titleField = field }
}

// WithOrder sets the ORDER BY clause used by List, e.g. "created_at DESC" for a
// newest-first admin table. Defaults to the primary key ascending. Use raw
// column names (not JSON names).
func WithOrder[T any](clause string) Option[T] {
	return func(d *DataSource[T]) { d.order = clause }
}

func New[T any](db *gorm.DB, opts ...Option[T]) *DataSource[T] {
	d := &DataSource[T]{db: db}
	for _, opt := range opts {
		opt(d)
	}
	return d
}

// parseSchema builds JSON-name <-> column/field mappings from the gorm schema.
func (d *DataSource[T]) parseSchema() error {
	d.parseOnce.Do(func() {
		var model T
		s, err := schema.Parse(&model, &sync.Map{}, d.db.NamingStrategy)
		if err != nil {
			d.parseErr = err
			return
		}
		d.jsonToColumn = make(map[string]string)
		d.columnToJSON = make(map[string]string)
		d.jsonToField = make(map[string]string)
		for _, f := range s.Fields {
			jsonName := strings.Split(f.StructField.Tag.Get("json"), ",")[0]
			if jsonName == "" || jsonName == "-" {
				continue
			}
			d.jsonToColumn[jsonName] = f.DBName
			d.columnToJSON[f.DBName] = jsonName
			d.jsonToField[jsonName] = f.Name
		}
		if len(s.PrimaryFields) > 0 {
			d.pkColumn = s.PrimaryFields[0].DBName
		} else {
			d.pkColumn = "id"
		}
	})
	return d.parseErr
}

// withPreloads applies the configured eager-load associations to a query.
func (d *DataSource[T]) withPreloads(q *gorm.DB) *gorm.DB {
	for _, assoc := range d.preloads {
		q = q.Preload(assoc)
	}
	return q
}

func (d *DataSource[T]) List(ctx context.Context, p admin.ListParams) (admin.Page[T], error) {
	page := admin.Page[T]{}
	if err := d.parseSchema(); err != nil {
		return page, err
	}
	limit := p.Limit
	if limit <= 0 {
		limit = 20
	}
	offset := 0
	if p.After != "" {
		if o, err := strconv.Atoi(p.After); err == nil && o > 0 {
			offset = o
		}
	}

	orderBy := d.order
	if orderBy == "" {
		orderBy = d.pkColumn
	}
	q := d.withPreloads(d.db.WithContext(ctx)).Order(orderBy)
	for field, value := range p.Filters {
		if col, ok := d.jsonToColumn[field]; ok {
			q = q.Where(fmt.Sprintf("%s = ?", col), value)
		}
	}
	// Fetch one extra row to detect whether a next page exists.
	var items []T
	if err := q.Limit(limit + 1).Offset(offset).Find(&items).Error; err != nil {
		return page, err
	}
	if len(items) > limit {
		page.Items = items[:limit]
		page.NextCursor = strconv.Itoa(offset + limit)
	} else {
		page.Items = items
	}
	if offset > 0 {
		prev := offset - limit
		if prev < 0 {
			prev = 0
		}
		page.PrevCursor = strconv.Itoa(prev)
	}
	return page, nil
}

func (d *DataSource[T]) Get(ctx context.Context, id string) (T, error) {
	var item T
	if err := d.parseSchema(); err != nil {
		return item, err
	}
	err := d.withPreloads(d.db.WithContext(ctx)).First(&item, fmt.Sprintf("%s = ?", d.pkColumn), id).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return item, fmt.Errorf("%w: %s", admin.ErrNotFound, id)
	}
	return item, err
}

func (d *DataSource[T]) Create(ctx context.Context, item *T) error {
	return d.db.WithContext(ctx).Create(item).Error
}

func (d *DataSource[T]) Update(ctx context.Context, id string, patch map[string]any) (T, error) {
	var zero T
	if err := d.parseSchema(); err != nil {
		return zero, err
	}
	// Translate JSON field names to column names; unknown keys are dropped so
	// clients cannot write columns that aren't exposed on the model.
	columnPatch := make(map[string]any, len(patch))
	for k, v := range patch {
		if col, ok := d.jsonToColumn[k]; ok && col != d.pkColumn {
			columnPatch[col] = v
		}
	}
	if len(columnPatch) > 0 {
		var model T
		res := d.db.WithContext(ctx).Model(&model).
			Where(fmt.Sprintf("%s = ?", d.pkColumn), id).
			Updates(columnPatch)
		if res.Error != nil {
			return zero, res.Error
		}
		if res.RowsAffected == 0 {
			return zero, fmt.Errorf("%w: %s", admin.ErrNotFound, id)
		}
	}
	return d.Get(ctx, id)
}

func (d *DataSource[T]) Delete(ctx context.Context, id string) error {
	if err := d.parseSchema(); err != nil {
		return err
	}
	var model T
	res := d.db.WithContext(ctx).Where(fmt.Sprintf("%s = ?", d.pkColumn), id).Delete(&model)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return fmt.Errorf("%w: %s", admin.ErrNotFound, id)
	}
	return nil
}

func (d *DataSource[T]) Search(ctx context.Context, query string, limit int) ([]admin.SearchItem, error) {
	if err := d.parseSchema(); err != nil {
		return nil, err
	}
	if len(d.searchFields) == 0 {
		return []admin.SearchItem{}, nil
	}
	if limit <= 0 {
		limit = 20
	}

	q := d.db.WithContext(ctx).Order(d.pkColumn).Limit(limit)
	if query != "" {
		var conds []string
		var args []any
		for _, f := range d.searchFields {
			if col, ok := d.jsonToColumn[f]; ok {
				conds = append(conds, fmt.Sprintf("%s LIKE ?", col))
				args = append(args, "%"+query+"%")
			}
		}
		if len(conds) > 0 {
			q = q.Where(strings.Join(conds, " OR "), args...)
		}
	}
	var items []T
	if err := q.Find(&items).Error; err != nil {
		return nil, err
	}

	titleField := d.titleField
	if titleField == "" {
		titleField = d.searchFields[0]
	}
	results := make([]admin.SearchItem, 0, len(items))
	for i := range items {
		v, err := d.reflectValues(&items[i], titleField)
		if err != nil {
			return nil, err
		}
		results = append(results, v)
	}
	return results, nil
}

// reflectValues extracts the title and primary key of one item using the
// JSON-name -> struct-field mapping built by parseSchema.
func (d *DataSource[T]) reflectValues(item *T, titleField string) (admin.SearchItem, error) {
	rv := reflect.ValueOf(item).Elem()
	pkJSON := d.columnToJSON[d.pkColumn]

	fieldString := func(jsonName string) string {
		goName, ok := d.jsonToField[jsonName]
		if !ok {
			return ""
		}
		fv := rv.FieldByName(goName)
		if !fv.IsValid() {
			return ""
		}
		if fv.Kind() == reflect.Pointer {
			if fv.IsNil() {
				return ""
			}
			fv = fv.Elem()
		}
		return fmt.Sprintf("%v", fv.Interface())
	}

	return admin.SearchItem{
		Title: fieldString(titleField),
		Value: fieldString(pkJSON),
	}, nil
}
