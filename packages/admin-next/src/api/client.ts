import type {
  ActionResponse,
  ActionType,
  ResourceInfo,
  ResourceSchema,
} from "../types.js";

export interface AdminClientOptions {
  /** Base URL of the Go admin API, e.g. "http://localhost:8080". */
  apiUrl: string;
  /** Mount path of the admin API on that host (default "/admin"). */
  basePath?: string;
  /** Bearer token added to every request. */
  token?: string | null;
}

/**
 * AdminClient is a small fetch wrapper over the four-endpoint admin contract.
 * It is isomorphic (works in RSC and the browser) and holds no React state.
 */
export class AdminClient {
  private readonly origin: string;
  private readonly base: string;
  private readonly token?: string | null;

  constructor(opts: AdminClientOptions) {
    const basePath = opts.basePath ?? "/admin";
    this.origin = opts.apiUrl.replace(/\/$/, "");
    this.base = this.origin + basePath;
    this.token = opts.token;
  }

  private headers(extra?: HeadersInit): Headers {
    const h = new Headers(extra);
    if (this.token) h.set("Authorization", `Bearer ${this.token}`);
    return h;
  }

  /**
   * Resolve a server-emitted URL against the API host. The Go backend returns
   * admin-relative paths (e.g. "/admin/resources/posts/action?..."), which we
   * prefix with the configured origin.
   */
  private resolve(url: string): string {
    if (/^https?:\/\//.test(url)) return url;
    return this.origin + url;
  }

  private async request<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
      ...init,
      headers: this.headers(init?.headers),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text();
      throw new AdminApiError(res.status, body || res.statusText);
    }
    return (await res.json()) as T;
  }

  listResources(): Promise<ResourceInfo[]> {
    return this.request<ResourceInfo[]>(`${this.base}/resources`);
  }

  getResource(id: string): Promise<ResourceInfo> {
    return this.request<ResourceInfo>(`${this.base}/resources/${id}`);
  }

  getSchema(
    id: string,
    action: ActionType = "view",
    dynamicPath?: string,
  ): Promise<ResourceSchema> {
    const q = new URLSearchParams({ action });
    if (dynamicPath) q.set("dynamicPath", dynamicPath);
    return this.request<ResourceSchema>(
      `${this.base}/resources/${id}/schema?${q}`,
    );
  }

  /** Read-side action (list view, edit prefill, search). */
  fetchAction(
    id: string,
    action: ActionType,
    opts: { dynamicPath?: string; after?: string; limit?: number; formData?: unknown } = {},
  ): Promise<ActionResponse> {
    const q = new URLSearchParams({ action });
    if (opts.dynamicPath) q.set("dynamicPath", opts.dynamicPath);
    if (opts.after) q.set("after", opts.after);
    if (opts.limit) q.set("limit", String(opts.limit));
    if (opts.formData) q.set("formData", JSON.stringify(opts.formData));
    return this.request<ActionResponse>(
      `${this.base}/resources/${id}/action?${q}`,
    );
  }

  /** Fetch an absolute admin URL (e.g. a nextUrl from a paginated response). */
  fetchUrl(url: string): Promise<ActionResponse> {
    return this.request<ActionResponse>(this.resolve(url));
  }

  /** Write-side action (create, edit, delete, search POST). */
  postAction(
    id: string,
    action: ActionType,
    data: Record<string, unknown>,
    dynamicPath?: string,
  ): Promise<ActionResponse> {
    const q = new URLSearchParams();
    if (dynamicPath) q.set("dynamicPath", dynamicPath);
    const suffix = q.toString() ? `?${q}` : "";
    return this.request<ActionResponse>(
      `${this.base}/resources/${id}/action${suffix}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, data }),
      },
    );
  }
}

export class AdminApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "AdminApiError";
  }

  /** Parsed validation field errors, if the body was a 422 validation response. */
  get fieldErrors(): Record<string, string> | undefined {
    if (this.status !== 422) return undefined;
    try {
      const parsed = JSON.parse(this.message) as { fields?: Record<string, string> };
      return parsed.fields;
    } catch {
      return undefined;
    }
  }
}
