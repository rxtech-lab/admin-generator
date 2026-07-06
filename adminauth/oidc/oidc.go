// Package oidc provides an adminhttp.Authenticator that validates RS256 bearer
// access tokens issued by an OpenID Connect provider such as rxlab-auth
// (https://auth.rxlab.app).
//
// It fetches and caches the provider's JWKS, verifies the token signature and
// issuer, and exposes the claims (sub, scope, roles, client_id) as the
// admin.Identity. Access tokens from rxlab-auth carry no `aud` claim, so
// audience verification is skipped; restrict accepted callers with
// WithAllowedClientIDs and/or gate actions with RequireRole.
package oidc

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/rxtech-lab/admin-generator/admin"
)

// Claims is the validated identity extracted from an access token.
type Claims struct {
	Subject  string   `json:"sub"`
	ClientID string   `json:"client_id"`
	Scope    string   `json:"scope"`
	Roles    []string `json:"roles"`
}

// Scopes returns the space-delimited scope claim as a slice.
func (c *Claims) Scopes() []string {
	if c.Scope == "" {
		return nil
	}
	return strings.Fields(c.Scope)
}

// HasRole reports whether the identity carries the given app-scoped role.
func (c *Claims) HasRole(role string) bool { return slices.Contains(c.Roles, role) }

// HasScope reports whether the identity was granted the given scope.
func (c *Claims) HasScope(scope string) bool { return slices.Contains(c.Scopes(), scope) }

// Authenticator validates bearer access tokens against an OIDC provider.
type Authenticator struct {
	verifier         *oidc.IDTokenVerifier
	allowedClientIDs []string
}

// Option configures the Authenticator.
type Option func(*config)

type config struct {
	allowedClientIDs []string
}

// WithAllowedClientIDs restricts accepted tokens to those whose client_id claim
// is in the list. Because rxlab-auth access tokens omit `aud`, this is the way
// to ensure only tokens minted for your app are accepted.
func WithAllowedClientIDs(ids ...string) Option {
	return func(c *config) { c.allowedClientIDs = append(c.allowedClientIDs, ids...) }
}

// New builds an Authenticator for the given issuer (e.g.
// "https://auth.rxlab.app"). It performs OIDC discovery against
// {issuer}/.well-known/openid-configuration and caches the JWKS.
func New(ctx context.Context, issuer string, opts ...Option) (*Authenticator, error) {
	cfg := &config{}
	for _, opt := range opts {
		opt(cfg)
	}
	provider, err := oidc.NewProvider(ctx, issuer)
	if err != nil {
		return nil, fmt.Errorf("oidc discovery for %s: %w", issuer, err)
	}
	// Access tokens have no audience; skip the client ID check and enforce
	// issuer + signature + expiry only. Restrict callers via client_id below.
	verifier := provider.Verifier(&oidc.Config{SkipClientIDCheck: true})
	return &Authenticator{verifier: verifier, allowedClientIDs: cfg.allowedClientIDs}, nil
}

// Authenticate implements adminhttp.Authenticator.
func (a *Authenticator) Authenticate(r *http.Request) (admin.Identity, error) {
	raw, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || raw == "" {
		return nil, errors.New("missing bearer token")
	}
	token, err := a.verifier.Verify(r.Context(), raw)
	if err != nil {
		return nil, fmt.Errorf("token verification failed: %w", err)
	}
	claims := &Claims{}
	if err := token.Claims(claims); err != nil {
		return nil, fmt.Errorf("parse claims: %w", err)
	}
	if len(a.allowedClientIDs) > 0 && !slices.Contains(a.allowedClientIDs, claims.ClientID) {
		return nil, fmt.Errorf("client_id %q not allowed", claims.ClientID)
	}
	return claims, nil
}

// RequireRole returns an admin authorize hook (for admin.ResourceConfig.Authorize)
// that permits an action only when the identity carries the given role.
func RequireRole(role string) func(ctx context.Context, id admin.Identity, action admin.ActionType) error {
	return func(_ context.Context, id admin.Identity, _ admin.ActionType) error {
		claims, ok := id.(*Claims)
		if !ok || !claims.HasRole(role) {
			return admin.ErrForbidden
		}
		return nil
	}
}
