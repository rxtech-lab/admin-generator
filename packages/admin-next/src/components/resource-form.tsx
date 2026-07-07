"use client";

import * as React from "react";
import Form from "@rjsf/core";
import type {
  ErrorListProps,
  RegistryWidgetsType,
  TemplatesType,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type { FormSchema } from "../types.js";
import { isDetail } from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ForeignKeyWidget } from "./widgets/foreign-key.js";
import { Button } from "./ui.js";

/** Keep only the keys declared in the form schema's `properties`. */
function pickSchemaKeys(
  data: Record<string, unknown>,
  schema: FormSchema,
): Record<string, unknown> {
  const properties = (schema.schema as { properties?: Record<string, unknown> })
    .properties;
  if (!properties) return data;
  const allowed = new Set(Object.keys(properties));
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}

const widgets: RegistryWidgetsType = {
  ForeignKey: ForeignKeyWidget,
  // ObjectSearch reuses the ForeignKey combo-search behavior.
  ObjectSearch: ForeignKeyWidget,
};

/** Clean, shadcn-styled summary of validation errors shown atop the form. */
function ErrorListTemplate({ errors }: ErrorListProps): React.JSX.Element {
  return (
    <div className="ag-error-list" role="alert">
      <p className="ag-error-list-title">
        Please fix the following{" "}
        {errors.length === 1 ? "error" : `${errors.length} errors`}:
      </p>
      <ul className="ag-error-list-items">
        {errors.map((error, i) => (
          <li key={i}>{error.stack}</li>
        ))}
      </ul>
    </div>
  );
}

const templates: Partial<TemplatesType> = {
  ErrorListTemplate,
};

export interface ResourceFormProps {
  resourceId: string;
  action: "create" | "edit";
  dynamicPath?: string;
  schema: FormSchema;
  actions: AdminActions;
  onDone: () => void;
}

export function ResourceForm({
  resourceId,
  action,
  dynamicPath,
  schema,
  actions,
  onDone,
}: ResourceFormProps): React.JSX.Element {
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [extraErrors, setExtraErrors] = React.useState<Record<string, unknown>>();
  const [submitError, setSubmitError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(action === "edit");

  // Prefill on edit by fetching the current record. Only keep keys the form
  // schema declares: the backend returns the full model (id, timestamps,
  // relations), but the schema uses additionalProperties:false, so extra keys
  // would fail client-side validation.
  React.useEffect(() => {
    if (action !== "edit") return;
    let active = true;
    actions.fetchAction(resourceId, "edit", { dynamicPath }).then((res) => {
      if (!active) return;
      if (res.ok && isDetail(res.data)) {
        setFormData(pickSchemaKeys(res.data.data, schema));
      }
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [actions, resourceId, action, dynamicPath, schema]);

  const submit = async (data: Record<string, unknown>) => {
    setSubmitting(true);
    setSubmitError(undefined);
    setExtraErrors(undefined);
    const res = await actions.submitAction(resourceId, action, data, dynamicPath);
    setSubmitting(false);
    if (res.ok) {
      onDone();
      return;
    }
    if (res.fieldErrors) {
      // Surface backend validation on the corresponding fields.
      const mapped: Record<string, unknown> = {};
      for (const [field, message] of Object.entries(res.fieldErrors)) {
        mapped[field] = { __errors: [message] };
      }
      setExtraErrors(mapped);
    } else {
      setSubmitError(res.error);
    }
  };

  if (loading) return <p className="text-sm text-muted-foreground">Loading…</p>;

  return (
    <div className="ag-form">
      <Form
        schema={{
          ...schema.schema,
          $schema: "http://json-schema.org/draft-07/schema#",
        }}
        uiSchema={schema.uiSchema}
        formData={formData}
        widgets={widgets}
        templates={templates}
        validator={validator}
        extraErrors={extraErrors as never}
        onChange={(e) => setFormData(e.formData as Record<string, unknown>)}
        onSubmit={(e) => submit(e.formData as Record<string, unknown>)}
        showErrorList="top"
      >
        {submitError && (
          <p className="mb-2 text-sm text-destructive">{submitError}</p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : action === "edit" ? "Save" : "Create"}
          </Button>
        </div>
      </Form>
    </div>
  );
}
