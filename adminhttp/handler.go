// Package adminhttp mounts an admin.Registry as a net/http handler serving the
// four-endpoint admin contract:
//
//	GET  {base}/resources
//	GET  {base}/resources/{id}
//	GET  {base}/resources/{id}/schema?action=&dynamicPath=
//	GET  {base}/resources/{id}/action?action=&dynamicPath=&after=&limit=
//	POST {base}/resources/{id}/action  {"action": ..., "data": {...}}
//
// It is router-agnostic; for Fiber use gofiber's adaptor:
//
//	app.All("/admin/*", adaptor.HTTPHandler(adminhttp.New(reg)))
package adminhttp

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/rxtech-lab/admin-generator/admin"
)

// Authenticator turns an incoming request into an admin.Identity.
// Return an error to reject the request with 401.
type Authenticator interface {
	Authenticate(r *http.Request) (admin.Identity, error)
}

// AuthenticatorFunc adapts a function to the Authenticator interface.
type AuthenticatorFunc func(r *http.Request) (admin.Identity, error)

func (f AuthenticatorFunc) Authenticate(r *http.Request) (admin.Identity, error) { return f(r) }

type handler struct {
	registry *admin.Registry
	basePath string
	auth     Authenticator
	logger   *slog.Logger
}

// Option configures the handler.
type Option func(*handler)

// WithBasePath sets the mount path used in generated URLs (default "/admin").
func WithBasePath(p string) Option { return func(h *handler) { h.basePath = p } }

// WithAuthenticator requires authentication on every endpoint.
func WithAuthenticator(a Authenticator) Option { return func(h *handler) { h.auth = a } }

// WithLogger sets the error logger (default slog.Default()).
func WithLogger(l *slog.Logger) Option { return func(h *handler) { h.logger = l } }

// New builds the http.Handler for a registry. Mount it at the base path:
//
//	mux.Handle("/admin/", adminhttp.New(reg))
func New(registry *admin.Registry, opts ...Option) http.Handler {
	h := &handler{registry: registry, basePath: "/admin", logger: slog.Default()}
	for _, opt := range opts {
		opt(h)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET "+h.basePath+"/resources", h.withAuth(h.listResources))
	mux.HandleFunc("GET "+h.basePath+"/resources/{id}", h.withAuth(h.getResource))
	mux.HandleFunc("GET "+h.basePath+"/resources/{id}/schema", h.withAuth(h.getSchema))
	mux.HandleFunc("GET "+h.basePath+"/resources/{id}/action", h.withAuth(h.fetchAction))
	mux.HandleFunc("POST "+h.basePath+"/resources/{id}/action", h.withAuth(h.postAction))
	return mux
}

type authedHandler func(w http.ResponseWriter, r *http.Request, req admin.Request)

func (h *handler) withAuth(next authedHandler) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var identity admin.Identity
		if h.auth != nil {
			var err error
			identity, err = h.auth.Authenticate(r)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
		}
		next(w, r, admin.Request{
			Identity:    identity,
			BasePath:    h.basePath,
			DynamicPath: r.URL.Query().Get("dynamicPath"),
			Query:       r.URL.Query(),
		})
	}
}

func (h *handler) listResources(w http.ResponseWriter, r *http.Request, req admin.Request) {
	resources := h.registry.List()
	infos := make([]admin.ResourceInfo, 0, len(resources))
	for _, res := range resources {
		infos = append(infos, res.Info(r.Context(), req))
	}
	writeJSON(w, http.StatusOK, infos)
}

func (h *handler) getResource(w http.ResponseWriter, r *http.Request, req admin.Request) {
	res, ok := h.registry.Get(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "resource not found"})
		return
	}
	writeJSON(w, http.StatusOK, res.Info(r.Context(), req))
}

func (h *handler) getSchema(w http.ResponseWriter, r *http.Request, req admin.Request) {
	res, ok := h.registry.Get(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "resource not found"})
		return
	}
	action := admin.ActionType(r.URL.Query().Get("action"))
	if action == "" {
		action = admin.ActionView
	}
	schema, err := res.Schema(r.Context(), req, action)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, schema)
}

func (h *handler) fetchAction(w http.ResponseWriter, r *http.Request, req admin.Request) {
	res, ok := h.registry.Get(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "resource not found"})
		return
	}
	action := admin.ActionType(r.URL.Query().Get("action"))
	if action == "" {
		action = admin.ActionView
	}
	var formData map[string]any
	if raw := r.URL.Query().Get("formData"); raw != "" {
		if err := json.Unmarshal([]byte(raw), &formData); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid formData"})
			return
		}
	}
	resp, err := res.Fetch(r.Context(), req, action, formData)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *handler) postAction(w http.ResponseWriter, r *http.Request, req admin.Request) {
	res, ok := h.registry.Get(r.PathValue("id"))
	if !ok {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "resource not found"})
		return
	}
	var body struct {
		Action admin.ActionType `json:"action"`
		Data   map[string]any   `json:"data"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid request body"})
		return
	}
	if body.Action == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "action is required"})
		return
	}
	resp, err := res.Act(r.Context(), req, body.Action, body.Data)
	if err != nil {
		h.writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

func (h *handler) writeError(w http.ResponseWriter, err error) {
	var verr *admin.ValidationError
	switch {
	case errors.As(err, &verr):
		writeJSON(w, http.StatusUnprocessableEntity, map[string]any{"error": "validation failed", "fields": verr.Fields})
	case errors.Is(err, admin.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"error": err.Error()})
	case errors.Is(err, admin.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"error": err.Error()})
	case errors.Is(err, admin.ErrBadInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
	default:
		h.logger.Error("admin action failed", "error", err)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
