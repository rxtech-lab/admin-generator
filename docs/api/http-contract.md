---
slug: api/http-contract
title: HTTP API Contract
description: The backend endpoints consumed by the Next.js admin UI.
---

# HTTP API Contract

`adminhttp.New` exposes a small JSON contract under a configurable base path.
The default base path is `/admin`.

The OpenAPI description is committed at `docs/api/openapi.yaml`. The runtime
schema for each resource remains dynamic because resources are registered by the
host Go application.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `{base}/resources` | List registered resources and navigation metadata. |
| `GET` | `{base}/resources/{id}` | Get metadata for one resource. |
| `GET` | `{base}/resources/{id}/schema?action=&dynamicPath=` | Get the table or form schema for an action. Defaults to `view`. |
| `GET` | `{base}/resources/{id}/action?action=&dynamicPath=&after=&limit=&formData=` | Fetch action data, including list pages, detail data when `action=view&dynamicPath=...`, edit prefill data, and search results. |
| `POST` | `{base}/resources/{id}/action` | Execute write-side actions such as create, edit, delete, or search POSTs. |

## Resource Metadata

Resource metadata builds the admin navigation and default actions:

```json
{
  "id": "posts",
  "name": "Posts",
  "description": "Editorial posts",
  "icon": "file-text",
  "type": "table",
  "dataUrl": "/admin/resources/posts/action?action=view",
  "defaultAction": "view",
  "supportedActions": [
    {
      "type": "primary",
      "label": "Create",
      "icon": "plus",
      "behavior": "openSheet",
      "actionType": "create",
      "onClick": "/admin/resources/posts/action?action=create"
    }
  ]
}
```

## Schemas

List schemas have `uiType: "table"` and a list of columns:

```json
{
  "uiType": "table",
  "type": "view",
  "columns": [
    { "name": "id", "label": "ID", "type": "number", "pinned": true },
    { "name": "title", "label": "Title", "type": "string", "pinned": false }
  ]
}
```

Create and edit schemas have `uiType: "form"`, a JSON Schema payload, an RJSF
`uiSchema`, and submit actions:

```json
{
  "uiType": "form",
  "type": "create",
  "schema": { "type": "object", "properties": {} },
  "uiSchema": {},
  "supportedActions": [
    {
      "type": "primary",
      "label": "Create",
      "icon": "check",
      "behavior": "submit",
      "actionType": "create",
      "onClick": "/admin/resources/posts/action?action=create"
    }
  ]
}
```

Custom page schemas have `uiType: "custom"`, top-level action buttons, and
ordered sections:

```json
{
  "uiType": "custom",
  "type": "view",
  "actionButtons": [
    {
      "type": "secondary",
      "label": "Open Posts",
      "icon": "file-text",
      "behavior": "navigate",
      "actionType": "view",
      "onClick": "/admin/posts"
    }
  ],
  "sections": [
    {
      "type": "statistics",
      "title": "Overview",
      "statistics": [{ "label": "Published posts", "value": 17 }]
    },
    {
      "type": "charts",
      "title": "Traffic",
      "children": [
        {
          "type": "bar",
          "title": "Views",
          "data": [{ "day": "Mon", "views": 320 }],
          "xKey": "day",
          "yKey": "views"
        }
      ]
    },
    { "type": "text", "body": "Operational notes" }
  ]
}
```

## Action Responses

`ActionResponse` is one of three wire shapes:

- Detail: `{"data": {...}}`
- Paginated list: `{"items": [...], "actions": [...], "nextUrl": "...", "previousUrl": "..."}`
- Search results: `[{"title": "...", "description": "...", "value": "..."}]`

List items include row data, optional row actions, and `dynamicPath` when the
row can be opened as a detail route:

```json
{
  "data": { "id": 1, "title": "First" },
  "dynamicPath": "1",
  "actions": []
}
```

## Errors

The HTTP layer maps core errors to stable status codes:

| Status | Meaning |
| --- | --- |
| `400` | Bad action, malformed input, or unsupported action. |
| `401` | Authenticator rejected the request. |
| `403` | Resource authorization denied the action. |
| `404` | Resource or item was not found. |
| `422` | Validation failed. The response includes a `fields` object keyed by JSON field name. |
| `500` | Unexpected backend error. |

Validation error example:

```json
{
  "error": "validation failed",
  "fields": {
    "title": "title is required"
  }
}
```
