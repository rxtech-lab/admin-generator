import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import type { TableColumn } from "../types.js";
import { CellRenderer, cellValue } from "./cell-renderer.js";

function col(partial: Partial<TableColumn>): TableColumn {
  return { name: "x", label: "X", type: "string", pinned: false, ...partial };
}

describe("cellValue", () => {
  it("reads the column's field", () => {
    expect(cellValue(col({ name: "title" }), { title: "Hi" })).toBe("Hi");
  });

  it("honors valueFrom templates", () => {
    const c = col({ name: "author", valueFrom: "{{.Author.Name}}" });
    expect(cellValue(c, { author: { name: "Ada" } })).toBe("Ada");
  });
});

describe("CellRenderer", () => {
  it("renders a chip", () => {
    render(<CellRenderer column={col({ format: "chip" })} row={{ x: "draft" }} />);
    expect(screen.getByText("draft")).toBeDefined();
  });

  it("renders a placeholder for null", () => {
    render(<CellRenderer column={col({})} row={{ x: null }} />);
    expect(screen.getByText("—")).toBeDefined();
  });

  it("renders a color swatch label", () => {
    render(<CellRenderer column={col({ format: "color" })} row={{ x: "#ef4444" }} />);
    expect(screen.getByText("#ef4444")).toBeDefined();
  });

  it("renders a linked cell from a link pattern", () => {
    render(
      <CellRenderer
        column={col({ name: "title", link: "/admin/posts/{id}" })}
        row={{ id: 42, title: "Linked post" }}
      />,
    );

    const link = screen.getByRole("link", { name: "Linked post" });
    expect(link.getAttribute("href")).toBe("/admin/posts/42");
  });
});
