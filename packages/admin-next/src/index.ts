// Client-safe exports: components, widgets, types, and the API client.
// Server-only helpers (config, actions, AdminApp) live in "@rxtech-lab/admin-generator-next/server".

export * from "./types.js";
export { AdminClient, AdminApiError } from "./api/client.js";
export type { AdminClientOptions } from "./api/client.js";

export { AdminShell } from "./components/admin-shell.js";
export { ResourceView } from "./components/resource-view.js";
export { ResourceTable } from "./components/resource-table.js";
export { ResourceForm } from "./components/resource-form.js";
export { CellRenderer, cellValue } from "./components/cell-renderer.js";
export { ForeignKeyWidget } from "./components/widgets/foreign-key.js";
export { AdminProvider, useAdmin } from "./components/context.js";
export { Button, Badge } from "./components/ui.js";
export { Sheet } from "./components/sheet.js";
export { renderTemplate } from "./lib/template-renderer.js";
export { cn } from "./lib/utils.js";
