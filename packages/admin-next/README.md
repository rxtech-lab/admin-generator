# @rxtech-lab/admin-generator-next

Schema-driven admin UI for Next.js. Renders admin list tables and create/edit
forms from a backend JSON schema — pairs with the
[`admin-generator`](https://github.com/rxtech-lab/admin-generator) Go package.

## Install

```bash
bun add @rxtech-lab/admin-generator-next
# peers: next >= 15, react >= 19, react-dom >= 19, tailwindcss v4
```

## Usage

```ts
// lib/admin-config.ts (server-only)
import { defineAdminConfig } from "@rxtech-lab/admin-generator-next/server";
export const adminConfig = defineAdminConfig({
  apiUrl: process.env.ADMIN_API_URL!,
  getToken: async () => (await auth())?.accessToken ?? null,
});
```

```ts
// app/admin/actions.ts
"use server";
import { createAdminActions } from "@rxtech-lab/admin-generator-next/server";
import { adminConfig } from "@/lib/admin-config";
export const { listResources, getSchema, fetchAction, fetchUrl, submitAction } =
  createAdminActions(adminConfig);
```

```tsx
// app/admin/[[...slug]]/page.tsx
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

```css
/* app/globals.css */
@import "tailwindcss";
@import "@rxtech-lab/admin-generator-next/theme.css";
@source "../node_modules/@rxtech-lab/admin-generator-next/dist";
```

## Exports

- `@rxtech-lab/admin-generator-next` — client components (`AdminShell`, `ResourceTable`,
  `ResourceForm`, `ForeignKeyWidget`, `CellRenderer`, `AdminClient`), types.
- `@rxtech-lab/admin-generator-next/server` — `AdminApp`, `defineAdminConfig`,
  `createAdminActions` (import only from server / server-action code).
- `@rxtech-lab/admin-generator-next/theme.css` — design tokens + baseline form styles.

## Notes

- Ships unbundled ESM with `"use client"` directives intact; your Next build
  bundles it. Add it to `transpilePackages` when consuming from a workspace.
- Server actions are owned by your app (the tiny `actions.ts` above) so
  `getToken` can read your session — this is the supported Next 15 pattern for
  configurable actions from a library.

## License

MIT
