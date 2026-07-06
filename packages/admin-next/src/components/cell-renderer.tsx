"use client";

import * as React from "react";
import dayjs from "dayjs";
import type { TableColumn } from "../types.js";
import { renderTemplate } from "../lib/template-renderer.js";
import { Badge } from "./ui.js";

/** Resolve a column's raw value from a row, honoring valueFrom templates. */
export function cellValue(column: TableColumn, row: Record<string, unknown>): unknown {
  if (column.valueFrom) return renderTemplate(column.valueFrom, row);
  return row[column.name];
}

/** Render a single table cell according to the column's format. */
export function CellRenderer({
  column,
  row,
}: {
  column: TableColumn;
  row: Record<string, unknown>;
}): React.JSX.Element {
  const value = cellValue(column, row);

  if (value == null || value === "") {
    return <span className="text-muted-foreground">—</span>;
  }

  const content = renderCellContent(column, value);
  if (column.link) {
    const href = renderLink(column.link, row);
    if (href) {
      return (
        <a
          href={href}
          className="font-medium text-primary underline-offset-2 hover:underline"
        >
          {content}
        </a>
      );
    }
  }

  return content;
}

function renderCellContent(
  column: TableColumn,
  value: unknown,
): React.JSX.Element {
  switch (column.format) {
    case "date-time":
      return <span>{dayjs(String(value)).format("YYYY-MM-DD HH:mm")}</span>;
    case "date":
      return <span>{dayjs(String(value)).format("YYYY-MM-DD")}</span>;
    case "image":
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={String(value)}
          alt=""
          className="size-8 rounded-full object-cover"
        />
      );
    case "color":
      return (
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block size-3 rounded-full border border-border"
            style={{ backgroundColor: String(value) }}
          />
          <span className="text-xs text-muted-foreground">{String(value)}</span>
        </span>
      );
    case "chip":
      return <Badge>{String(value)}</Badge>;
    case "wallet-address": {
      const s = String(value);
      const short = s.length > 12 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
      return <span className="font-mono text-xs">{short}</span>;
    }
    case "url":
      return (
        <a
          href={String(value)}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {String(value)}
        </a>
      );
    default:
      if (typeof value === "boolean") {
        return <span>{value ? "Yes" : "No"}</span>;
      }
      if (typeof value === "object") {
        return (
          <span className="font-mono text-xs text-muted-foreground">
            {JSON.stringify(value)}
          </span>
        );
      }
      return <span>{String(value)}</span>;
  }
}

function renderLink(pattern: string, row: Record<string, unknown>): string {
  const rendered = pattern.includes("{{")
    ? renderTemplate(pattern, row)
    : pattern.replace(/\{([^}]+)\}/g, (_, path: string) => {
        const value = lookup(row, path);
        return value == null ? "" : encodeURIComponent(String(value));
      });
  return String(rendered);
}

function lookup(data: unknown, path: string): unknown {
  const parts = path.split(".").map((p) => p.trim()).filter(Boolean);
  let current: unknown = data;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    const obj = current as Record<string, unknown>;
    if (part in obj) {
      current = obj[part];
      continue;
    }
    const key = Object.keys(obj).find(
      (k) => k.toLowerCase() === part.toLowerCase(),
    );
    current = key ? obj[key] : undefined;
  }
  return current;
}
