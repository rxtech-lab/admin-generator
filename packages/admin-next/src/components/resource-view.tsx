"use client";

import * as React from "react";
import Link from "next/link";
import type {
  ActionButton,
  ActionType,
  DetailResponse,
  PaginatedResponse,
  ResourceInfo,
  ResourceSchema,
  TableColumn,
} from "../types.js";
import { isFormSchema, isPaginated, isTableSchema } from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ResourceTable } from "./resource-table.js";
import { ResourceForm } from "./resource-form.js";
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
  const [data, setData] = React.useState<PaginatedResponse | undefined>(
    props.initialData,
  );
  const [sheet, setSheet] = React.useState<SheetState | null>(null);
  const [pending, setPending] = React.useState(false);

  const refresh = React.useCallback(
    async (after?: string) => {
      setPending(true);
      const res = await actions.fetchAction(resourceId, "view", {
        dynamicPath: props.dynamicPath,
        after,
      });
      setPending(false);
      if (res.ok && isPaginated(res.data)) setData(res.data);
    },
    [actions, resourceId, props.dynamicPath],
  );

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

  const runRowAction = async (
    button: ActionButton,
    row: Record<string, unknown>,
  ) => {
    const dynamicPath = extractDynamicPath(button.onClick);
    if (button.actionType === "edit") {
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
              <Button onClick={() => setSheet({ action: "create" })}>
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
                const after =
                  new URL(url, "http://x").searchParams.get("after") ?? undefined;
                refresh(after);
              }}
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
        onClose={() => setSheet(null)}
      >
        {sheet && (
          <SheetForm
            resourceId={resourceId}
            action={sheet.action}
            dynamicPath={sheet.dynamicPath}
            actions={actions}
            onDone={() => {
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
  onDone,
}: {
  resourceId: string;
  action: "create" | "edit";
  dynamicPath?: string;
  actions: AdminActions;
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
