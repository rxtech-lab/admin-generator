"use client";

import * as React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "../lib/utils.js";

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

/** A right-side slide-over panel used for create/edit forms. */
export function Sheet({ open, title, onClose, children }: SheetProps): React.JSX.Element {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-right",
          )}
        >
          <div className="flex h-14 items-center justify-between border-b border-border px-4">
            <Dialog.Title className="font-semibold">{title}</Dialog.Title>
            <Dialog.Close className="rounded-md p-1 hover:bg-accent" aria-label="Close">
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="flex-1 overflow-y-auto p-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
