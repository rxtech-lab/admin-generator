---
slug: architecture/overview
title: Architecture Overview
description: How admin-generator connects Go resource schemas, CRUD handlers, data sources, and the Next.js admin UI.
---

# Architecture Overview

`admin-generator` builds a schema-driven admin panel from Go resource definitions.
The backend owns the resource registry, table schemas, form schemas, validation,
authorization, and CRUD execution. The frontend package renders those backend
contracts in a Next.js app without per-resource pages.

## Main Components

| Path | Responsibility |
| --- | --- |
| `admin/` | Core resource model, registry, generic CRUD resource, table reflection, JSON Schema form reflection, validation errors, and shared wire types. |
| `adminhttp/` | Router-agnostic `net/http` handler that exposes registered resources through the admin HTTP contract. |
| `datasource/gormds/` | GORM-backed `admin.DataSource` implementation with preloads, field mapping, filtering, search, and cursor-like offset pagination. |
| `datasource/memory/` | In-memory `admin.DataSource` implementation for tests and demos. |
| `adminauth/oidc/` | OIDC bearer-token authenticator and role authorization helpers. |
| `adminauth/jwt/` | Development HS256 authenticator and token signer. |
| `packages/admin-next/` | Published Next.js/React package that renders resource lists, forms, actions, sheets, and widgets from the backend schema. |
| `examples/server/` | Runnable Go API example using SQLite and seeded resources. |
| `examples/web/` | Runnable Next.js example consuming `@rxtech-lab/admin-generator-next`. |

## Request Flow

1. The application creates an `admin.Registry`.
2. Each model is registered as an `admin.Resource`, usually with
   `admin.NewResource[T]` and an `admin.DataSource[T]`.
3. `adminhttp.New(registry)` exposes the registry as HTTP endpoints under a
   mount path such as `/admin`.
4. A Next.js app configures `@rxtech-lab/admin-generator-next/server` with the
   Go API URL and an optional bearer-token callback.
5. The catch-all admin route renders `<AdminApp>`, which fetches resource
   metadata, the current resource schema, and the first page of data server-side.
6. Client components use server actions from `createAdminActions` for pagination,
   form submissions, sheets, deletes, searches, and arbitrary schema-backed
   actions.

## Schema Ownership

The backend is the source of truth for what the UI can display and execute:

- `table` tags on model structs become list-view columns.
- `jsonschema` tags and DTO structs become create/edit form schemas.
- `uischema` tags become React JSON Schema Form widget configuration.
- `validate` tags are enforced on the server and return field-level 422 errors.
- `ResourceConfig.Actions` and `Authorize` determine which actions are allowed.

The frontend mirrors the wire types in TypeScript and renders the contract it
receives. It does not duplicate resource-specific schemas or validation rules.

## Extension Points

Use `admin.Resource` directly when a resource needs custom behavior beyond the
generic CRUD implementation. Use `ResourceOption` helpers such as `WithColumn`,
`WithField`, and `WithTableAction` for smaller presentation overrides while
keeping the standard CRUD lifecycle.

Persistence is pluggable through `admin.DataSource[T]`. The repository ships
GORM and memory implementations, and applications can provide their own data
source for another database, external API, or computed resource.
