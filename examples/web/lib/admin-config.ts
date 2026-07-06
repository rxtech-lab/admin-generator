import "server-only";
import { cookies } from "next/headers";
import { defineAdminConfig } from "@rxtech-lab/admin-next/server";

/**
 * Server-only admin configuration. getToken pulls the bearer token from a
 * cookie; in this demo the cookie is set by /api/dev-login (which mints a token
 * via the Go server's /dev/login). In production, replace getToken with your
 * real session lookup (e.g. an rxlab-auth access token from NextAuth).
 */
export const adminConfig = defineAdminConfig({
  apiUrl: process.env.ADMIN_API_URL ?? "http://localhost:8080",
  basePath: "/admin",
  getToken: async () => {
    const store = await cookies();
    return store.get("admin_token")?.value ?? null;
  },
});
