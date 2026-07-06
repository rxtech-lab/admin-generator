"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type {
  ActionType,
  DetailResponse,
  PaginatedResponse,
  ResourceInfo,
  ResourceSchema,
} from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { cn } from "../lib/utils.js";
import { AdminProvider } from "./context.js";
import { ResourceView } from "./resource-view.js";

export interface AdminShellProps {
  basePath: string;
  resources: ResourceInfo[];
  activeResourceId?: string;
  initialView?: {
    resourceId: string;
    action: ActionType;
    dynamicPath?: string;
    schema: ResourceSchema;
    initialData?: PaginatedResponse;
    initialDetail?: DetailResponse;
  };
  actions: AdminActions;
  error?: string;
}

/** Look up a lucide icon by its kebab/pascal name, with a sane fallback. */
function LucideIcon({ name, className }: { name: string; className?: string }) {
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      pascal
    ] ?? Icons.Circle;
  return <Cmp className={className} />;
}

export function AdminShell({
  basePath,
  resources,
  activeResourceId,
  initialView,
  actions,
  error,
}: AdminShellProps): React.JSX.Element {
  return (
    <AdminProvider actions={actions}>
    <div className="ag-root flex min-h-screen bg-background text-foreground">
      <aside className="ag-sidebar hidden w-64 shrink-0 border-r border-border bg-card md:block">
        <div className="flex h-14 items-center border-b border-border px-4 font-semibold">
          Admin
        </div>
        <nav className="flex flex-col gap-0.5 p-2">
          {resources.map((r) => (
            <a
              key={r.id}
              href={`${basePath}/${r.id}`}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                r.id === activeResourceId &&
                  "bg-accent font-medium text-accent-foreground",
              )}
            >
              <LucideIcon name={r.icon} className="size-4" />
              {r.name}
            </a>
          ))}
        </nav>
      </aside>

      <main className="flex-1 overflow-x-auto p-6">
        {error ? (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        ) : initialView ? (
          <ResourceView
            key={`${initialView.resourceId}:${initialView.dynamicPath ?? ""}`}
            basePath={basePath}
            resource={resources.find((r) => r.id === initialView.resourceId)}
            resourceId={initialView.resourceId}
            action={initialView.action}
            dynamicPath={initialView.dynamicPath}
            schema={initialView.schema}
            initialData={initialView.initialData}
            initialDetail={initialView.initialDetail}
            actions={actions}
          />
        ) : (
          <Dashboard resources={resources} basePath={basePath} />
        )}
      </main>
    </div>
    </AdminProvider>
  );
}

function Dashboard({
  resources,
  basePath,
}: {
  resources: ResourceInfo[];
  basePath: string;
}): React.JSX.Element {
  return (
    <div>
      <h1 className="mb-4 text-2xl font-semibold">Resources</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => (
          <a
            key={r.id}
            href={`${basePath}/${r.id}`}
            className="rounded-lg border border-border bg-card p-4 transition-shadow hover:shadow-sm"
          >
            <div className="mb-1 flex items-center gap-2 font-medium">
              <LucideIcon name={r.icon} className="size-4" />
              {r.name}
            </div>
            <p className="text-sm text-muted-foreground">{r.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
