"use client";

import * as React from "react";
import type { WidgetProps } from "@rjsf/utils";
import type { SearchItem } from "../../types.js";
import { useAdmin } from "../context.js";
import { cn } from "../../lib/utils.js";

/**
 * ForeignKeyWidget renders a searchable select backed by another resource's
 * search action. Configured via uiSchema:
 *
 *   ui:widget: ForeignKey
 *   ui:options: { resource: "authors", placeholder: "...", dynamicPath?: "..." }
 */
export function ForeignKeyWidget(props: WidgetProps): React.JSX.Element {
  const { value, onChange, options, disabled, readonly, id } = props;
  const { search } = useAdmin();
  const resource = String(options.resource ?? "");
  const placeholder = String(options.placeholder ?? "Search…");
  const dynamicPath = options.dynamicPath ? String(options.dynamicPath) : undefined;

  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<SearchItem[]>([]);
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState<string>(value != null ? String(value) : "");

  React.useEffect(() => {
    if (!open || !resource) return;
    let active = true;
    const t = setTimeout(async () => {
      const items = await search(resource, query, dynamicPath);
      if (active) setResults(items);
    }, 200);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [open, query, resource, dynamicPath, search]);

  const select = (item: SearchItem) => {
    // Coerce numeric-looking IDs to numbers so they match integer schemas.
    const coerced = /^\d+$/.test(item.value) ? Number(item.value) : item.value;
    onChange(coerced);
    setLabel(item.title);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        disabled={disabled || readonly}
        className="ag-input"
        placeholder={placeholder}
        value={open ? query : label}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md border border-border bg-card shadow-md">
          {results.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                className={cn(
                  "flex w-full flex-col items-start px-3 py-1.5 text-left text-sm hover:bg-accent",
                  String(value) === item.value && "bg-accent",
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
              >
                <span>{item.title}</span>
                {item.description && (
                  <span className="text-xs text-muted-foreground">
                    {item.description}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
