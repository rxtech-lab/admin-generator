---
slug: getting-started
title: Getting Started
description: Minimal setup for a Go admin API and a Next.js admin UI.
---

# Getting Started

This repository publishes two packages:

- Go module: `github.com/rxtech-lab/admin-generator`
- npm package: `@rxtech-lab/admin-generator-next`

The Go service defines resources and serves the admin contract. The Next.js app
mounts the reusable admin UI and forwards user-scoped tokens to the Go service.

## Backend Setup

Create a registry, register resources, and mount the HTTP handler:

```go
reg := admin.NewRegistry()
reg.Register(admin.NewResource[models.Post](admin.ResourceConfig[models.Post]{
    ID:         "posts",
    Name:       "Posts",
    Icon:       "file-text",
    DataSource: gormds.New[models.Post](db, gormds.WithPreloads[models.Post]("Author")),
    CreateForm: dto.CreatePost{},
    EditForm:   dto.UpdatePost{},
}))

mux := http.NewServeMux()
mux.Handle("/admin/", adminhttp.New(reg, adminhttp.WithBasePath("/admin")))
```

Model tags drive the list and form schema:

```go
type Post struct {
    ID     uint   `json:"id" table:"order=0;pinned=true" jsonschema:"title=ID"`
    Title  string `json:"title" table:"order=1" jsonschema:"title=Title,required"`
    Status string `json:"status" table:"order=2;format=chip" jsonschema:"title=Status,enum=draft,enum=published"`
}
```

Use `validate` tags on DTOs for server-side form validation. Validation failures
are returned as HTTP 422 with per-field errors that the frontend can attach to
form inputs.

## Frontend Setup

Install the Next package:

```bash
bun add @rxtech-lab/admin-generator-next
```

Create a server-only config:

```ts
import { defineAdminConfig } from "@rxtech-lab/admin-generator-next/server";

export const adminConfig = defineAdminConfig({
  apiUrl: process.env.ADMIN_API_URL!,
  getToken: async () => (await auth())?.accessToken ?? null,
});
```

Create server actions:

```ts
"use server";

import { createAdminActions } from "@rxtech-lab/admin-generator-next/server";
import { adminConfig } from "@/lib/admin-config";

export const { listResources, getSchema, fetchAction, fetchUrl, submitAction } =
  createAdminActions(adminConfig);
```

Mount the app in a catch-all route:

```tsx
import { AdminApp } from "@rxtech-lab/admin-generator-next/server";
import { adminConfig } from "@/lib/admin-config";
import * as actions from "../actions";

export default function Page(props: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <AdminApp config={adminConfig} actions={actions} {...props} />;
}
```

Import the package styles in the app stylesheet:

```css
@import "tailwindcss";
@import "@rxtech-lab/admin-generator-next/theme.css";
@source "../node_modules/@rxtech-lab/admin-generator-next/dist";
```

## Demo

Run the demo API and web app:

```bash
cd examples/server && go run .
```

```bash
bun install
cd examples/web && bun run dev
```

Open the web example, sign in with the development login, and navigate to the
admin route.
