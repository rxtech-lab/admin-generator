"use client";

import * as React from "react";
import type { AdminActions } from "../server/actions.js";
import type { SearchItem } from "../types.js";

interface AdminContextValue {
  actions: AdminActions;
  /** Search another resource (used by relation widgets). */
  search: (resourceId: string, query: string, dynamicPath?: string) => Promise<SearchItem[]>;
}

const AdminContext = React.createContext<AdminContextValue | null>(null);

export function AdminProvider({
  actions,
  children,
}: {
  actions: AdminActions;
  children: React.ReactNode;
}): React.JSX.Element {
  const value = React.useMemo<AdminContextValue>(
    () => ({
      actions,
      search: async (resourceId, query, dynamicPath) => {
        const res = await actions.fetchAction(resourceId, "search", {
          dynamicPath,
          formData: { query },
        });
        if (res.ok && Array.isArray(res.data)) return res.data;
        return [];
      },
    }),
    [actions],
  );
  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
}

export function useAdmin(): AdminContextValue {
  const ctx = React.useContext(AdminContext);
  if (!ctx) throw new Error("useAdmin must be used within an AdminProvider");
  return ctx;
}
