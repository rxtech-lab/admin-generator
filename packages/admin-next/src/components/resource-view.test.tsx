import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ResourceInfo, TableSchema } from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ResourceView } from "./resource-view.js";

const schema: TableSchema = {
  uiType: "table",
  type: "view",
  columns: [{ name: "id", label: "ID", type: "number", pinned: true }],
};

const noopActions: AdminActions = {
  listResources: vi.fn(),
  getSchema: vi.fn(),
  fetchAction: vi.fn(),
  fetchUrl: vi.fn(),
  submitAction: vi.fn(),
};

describe("ResourceView", () => {
  // A form/custom resource can return a nil SupportedActions slice, which
  // serializes to JSON null. Rendering must not crash on `.some` of null.
  it("renders a table resource whose supportedActions is null", () => {
    const resource = {
      id: "users",
      name: "Users",
      description: "User balances.",
      icon: "users",
      type: "table",
      dataUrl: "/admin/resources/users/action?action=view",
      defaultAction: "view",
      supportedActions: null,
    } as unknown as ResourceInfo;

    render(
      <ResourceView
        basePath="/admin"
        resource={resource}
        resourceId="users"
        action="view"
        schema={schema}
        initialData={{ items: [], actions: [] }}
        actions={noopActions}
      />,
    );

    expect(screen.getByText("Users")).toBeTruthy();
  });

  it("shows the + Create button when a create action is supported", () => {
    const resource: ResourceInfo = {
      id: "posts",
      name: "Posts",
      description: "",
      icon: "file",
      type: "table",
      dataUrl: "/admin/resources/posts/action?action=view",
      defaultAction: "view",
      supportedActions: [
        {
          type: "primary",
          label: "Create",
          icon: "plus",
          behavior: "openSheet",
          actionType: "create",
          onClick: "/admin/resources/posts/action?action=create",
        },
      ],
    };

    render(
      <ResourceView
        basePath="/admin"
        resource={resource}
        resourceId="posts"
        action="view"
        schema={schema}
        initialData={{ items: [], actions: [] }}
        actions={noopActions}
      />,
    );

    expect(screen.getByText("+ Create")).toBeTruthy();
  });
});
