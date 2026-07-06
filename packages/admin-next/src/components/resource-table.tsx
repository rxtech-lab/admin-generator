"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import type {
  ActionButton,
  Item,
  PaginatedResponse,
  TableSchema,
} from "../types.js";
import { CellRenderer } from "./cell-renderer.js";
import { Button, buttonVariantFor } from "./ui.js";
import { cn } from "../lib/utils.js";

export interface ResourceTableProps {
  schema: TableSchema;
  data?: PaginatedResponse;
  pending?: boolean;
  onRowAction: (button: ActionButton, row: Record<string, unknown>) => void;
  onNavigate: (url: string) => void;
  getRowHref?: (item: Item) => string | undefined;
  onRowNavigate?: (url: string) => void;
}

function ActionIcon({ name }: { name: string }) {
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      pascal
    ] ?? null;
  return Cmp ? <Cmp className="size-3.5" /> : null;
}

export function ResourceTable({
  schema,
  data,
  pending,
  onRowAction,
  onNavigate,
  getRowHref,
  onRowNavigate,
}: ResourceTableProps): React.JSX.Element {
  const items = data?.items ?? [];
  const hasRowActions = items.some((i) => (i.actions?.length ?? 0) > 0);
  const navigateTo = React.useCallback(
    (href: string) => {
      if (onRowNavigate) onRowNavigate(href);
      else window.location.assign(href);
    },
    [onRowNavigate],
  );

  return (
    <div className="rounded-lg border border-border">
      <div className={cn("overflow-x-auto", pending && "opacity-60")}>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              {schema.columns.map((col) => (
                <th
                  key={col.name}
                  className="px-3 py-2 font-medium text-muted-foreground"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
              {hasRowActions && <th className="px-3 py-2" />}
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const href = getRowHref?.(item);
              return (
                <tr
                  key={idx}
                  tabIndex={href ? 0 : undefined}
                  aria-label={href ? `Open row ${idx + 1}` : undefined}
                  className={cn(
                    "border-b border-border last:border-0 hover:bg-muted/30",
                    href &&
                      "cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring",
                  )}
                  onClick={(event) => {
                    if (isInteractiveTarget(event.target)) return;
                    if (href) navigateTo(href);
                  }}
                  onKeyDown={(event) => {
                    if (!href) return;
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigateTo(href);
                    }
                  }}
                >
                  {schema.columns.map((col) => (
                    <td key={col.name} className="px-3 py-2 align-middle">
                      <CellRenderer column={col} row={item.data} />
                    </td>
                  ))}
                  {hasRowActions && (
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-1">
                        {item.actions?.map((btn, i) => (
                          <Button
                            key={i}
                            size="sm"
                            variant={buttonVariantFor(btn.type)}
                            onClick={(event) => {
                              event.stopPropagation();
                              onRowAction(btn, item.data);
                            }}
                          >
                            <ActionIcon name={btn.icon} />
                            {btn.label}
                          </Button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td
                  colSpan={schema.columns.length + (hasRowActions ? 1 : 0)}
                  className="px-3 py-10 text-center text-muted-foreground"
                >
                  {pending ? "Loading…" : "No records."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {(data?.previousUrl || data?.nextUrl) && (
        <div className="flex items-center justify-end gap-2 border-t border-border p-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={!data?.previousUrl}
            onClick={() => data?.previousUrl && onNavigate(data.previousUrl)}
          >
            Previous
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!data?.nextUrl}
            onClick={() => data?.nextUrl && onNavigate(data.nextUrl)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

function isInteractiveTarget(target: EventTarget): boolean {
  return target instanceof Element
    ? target.closest(
        'a,button,input,select,textarea,[role="button"],[role="link"]',
      ) !== null
    : false;
}
