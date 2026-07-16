# admin-generator

Build an admin panel by registering your Go structs. The Go backend describes
each resource as JSON (table columns + JSON Schema forms) and serves generic
CRUD; the Next.js package renders the entire admin UI from that schema with one
catch-all route — no per-resource frontend code.

```
┌─────────────────────┐   JSON schema + CRUD   ┌──────────────────────────┐
│  Go: admin package  │ ─────────────────────► │  Next.js: @rxtech-lab/   │
│  register structs   │   4 HTTP endpoints     │  admin-next  <AdminApp/> │
└─────────────────────┘                        └──────────────────────────┘
```

- **Go module** — `github.com/rxtech-lab/admin-generator`
- **npm package** — `@rxtech-lab/admin-generator-next`
- **Auth.js package** — `@rxtech-lab/authjs-rxlab`

## Repository layout

| Path                   | What                                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `admin/`               | Core: resource registry, generic CRUD, struct-tag reflection into table/form schemas              |
| `adminhttp/`           | `net/http` handler for the 4-endpoint contract (router-agnostic; Fiber via `adaptor.HTTPHandler`) |
| `adminauth/oidc/`      | OIDC bearer authenticator (rxlab-auth / any OIDC provider)                                        |
| `adminauth/jwt/`       | Dev-only HS256 authenticator + token signer                                                       |
| `datasource/gormds/`   | GORM adapter (`DataSource`)                                                                       |
| `datasource/memory/`   | In-memory adapter for tests/demos                                                                 |
| `packages/admin-next/` | The npm package (React 19 / Next 15, RJSF forms, shadcn-style theme)                              |
| `packages/authjs-rxlab/` | Auth.js v5 configuration for RxLab OIDC sessions and refresh-token rotation                    |
| `examples/server/`     | Runnable Go demo (SQLite, seeded Authors + Posts)                                                 |
| `examples/web/`        | Runnable Next.js demo consuming the package                                                       |

## Go: define resources

```go
reg := admin.NewRegistry()
reg.Register(admin.NewResource[models.Post](admin.ResourceConfig[models.Post]{
    ID:         "posts",
    Name:       "Posts",
    Icon:       "file-text",                       // lucide icon
    DataSource: gormds.New[models.Post](db, gormds.WithPreloads[models.Post]("Author")),
    CreateForm: dto.CreatePost{},                  // reflected into the create form
    EditForm:   dto.UpdatePost{},
    Authorize:  oidc.RequireRole("admin"),         // optional
}))

mux := http.NewServeMux()
mux.Handle("/admin/", adminhttp.New(reg,
    adminhttp.WithBasePath("/admin"),
    adminhttp.WithAuthenticator(authenticator),    // any adminhttp.Authenticator
))
```

Struct tags drive the schema:

```go
type Post struct {
    ID     uint   `json:"id" jsonschema:"title=ID" table:"order=0;pinned=true"`
    Title  string `json:"title" jsonschema:"title=Title,required" table:"order=1"`
    Status string `json:"status" jsonschema:"title=Status,enum=draft,enum=published" table:"order=2;format=chip"`
    Author Author `json:"author" table:"order=3;valuefrom={{.Author.Name}}"`
}
```

- `table:` — column `order`, `width`, `format` (`image|chip|color|date-time|url|wallet-address|…`), `valuefrom` template, `pinned`, `omit`.
- `jsonschema:` — form field title/format/enum/required (via `invopop/jsonschema`).
- `uischema:` — RJSF widget selection, e.g. `uischema:"widget=ForeignKey;ui:options:resource=authors"`.
- `validate:` — server-side validation (`go-playground/validator`); failures return 422 with per-field messages.

Custom pages are registered alongside CRUD resources when a resource is not a
table or form:

```go
reg.Register(admin.NewCustomResourcePage(admin.CustomResourceConfig{
    ID:   "dashboard",
    Name: "Dashboard",
    Icon: "layout-dashboard",
    Page: admin.CustomResourcePage{
        ActionButtons: []admin.ActionButton{{
            Type: admin.ButtonSecondary, Label: "Open Posts", Icon: "file-text",
            Behavior: admin.BehaviorNavigate, ActionType: admin.ActionView,
            OnClick: "/admin/posts",
        }},
        Sections: []admin.CustomPageSection{
            {
                Type: admin.CustomPageSectionStatistics,
                Statistics: []admin.Statistic{{Label: "Published posts", Value: 17}},
            },
            {
                Type: admin.CustomPageSectionCharts,
                Children: []admin.Chart{{
                    Type: admin.ChartTypeBar,
                    Data: []map[string]any{{"day": "Mon", "views": 320}},
                    XKey: "day", YKey: "views",
                }},
            },
            {Type: admin.CustomPageSectionText, Body: "Operational notes"},
        },
    },
}))
```

## Next.js: mount the UI

Three small files in your app (see `examples/web`):

```ts
// lib/admin-config.ts (server-only)
export const adminConfig = defineAdminConfig({
  apiUrl: process.env.ADMIN_API_URL!,
  getToken: async () => (await auth())?.accessToken ?? null,
});

// app/admin/actions.ts
"use server";
export const { listResources, getSchema, fetchAction, fetchUrl, submitAction } =
  createAdminActions(adminConfig);

// app/admin/[[...slug]]/page.tsx
export default function Page(props) {
  return <AdminApp config={adminConfig} actions={actions} {...props} />;
}
```

Styling (Tailwind v4), in your global stylesheet:

```css
@import "tailwindcss";
@import "@rxtech-lab/admin-generator-next/theme.css";
@source "../node_modules/@rxtech-lab/admin-generator-next/dist";
```

## Auth with rxlab-auth (OIDC)

The framework accepts any OIDC provider. For [rxlab-auth](https://auth.rxlab.app):

**Backend** — validate access tokens against the issuer's JWKS:

```go
auth, _ := oidc.New(ctx, "https://auth.rxlab.app",
    oidc.WithAllowedClientIDs("your-client-id")) // access tokens carry no aud; restrict by client_id
adminhttp.New(reg, adminhttp.WithAuthenticator(auth))
```

Gate resources on app-scoped roles with `oidc.RequireRole("admin")`.

**Frontend** — use `@rxtech-lab/authjs-rxlab` to configure Auth.js with the
RxLab OIDC provider, refresh-token rotation, session access tokens, and
app-scoped roles:

```ts
import { createRxLabAuth } from "@rxtech-lab/authjs-rxlab";

export const { handlers, signIn, signOut, auth } = createRxLabAuth({
  issuer: process.env.AUTH_ISSUER!,
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET!,
});
```

A client must be pre-registered in the rxlab-auth dashboard with the Auth.js
callback URI and the `openid email profile offline_access` scopes.

## Run the demo

```bash
# terminal 1 — Go API on :8080
cd examples/server && go run .

# terminal 2 — Next.js on :3000
bun install
cd examples/web && bun run dev
# open http://localhost:3000 → "Sign in (dev)" → admin
```

## Development

```bash
go test ./...                                   # Go core
bun run test                                    # npm package tests
bun run build                                   # npm package builds
bun run --filter '@rxtech-lab/*' typecheck      # npm package types
```

## Publishing

- **npm** — manually run the `Create Release` workflow. Semantic-release creates
  a versioned GitHub Release from conventional commits; `release.yml` then
  builds, tests, stamps, and publishes both npm packages through npm trusted
  publishing with OIDC.
- **Go** — tag the repo: `git tag v0.1.0 && git push --tags`, then
  `go get github.com/rxtech-lab/admin-generator@v0.1.0`.

Each npm package must trust `rxtech-lab/admin-generator` and `release.yml` in
its npm settings. npm requires a package to exist before trusted publishing can
be configured, so bootstrap a brand-new package once with maintainer
credentials, configure the trusted publisher, and use CI for later releases.

## License

MIT
