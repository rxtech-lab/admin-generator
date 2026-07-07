"use client";

import * as React from "react";
import type {
  ArrayFieldItemTemplateProps,
  IconButtonProps,
} from "@rjsf/utils";
import { ChevronDown, ChevronUp, Copy, Plus, Trash2 } from "lucide-react";
import { Button } from "./ui.js";

/**
 * RJSF ships default array Add/Remove/Move/Copy buttons that rely on Bootstrap
 * grid + glyphicon icon-font classes. In a shadcn/Tailwind app those classes
 * don't exist, so the buttons render with no visible glyph or label — the array
 * field looks like it has "no Add button". These templates re-implement the
 * button set with the package's own shadcn <Button> + lucide icons so array
 * fields (e.g. an allowlist of per-row dropdowns) are fully usable.
 */

/** Strip RJSF-only props so they never leak onto the DOM <button>. */
function iconButtonProps(props: IconButtonProps) {
  const {
    icon: _icon,
    iconType: _iconType,
    uiSchema: _uiSchema,
    registry: _registry,
    ...rest
  } = props;
  return rest;
}

/** Full-width "Add" button rendered below the array items. */
export function AddButton(props: IconButtonProps): React.JSX.Element {
  const { className, ...rest } = iconButtonProps(props);
  return (
    <Button
      type="button"
      variant="secondary"
      size="default"
      className={`mt-2 ${className ?? ""}`}
      {...rest}
    >
      <Plus className="size-4" aria-hidden />
      Add
    </Button>
  );
}

/** Compact icon-only per-row control shared by remove/move/copy. */
function ItemIconButton({
  label,
  children,
  variant = "secondary",
  props,
}: {
  label: string;
  children: React.ReactNode;
  variant?: "secondary" | "danger";
  props: IconButtonProps;
}): React.JSX.Element {
  const { className, ...rest } = iconButtonProps(props);
  return (
    <Button
      type="button"
      variant={variant}
      size="icon"
      title={label}
      aria-label={label}
      className={className}
      {...rest}
    >
      {children}
    </Button>
  );
}

export function RemoveButton(props: IconButtonProps): React.JSX.Element {
  return (
    <ItemIconButton label="Remove" variant="danger" props={props}>
      <Trash2 className="size-4" aria-hidden />
    </ItemIconButton>
  );
}

export function MoveUpButton(props: IconButtonProps): React.JSX.Element {
  return (
    <ItemIconButton label="Move up" props={props}>
      <ChevronUp className="size-4" aria-hidden />
    </ItemIconButton>
  );
}

export function MoveDownButton(props: IconButtonProps): React.JSX.Element {
  return (
    <ItemIconButton label="Move down" props={props}>
      <ChevronDown className="size-4" aria-hidden />
    </ItemIconButton>
  );
}

export function CopyButton(props: IconButtonProps): React.JSX.Element {
  return (
    <ItemIconButton label="Duplicate" props={props}>
      <Copy className="size-4" aria-hidden />
    </ItemIconButton>
  );
}

/**
 * Card layout for a single array item. Replaces RJSF's default Bootstrap
 * `col-xs-*` grid classes with a shadowless card and an in-card toolbar.
 */
export function ArrayFieldItemTemplate(
  props: ArrayFieldItemTemplateProps,
): React.JSX.Element {
  const { children, className, buttonsProps, hasToolbar, registry } = props;
  const { ArrayFieldItemButtonsTemplate } = registry.templates;
  return (
    <div
      className={`relative mb-3 rounded-lg border border-border bg-card px-4 pt-4 pb-5 text-card-foreground shadow-none last:mb-0 ${className ?? ""}`}
    >
      {hasToolbar && (
        <div className="absolute right-3 top-3 flex items-center gap-1">
          <ArrayFieldItemButtonsTemplate {...buttonsProps} />
        </div>
      )}
      {hasToolbar && (
        <div className="pointer-events-none float-right h-9 w-32 sm:w-36" />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
