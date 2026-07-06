import { AdminClient } from "../api/client.js";

/**
 * AdminConfig is the server-only configuration for the admin UI. Create it once
 * in your app (it captures a getToken callback bound to your auth) and pass it
 * to both createAdminActions and <AdminApp>.
 */
export interface AdminConfig {
  /** Base URL of the Go admin API, e.g. process.env.ADMIN_API_URL. */
  apiUrl: string;
  /** Mount path of the admin API on that host (default "/admin"). */
  apiBasePath?: string;
  /** Route the admin UI is mounted at in the Next.js app (default "/admin"). */
  basePath?: string;
  /** Returns the bearer token for the current request (from your session). */
  getToken?: () => Promise<string | null> | string | null;
}

export interface ResolvedAdminConfig extends AdminConfig {
  apiBasePath: string;
  basePath: string;
}

/** Fill defaults on a user-supplied config. */
export function defineAdminConfig(config: AdminConfig): ResolvedAdminConfig {
  return {
    ...config,
    apiBasePath: config.apiBasePath ?? "/admin",
    basePath: config.basePath ?? "/admin",
  };
}

/** Build an AdminClient for the current request, resolving the token. */
export async function clientFor(
  config: ResolvedAdminConfig,
): Promise<AdminClient> {
  const token = config.getToken ? await config.getToken() : null;
  return new AdminClient({
    apiUrl: config.apiUrl,
    basePath: config.apiBasePath,
    token,
  });
}
