import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template-renderer.js";

describe("renderTemplate", () => {
  const row = {
    id: 1,
    title: "Hello",
    author: { name: "Ada Lovelace", email: "ada@example.com" },
    count: 3,
  };

  it("resolves a single reference preserving type", () => {
    expect(renderTemplate("{{.count}}", row)).toBe(3);
  });

  it("resolves nested paths", () => {
    expect(renderTemplate("{{.author.name}}", row)).toBe("Ada Lovelace");
  });

  it("is case-insensitive (Go field names on JSON data)", () => {
    expect(renderTemplate("{{.Author.Name}}", row)).toBe("Ada Lovelace");
  });

  it("interpolates mixed strings", () => {
    expect(renderTemplate("{{.title}} by {{.author.name}}", row)).toBe(
      "Hello by Ada Lovelace",
    );
  });

  it("renders missing paths as empty in interpolation", () => {
    expect(renderTemplate("x={{.missing.field}}", row)).toBe("x=");
  });

  it("returns undefined for a missing single reference", () => {
    expect(renderTemplate("{{.nope}}", row)).toBeUndefined();
  });

  it("tolerates whitespace inside the braces", () => {
    expect(renderTemplate("{{ .author.name }}", row)).toBe("Ada Lovelace");
  });
});
