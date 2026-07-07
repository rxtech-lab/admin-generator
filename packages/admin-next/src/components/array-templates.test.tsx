import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import Form from "@rjsf/core";
import type { TemplatesType } from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import {
  AddButton,
  ArrayFieldItemTemplate,
  CopyButton,
  MoveDownButton,
  MoveUpButton,
  RemoveButton,
} from "./array-templates.js";

// Mirror the ButtonTemplates wiring from resource-form so the test exercises
// the same registry the real form uses.
const templates: Partial<TemplatesType> = {
  ArrayFieldItemTemplate,
  ButtonTemplates: {
    AddButton,
    RemoveButton,
    MoveUpButton,
    MoveDownButton,
    CopyButton,
  } as TemplatesType["ButtonTemplates"],
};

const arraySchema = {
  type: "object" as const,
  properties: {
    tags: { type: "array" as const, title: "Tags", items: { type: "string" as const } },
  },
};

const objectArraySchema = {
  type: "object" as const,
  properties: {
    rules: {
      type: "array" as const,
      title: "Rules",
      items: {
        type: "object" as const,
        required: ["name"],
        properties: {
          name: { type: "string" as const, title: "Name" },
          action: {
            type: "string" as const,
            title: "Action",
            enum: ["allow", "deny"],
          },
        },
      },
    },
  },
};

describe("array-templates", () => {
  it("renders a visible Add button (not the invisible glyphicon default)", () => {
    render(
      <Form schema={arraySchema} validator={validator} templates={templates} />,
    );
    // The default RJSF AddButton renders only a glyphicon <i> with no text; ours
    // renders an accessible, labeled button.
    const add = screen.getByRole("button", { name: /add/i });
    expect(add).toBeTruthy();
    expect(add.textContent).toContain("Add");
  });

  it("adds a row with a remove control when Add is clicked", () => {
    render(
      <Form schema={arraySchema} validator={validator} templates={templates} />,
    );
    expect(screen.queryByRole("textbox")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    // A new array item (text input) plus its Remove button should appear.
    expect(screen.getByRole("textbox")).toBeTruthy();
    expect(screen.getByRole("button", { name: /remove/i })).toBeTruthy();
  });

  it("renders array object items as object fields", () => {
    render(
      <Form
        schema={objectArraySchema}
        validator={validator}
        templates={templates}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /add/i }));

    expect(screen.getByRole("textbox", { name: /name/i })).toBeTruthy();
    expect(screen.getByRole("combobox", { name: /action/i })).toBeTruthy();
  });
});
