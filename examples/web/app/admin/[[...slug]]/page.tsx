import { AdminApp } from "@rxtech-lab/admin-next/server";
import { adminConfig } from "@/lib/admin-config";
import * as actions from "../actions";

export const dynamic = "force-dynamic";

export default function AdminPage(props: {
  params: Promise<{ slug?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <AdminApp
      config={adminConfig}
      actions={actions}
      params={props.params}
      searchParams={props.searchParams}
    />
  );
}
