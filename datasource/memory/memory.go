// Package memory provides an in-memory admin.DataSource, useful for tests and
// zero-dependency demos.
package memory

import (
	"context"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/rxtech-lab/admin-generator/admin"
)

// Store is an in-memory DataSource for T. IDs are managed as strings derived
// from the "id" JSON field; Create assigns an auto-incremented numeric ID when
// the item's is empty/zero.
type Store[T any] struct {
	mu           sync.RWMutex
	items        []map[string]any
	nextID       int64
	idField      string
	searchFields []string
}

type Option[T any] func(*Store[T])

// WithIDField overrides the JSON name of the primary key (default "id").
func WithIDField[T any](name string) Option[T] {
	return func(s *Store[T]) { s.idField = name }
}

// WithSearchFields sets the JSON fields matched by Search.
func WithSearchFields[T any](fields ...string) Option[T] {
	return func(s *Store[T]) { s.searchFields = fields }
}

func New[T any](opts ...Option[T]) *Store[T] {
	s := &Store[T]{nextID: 1, idField: "id"}
	for _, opt := range opts {
		opt(s)
	}
	return s
}

// Seed inserts items, assigning IDs as needed. Panics on marshal errors so
// bad fixtures fail loudly at startup.
func (s *Store[T]) Seed(items ...T) *Store[T] {
	for i := range items {
		if err := s.Create(context.Background(), &items[i]); err != nil {
			panic(fmt.Sprintf("memory: seed: %v", err))
		}
	}
	return s
}

func (s *Store[T]) List(_ context.Context, p admin.ListParams) (admin.Page[T], error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

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
	if offset > len(s.items) {
		offset = len(s.items)
	}
	end := offset + limit
	if end > len(s.items) {
		end = len(s.items)
	}

	page := admin.Page[T]{}
	for _, m := range s.items[offset:end] {
		item, err := fromMap[T](m)
		if err != nil {
			return page, err
		}
		page.Items = append(page.Items, item)
	}
	if end < len(s.items) {
		page.NextCursor = strconv.Itoa(end)
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

func (s *Store[T]) Get(_ context.Context, id string) (T, error) {
	var zero T
	s.mu.RLock()
	defer s.mu.RUnlock()
	m := s.find(id)
	if m == nil {
		return zero, fmt.Errorf("%w: %s", admin.ErrNotFound, id)
	}
	return fromMap[T](m)
}

func (s *Store[T]) Create(_ context.Context, item *T) error {
	m, err := toMap(*item)
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if idStr := stringID(m[s.idField]); idStr == "" || idStr == "0" {
		m[s.idField] = s.nextID
		s.nextID++
	} else if n, err := strconv.ParseInt(idStr, 10, 64); err == nil && n >= s.nextID {
		s.nextID = n + 1
	}
	s.items = append(s.items, m)
	updated, err := fromMap[T](m)
	if err != nil {
		return err
	}
	*item = updated
	return nil
}

func (s *Store[T]) Update(_ context.Context, id string, patch map[string]any) (T, error) {
	var zero T
	s.mu.Lock()
	defer s.mu.Unlock()
	m := s.find(id)
	if m == nil {
		return zero, fmt.Errorf("%w: %s", admin.ErrNotFound, id)
	}
	for k, v := range patch {
		if k == s.idField {
			continue
		}
		m[k] = v
	}
	return fromMap[T](m)
}

func (s *Store[T]) Delete(_ context.Context, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i, m := range s.items {
		if stringID(m[s.idField]) == id {
			s.items = append(s.items[:i], s.items[i+1:]...)
			return nil
		}
	}
	return fmt.Errorf("%w: %s", admin.ErrNotFound, id)
}

func (s *Store[T]) Search(_ context.Context, query string, limit int) ([]admin.SearchItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 {
		limit = 20
	}
	query = strings.ToLower(query)
	results := make([]admin.SearchItem, 0)
	for _, m := range s.items {
		if len(results) >= limit {
			break
		}
		for _, f := range s.searchFields {
			v, ok := m[f].(string)
			if !ok {
				continue
			}
			if query == "" || strings.Contains(strings.ToLower(v), query) {
				results = append(results, admin.SearchItem{
					Title: v,
					Value: stringID(m[s.idField]),
				})
				break
			}
		}
	}
	return results, nil
}

// find must be called with the lock held.
func (s *Store[T]) find(id string) map[string]any {
	for _, m := range s.items {
		if stringID(m[s.idField]) == id {
			return m
		}
	}
	return nil
}

func toMap(v any) (map[string]any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, err
	}
	return m, nil
}

func fromMap[T any](m map[string]any) (T, error) {
	var out T
	b, err := json.Marshal(m)
	if err != nil {
		return out, err
	}
	err = json.Unmarshal(b, &out)
	return out, err
}

func stringID(v any) string {
	switch id := v.(type) {
	case nil:
		return ""
	case string:
		return id
	case float64:
		return strconv.FormatInt(int64(id), 10)
	case int64:
		return strconv.FormatInt(id, 10)
	case int:
		return strconv.Itoa(id)
	default:
		return fmt.Sprintf("%v", id)
	}
}
