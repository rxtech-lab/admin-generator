import { AdminApiError } from "../api/client.js";
import type {
  ActionResponse,
  ActionType,
  ResourceInfo,
  ResourceSchema,
} from "../types.js";
import { clientFor, type ResolvedAdminConfig } from "./config.js";

/**
 * Result envelope returned by the action functions. Errors are returned (not
 * thrown) so they cross the server-action boundary as plain data the client
 * components can render — including 422 field errors for forms.
 */
export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number; fieldErrors?: Record<string, string> };

function toResult<T>(promise: Promise<T>): Promise<ActionResult<T>> {
  return promise
    .then((data) => ({ ok: true as const, data }))
    .catch((err: unknown) => {
      if (err instanceof AdminApiError) {
        return {
          ok: false as const,
          error: err.message,
          status: err.status,
          fieldErrors: err.fieldErrors,
        };
      }
      return { ok: false as const, error: (err as Error).message };
    });
}

/**
 * The set of server-callable functions the admin UI uses. Bind them to your
 * config in a "use server" module in your app:
 *
 *   "use server";
 *   export const adminActions = createAdminActions(adminConfig);
 */
export interface AdminActions {
  listResources: () => Promise<ActionResult<ResourceInfo[]>>;
  getSchema: (
    id: string,
    action: ActionType,
    dynamicPath?: string,
  ) => Promise<ActionResult<ResourceSchema>>;
  fetchAction: (
    id: string,
    action: ActionType,
    opts?: { dynamicPath?: string; after?: string; limit?: number; formData?: unknown },
  ) => Promise<ActionResult<ActionResponse>>;
  fetchUrl: (url: string) => Promise<ActionResult<ActionResponse>>;
  submitAction: (
    id: string,
    action: ActionType,
    data: Record<string, unknown>,
    dynamicPath?: string,
  ) => Promise<ActionResult<ActionResponse>>;
}

export function createAdminActions(config: ResolvedAdminConfig): AdminActions {
  return {
    async listResources() {
      const client = await clientFor(config);
      return toResult(client.listResources());
    },
    async getSchema(id, action, dynamicPath) {
      const client = await clientFor(config);
      return toResult(client.getSchema(id, action, dynamicPath));
    },
    async fetchAction(id, action, opts) {
      const client = await clientFor(config);
      return toResult(client.fetchAction(id, action, opts));
    },
    async fetchUrl(url) {
      const client = await clientFor(config);
      return toResult(client.fetchUrl(url));
    },
    async submitAction(id, action, data, dynamicPath) {
      const client = await clientFor(config);
      return toResult(client.postAction(id, action, data, dynamicPath));
    },
  };
}
