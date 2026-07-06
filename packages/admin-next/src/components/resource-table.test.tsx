import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { PaginatedResponse, TableSchema } from "../types.js";
import { ResourceTable } from "./resource-table.js";

const schema: TableSchema = {
  uiType: "table",
  type: "view",
  columns: [
    { name: "id", label: "ID", type: "number", pinned: true },
    { name: "title", label: "Title", type: "string", pinned: false },
  ],
};

const data: PaginatedResponse = {
  items: [
    {
      data: { id: 1, title: "First" },
      dynamicPath: "1",
      actions: [
        {
          type: "secondary",
          label: "Edit",
          icon: "pencil",
          behavior: "openSheet",
          actionType: "edit",
          onClick: "/admin/resources/posts/action?action=edit&dynamicPath=1",
        },
      ],
    },
  ],
  actions: [],
};

describe("ResourceTable", () => {
  it("navigates when a row with a dynamic path is clicked", () => {
    const onRowNavigate = vi.fn();

    render(
      <ResourceTable
        schema={schema}
        data={data}
        onRowAction={vi.fn()}
        onNavigate={vi.fn()}
        getRowHref={(item) => `/admin/posts/${item.dynamicPath}`}
        onRowNavigate={onRowNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("row", { name: "Open row 1" }));

    expect(onRowNavigate).toHaveBeenCalledWith("/admin/posts/1");
  });

  it("runs row actions without triggering row navigation", () => {
    const onRowAction = vi.fn();
    const onRowNavigate = vi.fn();

    render(
      <ResourceTable
        schema={schema}
        data={data}
        onRowAction={onRowAction}
        onNavigate={vi.fn()}
        getRowHref={(item) => `/admin/posts/${item.dynamicPath}`}
        onRowNavigate={onRowNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));

    expect(onRowAction).toHaveBeenCalledWith(data.items[0]!.actions![0], data.items[0]!.data);
    expect(onRowNavigate).not.toHaveBeenCalled();
  });

  it("does not hijack links inside cells", () => {
    const onRowNavigate = vi.fn();

    render(
      <ResourceTable
        schema={{
          ...schema,
          columns: [
            ...schema.columns,
            { name: "website", label: "Website", type: "string", pinned: false, format: "url" },
          ],
        }}
        data={{
          ...data,
          items: [
            {
              ...data.items[0]!,
              data: {
                ...data.items[0]!.data,
                website: "https://example.com",
              },
            },
          ],
        }}
        onRowAction={vi.fn()}
        onNavigate={vi.fn()}
        getRowHref={(item) => `/admin/posts/${item.dynamicPath}`}
        onRowNavigate={onRowNavigate}
      />,
    );

    fireEvent.click(screen.getByRole("link", { name: "https://example.com" }));

    expect(onRowNavigate).not.toHaveBeenCalled();
  });
});
