import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { CustomResourcePage, ResourceInfo, TableSchema } from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ResourceView } from "./resource-view.js";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush, refresh: vi.fn() }),
}));

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

afterEach(() => {
  routerPush.mockReset();
  window.history.replaceState(null, "", "/");
  vi.restoreAllMocks();
});

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

  it("uses the Next router for row navigation", () => {
    render(
      <ResourceView
        basePath="/admin"
        resource={{
          id: "posts",
          name: "Posts",
          description: "",
          icon: "file",
          type: "table",
          dataUrl: "/admin/resources/posts/action?action=view",
          defaultAction: "view",
          supportedActions: [],
        }}
        resourceId="posts"
        action="view"
        schema={schema}
        initialData={{
          items: [{ data: { id: 1 }, dynamicPath: "1", actions: [] }],
          actions: [],
        }}
        actions={noopActions}
      />,
    );

    fireEvent.click(screen.getByRole("row", { name: "Open row 1" }));

    expect(routerPush).toHaveBeenCalledWith("/admin/posts/1");
  });

  it("uses server-emitted pagination URLs instead of client-side cursor parsing", async () => {
    window.history.replaceState(null, "", "/admin/posts?filter=published");
    const actions: AdminActions = {
      ...noopActions,
      fetchAction: vi.fn(),
      fetchUrl: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          items: [{ data: { id: 2 }, dynamicPath: "2", actions: [] }],
          actions: [],
        },
      }),
    };

    render(
      <ResourceView
        basePath="/admin"
        resource={{
          id: "posts",
          name: "Posts",
          description: "",
          icon: "file",
          type: "table",
          dataUrl: "/admin/resources/posts/action?action=view",
          defaultAction: "view",
          supportedActions: [],
        }}
        resourceId="posts"
        action="view"
        schema={schema}
        initialData={{
          items: [{ data: { id: 1 }, dynamicPath: "1", actions: [] }],
          actions: [],
          nextUrl:
            "/admin/resources/posts/action?action=view&after=cursor-1&limit=10",
        }}
        actions={actions}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Next" }));

    await waitFor(() => {
      expect(actions.fetchUrl).toHaveBeenCalledWith(
        "/admin/resources/posts/action?action=view&after=cursor-1&limit=10",
      );
    });
    expect(actions.fetchAction).not.toHaveBeenCalled();
    expect(window.location.pathname).toBe("/admin/posts");
    expect(window.location.search).toBe(
      "?filter=published&after=cursor-1&limit=10",
    );
  });

  it("opens external row navigation actions in a new tab", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <ResourceView
        basePath="/admin"
        resource={{
          id: "products",
          name: "Products",
          description: "",
          icon: "box",
          type: "table",
          dataUrl: "/admin/resources/products/action?action=view",
          defaultAction: "view",
          supportedActions: [],
        }}
        resourceId="products"
        action="view"
        schema={schema}
        initialData={{
          items: [
            {
              data: { id: 1 },
              dynamicPath: "1",
              actions: [
                {
                  type: "info",
                  label: "RevenueCat",
                  icon: "external-link",
                  behavior: "navigate",
                  actionType: "view",
                  onClick:
                    "https://app.revenuecat.com/projects/proj/apps/app/products?search=plus_subscription",
                },
              ],
            },
          ],
          actions: [],
        }}
        actions={noopActions}
      />,
    );

    fireEvent.click(screen.getByText("RevenueCat"));

    expect(open).toHaveBeenCalledWith(
      "https://app.revenuecat.com/projects/proj/apps/app/products?search=plus_subscription",
      "_blank",
      "noopener,noreferrer",
    );
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("renders a custom resource page with actions and sections", () => {
    const customSchema: CustomResourcePage = {
      uiType: "custom",
      type: "view",
      actionButtons: [
        {
          type: "primary",
          label: "Export",
          icon: "download",
          behavior: "navigate",
          actionType: "export",
          onClick: "/admin/dashboard/export",
        },
      ],
      sections: [
        {
          type: "statistics",
          title: "Overview",
          statistics: [{ label: "Posts", value: 25, trend: "+10%" }],
        },
        {
          type: "charts",
          title: "Traffic",
          children: [
            {
              type: "bar",
              title: "Views",
              data: [{ day: "Mon", views: 10 }],
              xKey: "day",
              yKey: "views",
            },
            {
              type: "LineChart",
              title: "Engagement",
              data: [{ day: "Tue", reads: 20, shares: 3 }],
              xKey: "day",
              series: [
                { key: "reads", label: "Reads" },
                { key: "shares", label: "Shares" },
              ],
            },
          ],
        },
        {
          type: "text",
          title: "Notes",
          body: "Review pending posts before publishing.",
        },
      ],
    };

    render(
      <ResourceView
        basePath="/admin"
        resource={{
          id: "dashboard",
          name: "Dashboard",
          description: "Admin overview.",
          icon: "layout-dashboard",
          type: "custom",
          dataUrl: "/admin/resources/dashboard/action?action=view",
          defaultAction: "view",
          supportedActions: [],
        }}
        resourceId="dashboard"
        action="view"
        schema={customSchema}
        actions={noopActions}
      />,
    );

    expect(screen.getByText("Dashboard")).toBeTruthy();
    expect(screen.getByText("Export")).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();
    expect(screen.getByText("Posts")).toBeTruthy();
    expect(screen.getByText("25")).toBeTruthy();
    expect(screen.getByText("Views")).toBeTruthy();
    expect(screen.getByText("views")).toBeTruthy();
    expect(screen.getByText("Reads")).toBeTruthy();
    expect(screen.getByText("Shares")).toBeTruthy();
    expect(screen.getByText("Review pending posts before publishing.")).toBeTruthy();
  });
});
