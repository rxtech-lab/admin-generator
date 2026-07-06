package admin

import (
	"fmt"
	"sync"
)

// Registry holds all registered resources in registration order.
type Registry struct {
	mu        sync.RWMutex
	resources []Resource
	byID      map[string]Resource
}

func NewRegistry() *Registry {
	return &Registry{byID: make(map[string]Resource)}
}

// Register adds resources to the registry. It panics on duplicate IDs so
// misconfiguration fails at startup, not at request time.
func (r *Registry) Register(resources ...Resource) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, res := range resources {
		if _, exists := r.byID[res.ID()]; exists {
			panic(fmt.Sprintf("admin: resource %q registered twice", res.ID()))
		}
		r.byID[res.ID()] = res
		r.resources = append(r.resources, res)
	}
}

// Get returns the resource with the given ID.
func (r *Registry) Get(id string) (Resource, bool) {
	r.mu.RLock()
	defer r.mu.RUnlock()
	res, ok := r.byID[id]
	return res, ok
}

// List returns all resources in registration order.
func (r *Registry) List() []Resource {
	r.mu.RLock()
	defer r.mu.RUnlock()
	out := make([]Resource, len(r.resources))
	copy(out, r.resources)
	return out
}
