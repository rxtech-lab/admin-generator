import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { AdminActions } from "../server/actions.js";
import type { ResourceInfo } from "../types.js";
import { AdminShell } from "./admin-shell.js";

const resources: ResourceInfo[] = [
  {
    id: "posts",
    name: "Posts",
    description: "Published content.",
    icon: "file-text",
    type: "table",
    dataUrl: "/admin/resources/posts/action?action=view",
    defaultAction: "view",
    supportedActions: [],
  },
];

const noopActions: AdminActions = {
  listResources: vi.fn(),
  getSchema: vi.fn(),
  fetchAction: vi.fn(),
  fetchUrl: vi.fn(),
  submitAction: vi.fn(),
};

function renderShell({
  initialSidebarCollapsed,
}: { initialSidebarCollapsed?: boolean } = {}) {
  return render(
    <AdminShell
      basePath="/admin"
      resources={resources}
      activeResourceId="posts"
      actions={noopActions}
      initialSidebarCollapsed={initialSidebarCollapsed}
    />,
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
  document.cookie = "ag_sidebar_collapsed=; path=/; max-age=0";
});

describe("AdminShell", () => {
  it("uses the server-provided collapsed sidebar state on initial render", () => {
    renderShell({ initialSidebarCollapsed: true });

    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
  });

  it("restores the persisted collapsed sidebar state after remount", async () => {
    renderShell();

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(window.localStorage.getItem("ag:sidebar-collapsed")).toBe("true");
    expect(document.cookie).toContain("ag_sidebar_collapsed=true");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();

    cleanup();
    renderShell();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Expand sidebar" })).toBeTruthy();
    });
  });
});
