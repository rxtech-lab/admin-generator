---
slug: code/admin-next
title: Next Package Reference
description: Public exports of @rxtech-lab/admin-generator-next and its server entry point.
---

# Next Package Reference

The npm package is `@rxtech-lab/admin-generator-next`. It ships unbundled ESM
and keeps client-safe exports separate from server-only helpers.

## Client Entry Point

Import from `@rxtech-lab/admin-generator-next` in client-safe code.

Public exports include:

- `AdminClient` and `AdminApiError`
- `AdminShell`
- `ResourceView`
- `ResourceTable`
- `ResourceForm`
- `CellRenderer` and `cellValue`
- `ForeignKeyWidget`
- `AdminProvider` and `useAdmin`
- `Button`, `Badge`, and `Sheet`
- `renderTemplate`
- `cn`
- Shared wire types from `types.ts`

The shared TypeScript types mirror the Go wire contract: resources, schemas,
actions, buttons, table columns, form schemas, paginated responses, detail
responses, and search results.

## Server Entry Point

Import from `@rxtech-lab/admin-generator-next/server` only in React Server
Components or server-action files.

Public exports include:

- `AdminApp`
- `defineAdminConfig`
- `createAdminActions`
- Types: `AdminAppProps`, `AdminConfig`, `ResolvedAdminConfig`, `AdminActions`,
  and `ActionResult`

`defineAdminConfig` fills defaults for:

- `apiBasePath`: default `/admin`
- `basePath`: default `/admin`

`createAdminActions` returns the five server actions the UI needs:

- `listResources`
- `getSchema`
- `fetchAction`
- `fetchUrl`
- `submitAction`

Each action returns an `ActionResult<T>` envelope. API errors are returned as
plain data rather than thrown so client components can render status codes and
field-level validation errors.

## CSS Entry Point

Import the theme from global CSS:

```css
@import "@rxtech-lab/admin-generator-next/theme.css";
```

When using Tailwind v4, include the package output as a source:

```css
@source "../node_modules/@rxtech-lab/admin-generator-next/dist";
```

## Routing Contract

`AdminApp` is designed for a catch-all route such as:

```tsx
app/admin/[[...slug]]/page.tsx
```

The first slug segment is the resource ID. Additional segments are passed as the
resource dynamic path. The `action` query parameter selects the schema/action,
defaulting to `view`.
