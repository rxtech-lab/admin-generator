"use client";

import * as React from "react";
import Form from "@rjsf/core";
import type {
  ErrorListProps,
  RegistryWidgetsType,
  TemplatesType,
} from "@rjsf/utils";
import validator from "@rjsf/validator-ajv8";
import type { ActionResponse, FormSchema } from "../types.js";
import { isDetail } from "../types.js";
import type { AdminActions } from "../server/actions.js";
import { ForeignKeyWidget } from "./widgets/foreign-key.js";
import {
  AddButton,
  ArrayFieldItemTemplate,
  CopyButton,
  MoveDownButton,
  MoveUpButton,
  RemoveButton,
} from "./array-templates.js";
import { Button } from "./ui.js";

type SchemaNode = {
  type?: string | string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode;
  dependencies?: Record<string, SchemaNode | string[]>;
  oneOf?: SchemaNode[];
  anyOf?: SchemaNode[];
  allOf?: SchemaNode[];
  if?: SchemaNode;
  then?: SchemaNode;
  else?: SchemaNode;
};

/**
 * Collect every property key a schema can hold, including keys declared in
 * conditional draft-07 branches. RJSF resolves these branches at render time,
 * so edit-prefill filtering must account for them before handing over data.
 */
function collectSchemaKeys(
  schema: SchemaNode,
  keys = new Set<string>(),
  seen = new Set<SchemaNode>(),
): Set<string> {
  if (seen.has(schema)) return keys;
  seen.add(schema);

  for (const key of Object.keys(schema.properties ?? {})) keys.add(key);

  for (const branch of [schema.if, schema.then, schema.else]) {
    if (branch) collectSchemaKeys(branch, keys, seen);
  }
  for (const branches of [schema.oneOf, schema.anyOf, schema.allOf]) {
    for (const branch of branches ?? []) {
      collectSchemaKeys(branch, keys, seen);
    }
  }
  for (const dependency of Object.values(schema.dependencies ?? {})) {
    if (!Array.isArray(dependency)) {
      collectSchemaKeys(dependency, keys, seen);
    }
  }

  return keys;
}

/** Keep only the keys the form schema can hold (declared or conditional). */
function pickSchemaKeys(
  data: Record<string, unknown>,
  schema: FormSchema,
): Record<string, unknown> {
  const allowed = collectSchemaKeys(schema.schema as SchemaNode);
  if (allowed.size === 0) return data;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (allowed.has(key)) out[key] = value;
  }
  return out;
}

function normalizeFormDataForSchema(
  data: Record<string, unknown>,
  schema: FormSchema,
): Record<string, unknown> {
  return normalizeValueForSchema(data, schema.schema as SchemaNode) as Record<
    string,
    unknown
  >;
}

function normalizeValueForSchema(value: unknown, schema?: SchemaNode): unknown {
  if (!schema) return value;
  if (schemaHasType(schema, "array")) {
    if (value === null || value === undefined) return [];
    if (Array.isArray(value)) {
      return value.map((item) => normalizeValueForSchema(item, schema.items));
    }
    return value;
  }
  if (
    schemaHasType(schema, "object") &&
    value &&
    typeof value === "object" &&
    !Array.isArray(value)
  ) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) {
      out[key] = normalizeValueForSchema(item, schema.properties?.[key]);
    }
    return out;
  }
  return value;
}

function schemaHasType(schema: SchemaNode, type: string): boolean {
  return Array.isArray(schema.type)
    ? schema.type.includes(type)
    : schema.type === type;
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
  // RJSF's default array buttons use Bootstrap glyphicon/grid classes that are
  // invisible in this shadcn/Tailwind theme. Swap in shadcn-styled ones so
  // array fields (Add row / remove / reorder) are usable.
  ArrayFieldItemTemplate,
  ButtonTemplates: {
    AddButton,
    RemoveButton,
    MoveUpButton,
    MoveDownButton,
    CopyButton,
  } as TemplatesType["ButtonTemplates"],
};

export interface ResourceFormProps {
  resourceId: string;
  action: "create" | "edit";
  dynamicPath?: string;
  schema: FormSchema;
  actions: AdminActions;
  onDone: (response?: ActionResponse) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function ResourceForm({
  resourceId,
  action,
  dynamicPath,
  schema,
  actions,
  onDone,
  onDirtyChange,
}: ResourceFormProps): React.JSX.Element {
  const [formData, setFormData] = React.useState<Record<string, unknown>>({});
  const [extraErrors, setExtraErrors] = React.useState<Record<string, unknown>>();
  const [submitError, setSubmitError] = React.useState<string>();
  const [submitting, setSubmitting] = React.useState(false);
  const [loading, setLoading] = React.useState(action === "edit");
  const initialFormDataRef = React.useRef<Record<string, unknown>>({});

  const reportDirty = React.useCallback(
    (nextData: Record<string, unknown>) => {
      const dirty =
        action === "create"
          ? hasFormData(nextData)
          : !formDataEquals(nextData, initialFormDataRef.current);
      onDirtyChange?.(dirty);
    },
    [action, onDirtyChange],
  );

  React.useEffect(() => {
    if (action !== "create") return;
    initialFormDataRef.current = {};
    onDirtyChange?.(false);
  }, [action, onDirtyChange, schema]);

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
        const picked = normalizeFormDataForSchema(
          pickSchemaKeys(res.data.data, schema),
          schema,
        );
        initialFormDataRef.current = picked;
        setFormData(picked);
        onDirtyChange?.(false);
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
      onDirtyChange?.(false);
      onDone(res.data);
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
        onChange={(e) => {
          const nextData = e.formData as Record<string, unknown>;
          setFormData(nextData);
          reportDirty(nextData);
        }}
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

function hasFormData(value: unknown): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (value && typeof value === "object") {
    return Object.values(value).some(hasFormData);
  }
  if (typeof value === "string") return value.trim().length > 0;
  return value !== undefined && value !== null;
}

function formDataEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b));
}

function sortObjectKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortObjectKeys);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => [key, sortObjectKeys(item)]),
  );
}
