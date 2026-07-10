import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdminActions } from "../server/actions.js";
import type { FormSchema } from "../types.js";
import { ResourceForm } from "./resource-form.js";

afterEach(cleanup);

describe("ResourceForm", () => {
  it("prefills edit fields declared inside conditional dependencies", async () => {
    const schema: FormSchema = {
      uiType: "form",
      type: "edit",
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          models_mode: {
            type: "string",
            enum: ["all", "only"],
          },
          voices_mode: {
            type: "string",
            enum: ["all", "only"],
          },
        },
        dependencies: {
          models_mode: {
            oneOf: [
              {
                properties: {
                  models_mode: { enum: ["all"] },
                },
              },
              {
                properties: {
                  models_mode: { enum: ["only"] },
                  models_allow: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            ],
          },
          voices_mode: {
            oneOf: [
              {
                properties: {
                  voices_mode: { enum: ["all"] },
                },
              },
              {
                properties: {
                  voices_mode: { enum: ["only"] },
                  voices_allow: {
                    type: "array",
                    items: { type: "string" },
                  },
                },
              },
            ],
          },
        },
      },
      uiSchema: {},
      supportedActions: [],
    };
    const actions: AdminActions = {
      listResources: vi.fn(),
      getSchema: vi.fn(),
      fetchUrl: vi.fn(),
      submitAction: vi.fn(),
      fetchAction: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          data: {
            id: "free",
            models_mode: "only",
            models_allow: ["gpt-4o-mini"],
            voices_mode: "only",
            voices_allow: ["en-US-E2EAvaNeural"],
          },
        },
      }),
    };

    render(
      <ResourceForm
        resourceId="permissions"
        action="edit"
        dynamicPath="free"
        schema={schema}
        actions={actions}
        onDone={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue("gpt-4o-mini")).toBeTruthy();
    expect(await screen.findByDisplayValue("en-US-E2EAvaNeural")).toBeTruthy();
    await waitFor(() => {
      expect(actions.fetchAction).toHaveBeenCalledWith("permissions", "edit", {
        dynamicPath: "free",
      });
    });
  });
});
