import * as React from "react";
import type {
  ActionType,
  DetailResponse,
  PaginatedResponse,
  ResourceInfo,
  ResourceSchema,
} from "../types.js";
import { isDetail, isPaginated } from "../types.js";
import { AdminShell } from "../components/admin-shell.js";
import type { AdminActions } from "./actions.js";
import { clientFor, type ResolvedAdminConfig } from "./config.js";

export interface AdminAppProps {
  config: ResolvedAdminConfig;
  /** Server actions bound to the same config (from a "use server" module). */
  actions: AdminActions;
  /** Next.js dynamic route params: the catch-all slug segments. */
  params: Promise<{ slug?: string[] }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

interface InitialView {
  resourceId: string;
  action: ActionType;
  dynamicPath?: string;
  schema: ResourceSchema;
  initialData?: PaginatedResponse;
  initialDetail?: DetailResponse;
}

/**
 * AdminApp is a React Server Component: it SSRs the sidebar and the current
 * resource's schema + first page of data, then hands off to the client shell
 * for interaction. Mount it in one catch-all route:
 *
 *   app/admin/[[...slug]]/page.tsx
 */
export async function AdminApp({
  config,
  actions,
  params,
  searchParams,
}: AdminAppProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const sp = (await searchParams) ?? {};
  const client = await clientFor(config);

  let resources: ResourceInfo[] = [];
  let error: string | undefined;
  try {
    resources = await client.listResources();
  } catch (e) {
    error = (e as Error).message;
  }

  const resourceId = slug?.[0];
  const dynamicPath = slug && slug.length > 1 ? slug.slice(1).join("/") : undefined;
  const action = (typeof sp.action === "string" ? sp.action : "view") as ActionType;

  let initialView: InitialView | undefined;
  if (resourceId && !error) {
    try {
      const schema = await client.getSchema(resourceId, action, dynamicPath);
      let initialData: PaginatedResponse | undefined;
      let initialDetail: DetailResponse | undefined;
      if (action === "view") {
        const resp = await client.fetchAction(resourceId, "view", { dynamicPath });
        if (isPaginated(resp)) initialData = resp;
        else if (isDetail(resp)) initialDetail = resp;
      }
      initialView = { resourceId, action, dynamicPath, schema, initialData, initialDetail };
    } catch (e) {
      error = (e as Error).message;
    }
  }

  // Normalize actions into a plain object: consumers typically pass a module
  // namespace (import * as actions), which React can't forward to a client
  // component as-is. The individual server-action refs are serializable.
  const plainActions: AdminActions = {
    listResources: actions.listResources,
    getSchema: actions.getSchema,
    fetchAction: actions.fetchAction,
    fetchUrl: actions.fetchUrl,
    submitAction: actions.submitAction,
  };

  return (
    <AdminShell
      basePath={config.basePath}
      resources={resources}
      activeResourceId={resourceId}
      initialView={initialView}
      actions={plainActions}
      error={error}
    />
  );
}
