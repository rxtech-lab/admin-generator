// Package admin provides a schema-driven admin resource framework.
//
// Register Go structs as admin resources and the package serves a JSON
// description of tables (columns) and forms (JSON Schema + react-jsonschema-form
// uiSchema) that a frontend can render generically, plus generic CRUD actions
// backed by a pluggable DataSource.
package admin

import (
	"encoding/json"

	"github.com/invopop/jsonschema"
)

// ActionType identifies an operation on a resource.
type ActionType string

const (
	ActionView   ActionType = "view"
	ActionEdit   ActionType = "edit"
	ActionDelete ActionType = "delete"
	ActionCreate ActionType = "create"
	ActionSearch ActionType = "search"
	ActionExport ActionType = "export"
)

// ResourceType describes the default presentation of a resource.
type ResourceType string

const (
	ResourceTable  ResourceType = "table"
	ResourceDetail ResourceType = "detail"
	ResourceForm   ResourceType = "form"
	ResourceCustom ResourceType = "custom"
)

// ButtonType is the visual style of an action button.
type ButtonType string

const (
	ButtonPrimary   ButtonType = "primary"
	ButtonSecondary ButtonType = "secondary"
	ButtonDanger    ButtonType = "danger"
	ButtonWarning   ButtonType = "warning"
	ButtonInfo      ButtonType = "info"
	ButtonSuccess   ButtonType = "success"
)

// Behavior tells the frontend how to execute an action button.
type Behavior string

const (
	BehaviorNavigate      Behavior = "navigate"
	BehaviorSubmit        Behavior = "submit"
	BehaviorOpenSheet     Behavior = "openSheet"
	BehaviorOpenDialog    Behavior = "openDialog"
	BehaviorConfirmDialog Behavior = "confirmDialog"
)

// ActionButton describes a button the frontend renders for a resource or row.
type ActionButton struct {
	Type       ButtonType `json:"type"`
	Label      string     `json:"label"`
	Icon       string     `json:"icon"` // lucide icon name
	Behavior   Behavior   `json:"behavior"`
	ActionType ActionType `json:"actionType"`
	// OnClick is the URL the button targets. For openSheet/confirmDialog rows it
	// carries action & dynamicPath query params the frontend replays.
	OnClick string `json:"onClick"`
}

// ResourceInfo is the metadata for one admin resource, used to build navigation.
type ResourceInfo struct {
	ID               string         `json:"id"`
	Name             string         `json:"name"`
	Description      string         `json:"description"`
	Icon             string         `json:"icon"` // lucide icon name
	Type             ResourceType   `json:"type"`
	DataURL          string         `json:"dataUrl"`
	DefaultAction    ActionType     `json:"defaultAction"`
	SupportedActions []ActionButton `json:"supportedActions"`
}

// TableColumn describes one column of a resource list view.
type TableColumn struct {
	Name   string `json:"name"`
	Label  string `json:"label"`
	Type   string `json:"type"` // string|number|boolean|object|array
	Format string `json:"format,omitempty"`
	Width  int    `json:"width,omitempty"`
	Pinned bool   `json:"pinned"`
	// ValueFrom is a Go-template-style path evaluated on the row data,
	// e.g. "{{.Author.Name}}".
	ValueFrom string `json:"valueFrom,omitempty"`
	Link      string `json:"link,omitempty"`
}

// TableSchema is the schema of a list view. UIType is always "table".
type TableSchema struct {
	UIType  string        `json:"uiType"`
	Type    ActionType    `json:"type"`
	Columns []TableColumn `json:"columns"`
}

// FormSchema is the schema of a create/edit form. UIType is always "form".
// Schema is a JSON Schema (draft-07 compatible) and UISchema follows
// react-jsonschema-form's uiSchema format.
type FormSchema struct {
	UIType           string             `json:"uiType"`
	Type             ActionType         `json:"type"`
	Schema           *jsonschema.Schema `json:"schema"`
	UISchema         UISchema           `json:"uiSchema"`
	SupportedActions []ActionButton     `json:"supportedActions"`
}

// CustomPageSectionType identifies a section rendered on a custom resource page.
type CustomPageSectionType string

const (
	CustomPageSectionCharts     CustomPageSectionType = "charts"
	CustomPageSectionStatistics CustomPageSectionType = "statistics"
	CustomPageSectionText       CustomPageSectionType = "text"
)

// ChartType identifies the supported chart renderers for a charts section.
type ChartType string

const (
	ChartTypeBar  ChartType = "bar"
	ChartTypeLine ChartType = "line"
)

// ChartSeries describes one numeric series in a chart.
type ChartSeries struct {
	Key   string `json:"key"`
	Label string `json:"label,omitempty"`
	Color string `json:"color,omitempty"`
}

// Chart describes a simple bar or line chart. Data items are arbitrary maps;
// XKey selects the category label and either YKey or Series selects numeric
// values.
type Chart struct {
	Type   ChartType        `json:"type"`
	Title  string           `json:"title,omitempty"`
	Data   []map[string]any `json:"data"`
	XKey   string           `json:"xKey"`
	YKey   string           `json:"yKey,omitempty"`
	Series []ChartSeries    `json:"series,omitempty"`
}

// Statistic describes one metric in a statistics section.
type Statistic struct {
	Label       string `json:"label"`
	Value       any    `json:"value"`
	Description string `json:"description,omitempty"`
	Trend       string `json:"trend,omitempty"`
	Tone        string `json:"tone,omitempty"`
}

// CustomPageSection is one content block on a custom resource page.
type CustomPageSection struct {
	Type        CustomPageSectionType `json:"type"`
	Title       string                `json:"title,omitempty"`
	Description string                `json:"description,omitempty"`
	Children    []Chart               `json:"children,omitempty"`
	Statistics  []Statistic           `json:"statistics,omitempty"`
	Body        string                `json:"body,omitempty"`
}

// CustomResourcePage is the schema for a custom page resource. UIType is always
// "custom".
type CustomResourcePage struct {
	UIType        string              `json:"uiType"`
	Type          ActionType          `json:"type"`
	ActionButtons []ActionButton      `json:"actionButtons"`
	Sections      []CustomPageSection `json:"sections"`
}

// SearchItem is one result of a search action (ForeignKey / ObjectSearch widgets).
type SearchItem struct {
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	Value       string `json:"value"`
}

// Item is one row of a paginated response.
type Item struct {
	Data        any            `json:"data"`
	Actions     []ActionButton `json:"actions,omitempty"`
	DynamicPath string         `json:"dynamicPath,omitempty"`
}

// ActionResponse is the result of Fetch/Act. Exactly one of the three shapes is
// emitted on the wire:
//   - detail:    {"data": ...}
//   - paginated: {"items": [...], "actions": [...], "nextUrl": ..., "previousUrl": ...}
//   - search:    [{"title", "description", "value"}, ...]
type ActionResponse struct {
	Data        any
	Items       []Item
	Actions     []ActionButton
	NextURL     *string
	PreviousURL *string
	SearchItems []SearchItem
	isSearch    bool
	isPaginated bool
}

// Detail builds a detail-shaped response.
func Detail(data any) *ActionResponse {
	return &ActionResponse{Data: data}
}

// Paginated builds a paginated-shaped response.
func Paginated(items []Item, actions []ActionButton, nextURL, previousURL *string) *ActionResponse {
	if items == nil {
		items = []Item{}
	}
	if actions == nil {
		actions = []ActionButton{}
	}
	return &ActionResponse{Items: items, Actions: actions, NextURL: nextURL, PreviousURL: previousURL, isPaginated: true}
}

// SearchResults builds a search-shaped response.
func SearchResults(items []SearchItem) *ActionResponse {
	if items == nil {
		items = []SearchItem{}
	}
	return &ActionResponse{SearchItems: items, isSearch: true}
}

// MarshalJSON emits exactly one of the three wire shapes.
func (r *ActionResponse) MarshalJSON() ([]byte, error) {
	if r.isSearch {
		return json.Marshal(r.SearchItems)
	}
	if r.isPaginated {
		return json.Marshal(struct {
			Items       []Item         `json:"items"`
			Actions     []ActionButton `json:"actions"`
			NextURL     *string        `json:"nextUrl,omitempty"`
			PreviousURL *string        `json:"previousUrl,omitempty"`
		}{r.Items, r.Actions, r.NextURL, r.PreviousURL})
	}
	return json.Marshal(struct {
		Data any `json:"data"`
	}{r.Data})
}
