---
slug: code/go
title: Go Package Reference
description: Exported Go packages and extension points in admin-generator.
---

# Go Package Reference

These packages are published by the Go module
`github.com/rxtech-lab/admin-generator`.

## `admin`

The `admin` package provides the core schema-driven resource framework.

Primary exported types:

- `Registry`: registration-order collection of resources. Use `NewRegistry`,
  `Register`, `Get`, and `List`.
- `Resource`: interface implemented by anything the admin UI can render.
- `ResourceConfig[T]`: configuration for `NewResource[T]`, including ID, name,
  icon, data source, DTOs, enabled actions, link patterns, ID field, default
  limit, and authorization.
- `DataSource[T]`: persistence contract used by generic CRUD resources.
- `Request`: per-call identity, base path, dynamic path, and query values.
- `ResourceInfo`, `TableSchema`, `FormSchema`, `ActionButton`, `TableColumn`,
  `ActionResponse`, `SearchItem`, `Item`: wire types shared with the frontend.

Important constructors and helpers:

- `NewResource[T](cfg, opts...)`: builds a generic CRUD-backed resource.
- `NewFormResource(cfg)`: builds a form-only / custom-action resource from
  handler closures (see below).
- `NewCustomResourcePage(cfg)`: builds a custom page resource with action
  buttons plus chart, statistics, and text sections.
- `FormSchemaFromModel`, `SubmitButton`: helpers for building form schemas.
- `Detail`, `Paginated`, `SearchResults`: build the three action response
  shapes.
- `ModelToTableColumns`: reflects table columns from struct tags.
- `ModelToUISchema`: reflects RJSF uiSchema from struct tags.
- `MergeUISchema`: combines generated and override uiSchema values.
- `WithColumn`, `WithField`, `WithTableAction`: resource-level UI overrides.

Core actions are represented by `ActionType`: `view`, `edit`, `delete`,
`create`, `search`, and `export`.

### Custom page resources (`NewCustomResourcePage`)

Use `NewCustomResourcePage` for dashboard-like pages that are not a CRUD table
or form. The page schema supports top-level action buttons and three section
types: `charts`, `statistics`, and `text`. Chart sections support `bar` and
`line` charts.

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
                Title: "Overview",
                Statistics: []admin.Statistic{
                    {Label: "Published posts", Value: 17, Trend: "+12%", Tone: "positive"},
                },
            },
            {
                Type: admin.CustomPageSectionCharts,
                Title: "Traffic",
                Children: []admin.Chart{{
                    Type: admin.ChartTypeBar,
                    Data: []map[string]any{
                        {"day": "Mon", "views": 320},
                        {"day": "Tue", "views": 540},
                    },
                    XKey: "day",
                    YKey: "views",
                }},
            },
            {Type: admin.CustomPageSectionText, Title: "Notes", Body: "Review drafts weekly."},
        },
    },
}))
```

For server-side button actions, set an `ActionType` on the button and provide a
matching `Actions` handler in `CustomResourceConfig`. If a button has no
`OnClick`, the resource fills the default action URL automatically.

### Form-only / custom-action resources (`NewFormResource`)

`NewResource[T]` covers generic CRUD over a `DataSource`. For a settings page,
single-record configuration, or a bespoke action (e.g. "top up a user's
balance"), use `NewFormResource`: the host serves a dynamic JSON Schema and owns
the read/write handlers. The frontend renders the schema with
react-jsonschema-form, prefills it from `Fetch`, and posts submitted values to
`Act` — no per-resource frontend code and no protocol change (it reuses
`ResourceForm` / `FormSchema`).

```go
reg.Register(admin.NewFormResource(admin.FormResourceConfig{
    ID:   "app-config",
    Name: "App Config",
    Icon: "settings",
    Authorize: oidc.RequireRole("admin"),
    Schema: func(ctx context.Context, req admin.Request, _ admin.ActionType) (*admin.FormSchema, error) {
        // Return Type=ActionEdit so the UI prefills and submits the form.
        fs, err := admin.FormSchemaFromModel(ConfigForm{}, admin.ActionEdit, "Save",
            req.BasePath+"/resources/app-config/action?action=edit")
        if err != nil {
            return nil, err
        }
        // Inject values computed at request time, e.g. a model dropdown.
        if p, ok := fs.Schema.Properties.Get("default_host_model"); ok {
            p.Enum = liveModelIDs()
        }
        return fs, nil
    },
    Fetch: func(ctx context.Context, req admin.Request, _ admin.ActionType, _ map[string]any) (*admin.ActionResponse, error) {
        return admin.Detail(currentConfig()), nil // prefill
    },
    Act: func(ctx context.Context, req admin.Request, _ admin.ActionType, data map[string]any) (*admin.ActionResponse, error) {
        saveConfig(data)
        return admin.Detail(data), nil
    },
}))
```

Frontend interaction contract: the admin UI requests the schema for the `view`
action, so `Schema` is invoked with `ActionView` and must return a `*FormSchema`
whose `Type` is `ActionEdit`. `Fetch` and `Act` are then invoked with
`ActionEdit`. `req.DynamicPath` carries a sub-entity id (e.g. a target user id)
for per-row form actions.

## `adminhttp`

The `adminhttp` package mounts an `admin.Registry` as a `net/http` handler.

Main API:

- `New(registry, opts...) http.Handler`
- `WithBasePath(path)`
- `WithAuthenticator(authenticator)`
- `WithLogger(logger)`
- `Authenticator` and `AuthenticatorFunc`

The handler serves resource metadata, schemas, fetch actions, and write actions.
It maps core errors to HTTP status codes, including field-level validation
errors as HTTP 422.

## `datasource/gormds`

The `gormds` package adapts a `gorm.DB` to `admin.DataSource[T]`.

Main API:

- `New[T](db, opts...)`
- `WithPreloads[T](associations...)`
- `WithSearchFields[T](fields...)`
- `WithTitleField[T](field)`
- `WithOrder[T](clause)`

The adapter maps JSON field names to database columns through GORM schema
metadata. Unknown patch keys are ignored, and the primary key column is not
updated from client patches.

## `datasource/memory`

The `memory` package provides an in-memory `admin.DataSource[T]` for tests and
demos.

Main API:

- `New[T](opts...)`
- `Store[T].Seed(items...)`
- `WithIDField[T](name)`
- `WithSearchFields[T](fields...)`

IDs are read from the configured JSON ID field and auto-assigned when empty.

## `adminauth/oidc`

The OIDC helper package validates bearer tokens through an OIDC issuer and can
gate resource actions by role.

Use it with `adminhttp.WithAuthenticator` and resource-level authorization such
as `RequireRole("admin")`.

## `adminauth/jwt`

The JWT helper package is intended for development and tests. It supports HS256
authentication and token signing for local demo flows.
