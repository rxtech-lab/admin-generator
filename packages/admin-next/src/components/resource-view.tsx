"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  ActionButton,
  ActionType,
  DetailResponse,
  PaginatedResponse,
  ResourceInfo,
  ResourceSchema,
  TableColumn,
} from "../types.js";
import {
  isCustomResourcePage,
  isFormSchema,
  isPaginated,
  isTableSchema,
} from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ResourceTable } from "./resource-table.js";
import { ResourceForm } from "./resource-form.js";
import { CustomResourcePageView } from "./custom-resource-page.js";
import { CellRenderer } from "./cell-renderer.js";
import { Sheet } from "./sheet.js";
import { Button } from "./ui.js";

export interface ResourceViewProps {
  basePath: string;
  resource?: ResourceInfo;
  resourceId: string;
  action: ActionType;
  dynamicPath?: string;
  schema: ResourceSchema;
  initialPageUrl?: string;
  initialData?: PaginatedResponse;
  initialDetail?: DetailResponse;
  actions: AdminActions;
}

interface SheetState {
  action: "create" | "edit";
  dynamicPath?: string;
}

export function ResourceView(props: ResourceViewProps): React.JSX.Element {
  const { resource, resourceId, schema, actions } = props;
  const router = useRouter();
  const initialPageUrl =
    props.initialPageUrl ??
    resource?.dataUrl ??
    `${props.basePath}/resources/${encodeURIComponent(resourceId)}/action?action=view`;
  const [data, setData] = React.useState<PaginatedResponse | undefined>(
    props.initialData,
  );
  const [currentPageUrl, setCurrentPageUrl] = React.useState(initialPageUrl);
  const [sheet, setSheet] = React.useState<SheetState | null>(null);
  const [sheetHasUnsavedData, setSheetHasUnsavedData] = React.useState(false);
  const [pending, setPending] = React.useState(false);

  const fetchPage = React.useCallback(
    async (url: string, opts: { syncBrowserUrl?: boolean } = {}) => {
      setPending(true);
      const res = await actions.fetchUrl(url);
      setPending(false);
      if (res.ok && isPaginated(res.data)) {
        setData(res.data);
        setCurrentPageUrl(url);
        if (opts.syncBrowserUrl) syncPaginationUrl(url);
      }
    },
    [actions],
  );

  const refresh = React.useCallback(
    async () => {
      await fetchPage(currentPageUrl);
    },
    [currentPageUrl, fetchPage],
  );

  const navigateTo = React.useCallback(
    (href: string) => {
      if (/^https?:\/\//i.test(href)) {
        window.open(href, "_blank", "noopener,noreferrer");
        return;
      }
      router.push(href);
    },
    [router],
  );

  const runPageAction = async (button: ActionButton) => {
    if (button.behavior === "navigate") {
      navigateTo(button.onClick);
      return;
    }
    if (
      button.behavior === "confirmDialog" &&
      !confirm(`Run ${button.label}?`)
    ) {
      return;
    }
    setPending(true);
    const res = await actions.submitAction(
      resourceId,
      button.actionType,
      {},
      props.dynamicPath,
    );
    setPending(false);
    if (res.ok) router.refresh();
    else alert(res.error);
  };

  // If the initial schema is a form (deep-linked create/edit), render it inline.
  if (isFormSchema(schema)) {
    return (
      <div className="mx-auto max-w-2xl">
        <Header
          title={resource?.name ?? resourceId}
          description={resource?.description}
        />
        <ResourceForm
          resourceId={resourceId}
          action={schema.type as "create" | "edit"}
          dynamicPath={props.dynamicPath}
          schema={schema}
          actions={actions}
          onDone={() => history.back()}
        />
      </div>
    );
  }

  if (isCustomResourcePage(schema)) {
    return (
      <div>
        <div className="mb-4">
          <Header
            title={resource?.name ?? resourceId}
            description={resource?.description}
          />
        </div>
        <CustomResourcePageView
          schema={schema}
          pending={pending}
          onAction={runPageAction}
        />
      </div>
    );
  }

  const runRowAction = async (
    button: ActionButton,
    row: Record<string, unknown>,
  ) => {
    if (button.behavior === "navigate") {
      navigateTo(button.onClick);
      return;
    }
    const dynamicPath = extractDynamicPath(button.onClick);
    if (button.actionType === "edit") {
      setSheetHasUnsavedData(false);
      setSheet({ action: "edit", dynamicPath });
    } else if (button.actionType === "delete") {
      const label = String(row.title ?? row.name ?? row.id ?? "this item");
      if (!confirm(`Delete ${label}? This cannot be undone.`)) return;
      const res = await actions.submitAction(resourceId, "delete", {}, dynamicPath);
      if (res.ok) refresh();
      else alert(res.error);
    }
  };

  return (
    <div>
      {isTableSchema(schema) && props.dynamicPath && props.initialDetail ? (
        <ResourceDetail
          basePath={props.basePath}
          resourceId={resourceId}
          resource={resource}
          dynamicPath={props.dynamicPath}
          columns={schema.columns}
          detail={props.initialDetail}
        />
      ) : (
        <>
          <div className="mb-4 flex items-center justify-between">
            <Header
              title={resource?.name ?? resourceId}
              description={resource?.description}
            />
            {resource?.supportedActions?.some((a) => a.actionType === "create") && (
              <Button
                onClick={() => {
                  setSheetHasUnsavedData(false);
                  setSheet({ action: "create" });
                }}
              >
                + Create
              </Button>
            )}
          </div>

          {isTableSchema(schema) && (
            <ResourceTable
              schema={schema}
              data={data}
              pending={pending}
              onRowAction={runRowAction}
              getRowHref={(item) =>
                item.dynamicPath
                  ? buildResourcePath(props.basePath, resourceId, item.dynamicPath)
                  : undefined
              }
              onNavigate={(url) => {
                fetchPage(url, { syncBrowserUrl: true });
              }}
              onRowNavigate={(url) => router.push(url)}
            />
          )}
        </>
      )}

      <Sheet
        open={sheet !== null}
        title={
          sheet?.action === "edit"
            ? `Edit ${resource?.name ?? ""}`
            : `Create ${resource?.name ?? ""}`
        }
        onClose={() => {
          if (
            sheetHasUnsavedData &&
            !confirm("Close this form? This will remove all data you entered.")
          ) {
            return;
          }
          setSheetHasUnsavedData(false);
          setSheet(null);
        }}
      >
        {sheet && (
          <SheetForm
            resourceId={resourceId}
            action={sheet.action}
            dynamicPath={sheet.dynamicPath}
            actions={actions}
            onDirtyChange={setSheetHasUnsavedData}
            onDone={() => {
              setSheetHasUnsavedData(false);
              setSheet(null);
              refresh();
            }}
          />
        )}
      </Sheet>
    </div>
  );
}

function ResourceDetail({
  basePath,
  resourceId,
  resource,
  dynamicPath,
  columns,
  detail,
}: {
  basePath: string;
  resourceId: string;
  resource?: ResourceInfo;
  dynamicPath: string;
  columns: TableColumn[];
  detail: DetailResponse;
}): React.JSX.Element {
  const data = detail.data;
  const title = String(data.title ?? data.name ?? data.id ?? dynamicPath);

  return (
    <div>
      <div className="mb-4">
        <Link
          href={buildResourcePath(basePath, resourceId)}
          className="mb-2 inline-flex text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          Back to {resource?.name ?? resourceId}
        </Link>
        <Header title={title} description={resource?.name ?? resourceId} />
      </div>

      <div className="rounded-lg border border-border">
        <dl className="divide-y divide-border">
          {columns.map((column) => (
            <div
              key={column.name}
              className="grid gap-1 px-4 py-3 sm:grid-cols-[12rem_minmax(0,1fr)] sm:gap-4"
            >
              <dt className="text-sm font-medium text-muted-foreground">
                {column.label}
              </dt>
              <dd className="min-w-0 text-sm">
                <CellRenderer column={column} row={data} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function buildResourcePath(
  basePath: string,
  resourceId: string,
  dynamicPath?: string,
): string {
  const parts = [basePath.replace(/\/+$/, ""), encodeURIComponent(resourceId)];
  if (dynamicPath) {
    parts.push(...dynamicPath.split("/").filter(Boolean).map(encodeURIComponent));
  }
  return parts.join("/");
}

function Header({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">{title}</h1>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Loads the form schema for a create/edit sheet, then renders the form. */
function SheetForm({
  resourceId,
  action,
  dynamicPath,
  actions,
  onDirtyChange,
  onDone,
}: {
  resourceId: string;
  action: "create" | "edit";
  dynamicPath?: string;
  actions: AdminActions;
  onDirtyChange: (dirty: boolean) => void;
  onDone: () => void;
}): React.JSX.Element {
  const [schema, setSchema] = React.useState<ResourceSchema | null>(null);
  const [error, setError] = React.useState<string>();

  React.useEffect(() => {
    let active = true;
    actions.getSchema(resourceId, action, dynamicPath).then((res) => {
      if (!active) return;
      if (res.ok) setSchema(res.data);
      else setError(res.error);
    });
    return () => {
      active = false;
    };
  }, [actions, resourceId, action, dynamicPath]);

  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (!schema || !isFormSchema(schema))
    return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <ResourceForm
      resourceId={resourceId}
      action={action}
      dynamicPath={dynamicPath}
      schema={schema}
      actions={actions}
      onDirtyChange={onDirtyChange}
      onDone={onDone}
    />
  );
}

/** Pull the dynamicPath query param out of a server-emitted onClick URL. */
function extractDynamicPath(onClick: string): string | undefined {
  try {
    return new URL(onClick, "http://x").searchParams.get("dynamicPath") ?? undefined;
  } catch {
    return undefined;
  }
}

function syncPaginationUrl(pageUrl: string): void {
  if (typeof window === "undefined") return;

  const source = new URL(pageUrl, window.location.origin);
  const target = new URL(window.location.href);
  copySearchParam(source, target, "after");
  copySearchParam(source, target, "limit");

  window.history.replaceState(
    window.history.state,
    "",
    `${target.pathname}${target.search}${target.hash}`,
  );
}

function copySearchParam(source: URL, target: URL, name: string): void {
  const value = source.searchParams.get(name);
  if (value) target.searchParams.set(name, value);
  else target.searchParams.delete(name);
}
