"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
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
  /** Brand shown at the top-left of the app header. Defaults to "Admin". */
  title?: React.ReactNode;
  /** Custom content rendered at the top-right of the app header. */
  headerActions?: React.ReactNode;
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
  title,
  headerActions,
}: AdminShellProps): React.JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);
  const activeResource = resources.find((r) => r.id === activeResourceId);
  const pageTitle = activeResource?.name ?? "Resources";

  return (
    <AdminProvider actions={actions}>
      <div
        className="ag-root flex min-h-screen bg-muted/40 text-foreground"
        style={
          {
            "--sidebar-width": "18rem",
            "--sidebar-collapsed-width": "4.25rem",
            "--header-height": "3.5rem",
          } as React.CSSProperties
        }
      >
        <aside
          className={cn(
            "ag-sidebar hidden shrink-0 p-2 pr-0 transition-[width] duration-200 md:block md:py-3 md:pl-3",
            sidebarCollapsed
              ? "w-[var(--sidebar-collapsed-width)]"
              : "w-[var(--sidebar-width)]",
          )}
        >
          <SidebarContent
            basePath={basePath}
            resources={resources}
            activeResourceId={activeResourceId}
            title={title}
            collapsed={sidebarCollapsed}
          />
        </aside>

        <div className="flex min-w-0 flex-1 p-2 md:py-3 md:pr-3">
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <header className="ag-header sticky top-0 z-40 flex h-[var(--header-height)] shrink-0 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:px-6">
              <button
                type="button"
                className="hidden size-9 items-center justify-center rounded-md text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:inline-flex"
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!sidebarCollapsed}
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              >
                <Icons.PanelLeft className="size-4" />
              </button>
              <MobileSidebar
                basePath={basePath}
                resources={resources}
                activeResourceId={activeResourceId}
                title={title}
              />
              <div className="hidden h-5 w-px bg-border md:block" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{pageTitle}</div>
                {activeResource?.description ? (
                  <div className="truncate text-xs text-muted-foreground">
                    {activeResource.description}
                  </div>
                ) : null}
              </div>
              {headerActions ? (
                <div className="flex shrink-0 items-center gap-3">
                  {headerActions}
                </div>
              ) : null}
            </header>

            <main className="@container/main flex flex-1 flex-col overflow-x-auto">
              <div className="flex flex-1 flex-col gap-4 p-4 md:gap-6 md:p-6">
                {error ? (
                  <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
                    {error}
                  </div>
                ) : initialView ? (
                  <ResourceView
                    key={`${initialView.resourceId}:${initialView.dynamicPath ?? ""}`}
                    basePath={basePath}
                    resource={activeResource}
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
              </div>
            </main>
          </div>
        </div>
      </div>
    </AdminProvider>
  );
}

function SidebarContent({
  basePath,
  resources,
  activeResourceId,
  title,
  onNavigate,
  collapsed,
}: {
  basePath: string;
  resources: ResourceInfo[];
  activeResourceId?: string;
  title?: React.ReactNode;
  onNavigate?: () => void;
  collapsed?: boolean;
}): React.JSX.Element {
  return (
    <div className="flex min-h-full flex-col">
      <a
        href={basePath}
        className={cn(
          "flex h-[var(--header-height)] items-center gap-2 px-3 text-sm font-semibold",
          collapsed && "justify-center px-2",
        )}
        onClick={onNavigate}
      >
        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Icons.LayoutDashboard className="size-4" />
        </span>
        <span className={cn("truncate", collapsed && "sr-only")}>
          {title ?? "Admin"}
        </span>
      </a>
      <nav className="flex flex-1 flex-col gap-1 p-2">
        {resources.map((r) => (
          <a
            key={r.id}
            href={`${basePath}/${r.id}`}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
              collapsed && "justify-center px-2",
              r.id === activeResourceId &&
                "bg-accent font-medium text-accent-foreground",
            )}
            onClick={onNavigate}
          >
            <LucideIcon name={r.icon} className="size-4 shrink-0" />
            <span className={cn("truncate", collapsed && "sr-only")}>
              {r.name}
            </span>
          </a>
        ))}
      </nav>
    </div>
  );
}

function MobileSidebar({
  basePath,
  resources,
  activeResourceId,
  title,
}: {
  basePath: string;
  resources: ResourceInfo[];
  activeResourceId?: string;
  title?: React.ReactNode;
}): React.JSX.Element {
  const [open, setOpen] = React.useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        className="inline-flex size-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:hidden"
        aria-label="Open navigation"
      >
        <Icons.PanelLeft className="size-4" />
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="ag-mobile-sidebar-overlay fixed inset-0 z-50 bg-black/40 md:hidden" />
        <Dialog.Content className="ag-mobile-sidebar fixed inset-y-0 left-0 z-50 w-[min(18rem,85vw)] border-r border-border bg-card shadow-lg md:hidden">
          <Dialog.Title className="sr-only">Navigation</Dialog.Title>
          <SidebarContent
            basePath={basePath}
            resources={resources}
            activeResourceId={activeResourceId}
            title={title}
            onNavigate={() => setOpen(false)}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
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
