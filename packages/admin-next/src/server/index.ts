// Server-only entry point. Import from "@rxtech-lab/admin-next/server" in RSC /
// server-action code. Do NOT import this from a client component.

export { AdminApp } from "./admin-app.js";
export type { AdminAppProps } from "./admin-app.js";
export { defineAdminConfig } from "./config.js";
export type { AdminConfig, ResolvedAdminConfig } from "./config.js";
export { createAdminActions } from "./actions.js";
export type { AdminActions, ActionResult } from "./actions.js";
