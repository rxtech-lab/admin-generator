package admin

import (
	"errors"
	"fmt"
)

// Sentinel errors mapped to HTTP statuses by the adminhttp handler.
var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	ErrBadInput  = errors.New("bad input")
)

// ValidationError reports per-field validation failures; the frontend surfaces
// them on the corresponding form fields. Maps to HTTP 422.
type ValidationError struct {
	Fields map[string]string `json:"fields"`
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("validation failed: %v", e.Fields)
}
