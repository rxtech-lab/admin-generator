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
- `Detail`, `Paginated`, `SearchResults`: build the three action response
  shapes.
- `ModelToTableColumns`: reflects table columns from struct tags.
- `ModelToUISchema`: reflects RJSF uiSchema from struct tags.
- `MergeUISchema`: combines generated and override uiSchema values.
- `WithColumn`, `WithField`, `WithTableAction`: resource-level UI overrides.

Core actions are represented by `ActionType`: `view`, `edit`, `delete`,
`create`, `search`, and `export`.

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
