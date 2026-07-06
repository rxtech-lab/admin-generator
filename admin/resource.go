package admin

import (
	"context"
	"net/url"
)

// Identity is the authenticated principal, produced by the HTTP layer's
// Authenticator. Its concrete type is whatever your authenticator returns.
type Identity any

// Request carries per-call context into a Resource.
type Request struct {
	// Identity of the caller; nil when no authenticator is configured.
	Identity Identity
	// BasePath is the mount path of the admin API (e.g. "/admin"), used to
	// build dataUrl / nextUrl / button onClick URLs.
	BasePath string
	// DynamicPath addresses a sub-entity of the resource, e.g. "42" to edit
	// row 42. Passed through from the ?dynamicPath= query parameter.
	DynamicPath string
	// Query holds the raw query parameters (after, limit, query, ...).
	Query url.Values
}

// Resource is the unit the admin frontend renders. Implement it directly for
// full control, or use NewResource for generic struct-backed CRUD.
type Resource interface {
	// ID is the stable slug of the resource, used in URLs.
	ID() string
	// Info returns navigation metadata.
	Info(ctx context.Context, req Request) ResourceInfo
	// Schema returns a *TableSchema or *FormSchema for the given action.
	Schema(ctx context.Context, req Request, action ActionType) (any, error)
	// Fetch handles read-side actions (view listing, edit prefill, search).
	Fetch(ctx context.Context, req Request, action ActionType, formData map[string]any) (*ActionResponse, error)
	// Act handles write-side actions (create, edit, delete) and search POSTs.
	Act(ctx context.Context, req Request, action ActionType, data map[string]any) (*ActionResponse, error)
}
