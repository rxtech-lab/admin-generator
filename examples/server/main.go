// Command server is a runnable demo of the admin framework: a blog with Authors
// and Posts backed by an in-process SQLite database, exposed at /admin.
//
// Auth modes (selected by env):
//   - default (dev):  no OIDC issuer set. A dev-only HS256 authenticator is used
//     and POST /dev/login mints a token so the example web app can sign in
//     offline.
//   - production:     set OIDC_ISSUER=https://auth.rxlab.app to validate real
//     rxlab-auth bearer tokens; optionally OIDC_CLIENT_ID to restrict callers
//     and ADMIN_ROLE to gate access on an app-scoped role.
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/glebarez/sqlite"
	"github.com/rxtech-lab/admin-generator/admin"
	authjwt "github.com/rxtech-lab/admin-generator/adminauth/jwt"
	"github.com/rxtech-lab/admin-generator/adminauth/oidc"
	"github.com/rxtech-lab/admin-generator/adminhttp"
	"github.com/rxtech-lab/admin-generator/datasource/gormds"
	"github.com/rxtech-lab/admin-generator/examples/server/models"
	"gorm.io/gorm"
)

var devSecret = []byte("dev-secret-change-me")

func main() {
	db := mustOpenDB()
	seed(db)

	reg := admin.NewRegistry()
	reg.Register(
		admin.NewResource[models.Author](admin.ResourceConfig[models.Author]{
			ID:          "authors",
			Name:        "Authors",
			Description: "Blog authors",
			Icon:        "users",
			DataSource:  gormds.New[models.Author](db, gormds.WithSearchFields[models.Author]("name", "email")),
			CreateForm:  models.CreateAuthorInput{},
			EditForm:    models.UpdateAuthorInput{},
			Authorize:   authorize(),
		}),
		admin.NewResource[models.Post](admin.ResourceConfig[models.Post]{
			ID:          "posts",
			Name:        "Posts",
			Description: "Blog posts",
			Icon:        "file-text",
			DataSource: gormds.New[models.Post](db,
				gormds.WithSearchFields[models.Post]("title"),
				gormds.WithPreloads[models.Post]("Author"),
				gormds.WithOrder[models.Post]("id DESC"), // newest first
			),
			CreateForm:  models.CreatePostInput{},
			EditForm:    models.UpdatePostInput{},
			LinkPattern: map[string]string{"title": "/admin/posts/{id}"},
			Authorize:   authorize(),
		}),
	)

	authenticator := mustAuthenticator()
	adminHandler := adminhttp.New(reg,
		adminhttp.WithBasePath("/admin"),
		adminhttp.WithAuthenticator(authenticator),
	)

	mux := http.NewServeMux()
	mux.Handle("/admin/", adminHandler)
	mux.HandleFunc("POST /dev/login", devLogin)
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Write([]byte("ok"))
	})

	addr := ":8080"
	if p := os.Getenv("PORT"); p != "" {
		addr = ":" + p
	}
	log.Printf("admin demo listening on %s (admin at http://localhost%s/admin/resources)", addr, addr)
	if err := http.ListenAndServe(addr, withCORS(mux)); err != nil {
		log.Fatal(err)
	}
}

func mustOpenDB() *gorm.DB {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = "file:admin_demo.db?cache=shared"
	}
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		log.Fatalf("open db: %v", err)
	}
	if err := db.AutoMigrate(&models.Author{}, &models.Post{}); err != nil {
		log.Fatalf("migrate: %v", err)
	}
	return db
}

func mustAuthenticator() adminhttp.Authenticator {
	issuer := os.Getenv("OIDC_ISSUER")
	if issuer == "" {
		log.Println("auth: dev HS256 mode (POST /dev/login to get a token)")
		return authjwt.HS256(devSecret)
	}
	var opts []oidc.Option
	if clientID := os.Getenv("OIDC_CLIENT_ID"); clientID != "" {
		opts = append(opts, oidc.WithAllowedClientIDs(clientID))
	}
	auth, err := oidc.New(context.Background(), issuer, opts...)
	if err != nil {
		log.Fatalf("auth: oidc init: %v", err)
	}
	log.Printf("auth: OIDC mode (issuer %s)", issuer)
	return auth
}

// authorize gates actions on ADMIN_ROLE when running in OIDC mode; in dev mode
// (no OIDC issuer) it allows everything.
func authorize() func(ctx context.Context, id admin.Identity, action admin.ActionType) error {
	role := os.Getenv("ADMIN_ROLE")
	if role == "" || os.Getenv("OIDC_ISSUER") == "" {
		return nil
	}
	return oidc.RequireRole(role)
}

// devLogin mints a short-lived HS256 token for local testing only.
func devLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
	}
	_ = json.NewDecoder(r.Body).Decode(&body)
	if body.Username == "" {
		body.Username = "admin"
	}
	token, err := authjwt.Sign(devSecret, authjwt.Claims{
		"sub":   body.Username,
		"roles": []string{"admin"},
	}, 24*time.Hour)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]any{
		"token": token,
		"user":  map[string]string{"id": body.Username, "name": body.Username},
	})
}

// withCORS allows the example web app (localhost:3000) to call the API.
func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := os.Getenv("CORS_ORIGIN")
		if origin == "" {
			origin = "http://localhost:3000"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Vary", "Origin")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
