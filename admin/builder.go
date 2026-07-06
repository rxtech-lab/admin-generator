package admin

// ResourceOption customizes the schemas a generic CRUD resource reflects from
// its structs — override a column's rendering, attach a widget to a form
// field, or add extra action buttons.
type ResourceOption func(*resourceOverrides)

type resourceOverrides struct {
	columns      map[string]*ColumnBuilder
	fields       map[string]*FieldBuilder
	tableActions []ActionButton
}

func newResourceOverrides() *resourceOverrides {
	return &resourceOverrides{
		columns: make(map[string]*ColumnBuilder),
		fields:  make(map[string]*FieldBuilder),
	}
}

// WithColumn overrides the reflected table column with the given JSON name.
func WithColumn(name string, b *ColumnBuilder) ResourceOption {
	return func(o *resourceOverrides) { o.columns[name] = b }
}

// WithField overrides the reflected form uiSchema entry for the given JSON name.
func WithField(name string, b *FieldBuilder) ResourceOption {
	return func(o *resourceOverrides) { o.fields[name] = b }
}

// WithTableAction adds an extra action button to the list view.
func WithTableAction(button ActionButton) ResourceOption {
	return func(o *resourceOverrides) { o.tableActions = append(o.tableActions, button) }
}

// ColumnBuilder is a fluent override for a table column.
type ColumnBuilder struct {
	format    *string
	width     *int
	pinned    *bool
	label     *string
	valueFrom *string
	link      *string
	omit      bool
}

func Column() *ColumnBuilder { return &ColumnBuilder{} }

func (b *ColumnBuilder) Format(f string) *ColumnBuilder    { b.format = &f; return b }
func (b *ColumnBuilder) Width(w int) *ColumnBuilder        { b.width = &w; return b }
func (b *ColumnBuilder) Pinned() *ColumnBuilder            { p := true; b.pinned = &p; return b }
func (b *ColumnBuilder) Label(l string) *ColumnBuilder     { b.label = &l; return b }
func (b *ColumnBuilder) ValueFrom(v string) *ColumnBuilder { b.valueFrom = &v; return b }
func (b *ColumnBuilder) Link(l string) *ColumnBuilder      { b.link = &l; return b }
func (b *ColumnBuilder) Omit() *ColumnBuilder              { b.omit = true; return b }

func (b *ColumnBuilder) apply(col *TableColumn) {
	if b.format != nil {
		col.Format = *b.format
	}
	if b.width != nil {
		col.Width = *b.width
	}
	if b.pinned != nil {
		col.Pinned = *b.pinned
	}
	if b.label != nil {
		col.Label = *b.label
	}
	if b.valueFrom != nil {
		col.ValueFrom = *b.valueFrom
	}
	if b.link != nil {
		col.Link = *b.link
	}
}

// FieldBuilder is a fluent override for a form field's uiSchema entry.
type FieldBuilder struct {
	widget   string
	options  map[string]any
	help     string
	disabled bool
	readonly bool
}

func Field() *FieldBuilder { return &FieldBuilder{options: make(map[string]any)} }

func (b *FieldBuilder) Widget(w string) *FieldBuilder { b.widget = w; return b }
func (b *FieldBuilder) Option(key string, value any) *FieldBuilder {
	b.options[key] = value
	return b
}
func (b *FieldBuilder) Help(h string) *FieldBuilder { b.help = h; return b }
func (b *FieldBuilder) Disabled() *FieldBuilder     { b.disabled = true; return b }
func (b *FieldBuilder) Readonly() *FieldBuilder     { b.readonly = true; return b }

func (b *FieldBuilder) toUISchema() map[string]any {
	m := make(map[string]any)
	if b.widget != "" {
		m["ui:widget"] = b.widget
	}
	if len(b.options) > 0 {
		m["ui:options"] = b.options
	}
	if b.help != "" {
		m["ui:help"] = b.help
	}
	if b.disabled {
		m["ui:disabled"] = true
	}
	if b.readonly {
		m["ui:readonly"] = true
	}
	return m
}
