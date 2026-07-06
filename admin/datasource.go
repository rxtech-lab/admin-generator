package admin

import "context"

// ListParams selects a page of items.
type ListParams struct {
	// After is an opaque cursor returned by a previous Page.
	After string
	// Limit is the page size; implementations apply their own default/cap.
	Limit int
	// Filters are optional field=value constraints.
	Filters map[string]string
}

// Page is one page of results plus opaque cursors.
type Page[T any] struct {
	Items      []T
	NextCursor string // empty when no next page
	PrevCursor string // empty when no previous page
}

// DataSource is the persistence contract behind a generic CRUD resource.
// IDs are strings on the wire regardless of the underlying key type.
type DataSource[T any] interface {
	List(ctx context.Context, p ListParams) (Page[T], error)
	Get(ctx context.Context, id string) (T, error)
	Create(ctx context.Context, item *T) error
	// Update applies the given JSON-named fields and returns the updated item.
	Update(ctx context.Context, id string, patch map[string]any) (T, error)
	Delete(ctx context.Context, id string) error
	Search(ctx context.Context, query string, limit int) ([]SearchItem, error)
}
