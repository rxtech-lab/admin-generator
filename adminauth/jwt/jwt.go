// Package jwt provides a minimal HS256 bearer-token Authenticator for
// adminhttp, plus a Sign helper for issuing tokens. For anything beyond
// symmetric JWTs, implement adminhttp.Authenticator yourself.
package jwt

import (
	"errors"
	"net/http"
	"strings"
	"time"

	gojwt "github.com/golang-jwt/jwt/v5"
	"github.com/rxtech-lab/admin-generator/admin"
)

// Claims is the Identity produced by the HS256 authenticator.
type Claims = gojwt.MapClaims

// HS256 returns an authenticator validating "Authorization: Bearer <token>"
// HS256 JWTs signed with secret. The token's claims become the admin.Identity.
type HS256Authenticator struct {
	secret []byte
}

func HS256(secret []byte) *HS256Authenticator {
	return &HS256Authenticator{secret: secret}
}

func (a *HS256Authenticator) Authenticate(r *http.Request) (admin.Identity, error) {
	header := r.Header.Get("Authorization")
	token, ok := strings.CutPrefix(header, "Bearer ")
	if !ok || token == "" {
		return nil, errors.New("missing bearer token")
	}
	claims := Claims{}
	parsed, err := gojwt.ParseWithClaims(token, claims, func(t *gojwt.Token) (any, error) {
		if _, ok := t.Method.(*gojwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return a.secret, nil
	})
	if err != nil || !parsed.Valid {
		return nil, errors.New("invalid token")
	}
	return claims, nil
}

// Sign issues an HS256 token with the given claims and TTL.
func Sign(secret []byte, claims Claims, ttl time.Duration) (string, error) {
	now := time.Now()
	claims["iat"] = now.Unix()
	claims["exp"] = now.Add(ttl).Unix()
	return gojwt.NewWithClaims(gojwt.SigningMethodHS256, claims).SignedString(secret)
}
