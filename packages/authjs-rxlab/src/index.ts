import NextAuth, {
  type NextAuthConfig,
  type NextAuthResult,
} from "next-auth";

export const RX_LAB_PROVIDER_ID = "rxlab";
export const RX_LAB_REFRESH_TOKEN_ERROR = "RefreshTokenError";

export type RxLabAuthLogLevel = "debug" | "warn" | "error";

export interface RxLabAuthLogEntry {
  event:
    | "initial-login"
    | "refresh-needed"
    | "refresh-succeeded"
    | "refresh-missing-token"
    | "refresh-failed";
  hasRefreshToken: boolean;
  expiresAt: number | null;
  status?: number;
}

export type RxLabAuthLogger = (
  level: RxLabAuthLogLevel,
  entry: RxLabAuthLogEntry,
) => void;

export interface RxLabAuthOptions {
  issuer: string;
  clientId: string;
  clientSecret: string;
  /** Auth.js sign-in page. Defaults to `/login`. */
  signInPage?: string;
  /** OAuth scopes. Defaults to `openid email profile offline_access`. */
  scope?: string;
  /** Auth.js session lifetime in seconds. Defaults to 30 days. */
  sessionMaxAge?: number;
  /** Refresh this many seconds before access-token expiry. Defaults to 60. */
  refreshLeeway?: number;
  /** Forwarded to Auth.js. Defaults to true in development. */
  debug?: boolean;
  /** Forwarded to Auth.js. Defaults to true for reverse-proxy deployments. */
  trustHost?: boolean;
  /** Receives redacted lifecycle metadata. Token values are never included. */
  logger?: RxLabAuthLogger;
  /** Injectable for tests and runtimes with a custom fetch implementation. */
  fetch?: typeof globalThis.fetch;
}

interface RxLabTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

interface RxLabJWTFields {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  roles?: string[];
  error?: string;
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    error?: string;
  }

  interface User {
    roles?: string[];
  }
}

function requireOption(name: string, value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError(`${name} is required`);
  return normalized;
}

function normalizeIssuer(issuer: string): string {
  return requireOption("issuer", issuer).replace(/\/+$/, "");
}

function isTokenResponse(value: unknown): value is RxLabTokenResponse {
  if (!value || typeof value !== "object") return false;
  const token = value as Record<string, unknown>;
  return (
    typeof token.access_token === "string" &&
    typeof token.expires_in === "number"
  );
}

function defaultLogger(
  enabled: boolean,
): RxLabAuthLogger | undefined {
  if (!enabled) return undefined;
  return (level, entry) => {
    const message = `[rxlab auth] ${entry.event}`;
    if (level === "error") console.error(message, entry);
    else if (level === "warn") console.warn(message, entry);
    else console.log(message, entry);
  };
}

/**
 * Build an Auth.js configuration for the RxLab OIDC provider.
 *
 * Access-token expiry is deliberately stored under `expiresAt`, not Auth.js's
 * reserved JWT `exp` claim, so the longer-lived session can refresh tokens.
 */
export function createRxLabAuthConfig(
  options: RxLabAuthOptions,
): NextAuthConfig {
  const issuer = normalizeIssuer(options.issuer);
  const clientId = requireOption("clientId", options.clientId);
  const clientSecret = requireOption("clientSecret", options.clientSecret);
  const debug =
    options.debug ??
    (typeof process !== "undefined" && process.env.NODE_ENV === "development");
  const logger = options.logger ?? defaultLogger(debug);
  const fetchImpl = options.fetch ?? globalThis.fetch;
  const refreshLeeway = options.refreshLeeway ?? 60;

  if (!Number.isFinite(refreshLeeway) || refreshLeeway < 0) {
    throw new TypeError("refreshLeeway must be a non-negative number");
  }
  if (typeof fetchImpl !== "function") {
    throw new TypeError("A fetch implementation is required");
  }

  async function refreshAccessToken(refreshToken: string) {
    const response = await fetchImpl(`${issuer}/api/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
      }),
    });

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = undefined;
    }

    if (!response.ok || !isTokenResponse(body)) {
      const error = new Error(`RxLab token refresh failed (${response.status})`);
      Object.assign(error, { status: response.status });
      throw error;
    }

    return {
      accessToken: body.access_token,
      refreshToken: body.refresh_token ?? refreshToken,
      expiresAt: Math.floor(Date.now() / 1000) + body.expires_in,
    };
  }

  return {
    debug,
    providers: [
      {
        id: RX_LAB_PROVIDER_ID,
        name: "RxLab",
        type: "oidc",
        issuer,
        clientId,
        clientSecret,
        client: {
          token_endpoint_auth_method: "client_secret_post",
        },
        authorization: {
          params: {
            scope: options.scope ?? "openid email profile offline_access",
          },
        },
      },
    ],
    callbacks: {
      async jwt({ token, account, profile }) {
        const rxLabToken = token as typeof token & RxLabJWTFields;
        if (account) {
          if (!account.access_token || !account.expires_at) {
            throw new TypeError(
              "RxLab did not return an access token and expiry",
            );
          }
          const { exp: _sessionExpiry, ...rest } = rxLabToken;
          logger?.("debug", {
            event: "initial-login",
            hasRefreshToken: Boolean(account.refresh_token),
            expiresAt: account.expires_at,
          });
          return {
            ...rest,
            accessToken: account.access_token,
            refreshToken: account.refresh_token,
            expiresAt: account.expires_at,
            userId: profile?.sub,
            roles: Array.isArray(profile?.roles)
              ? (profile.roles as string[])
              : [],
          };
        }

        if (
          rxLabToken.expiresAt &&
          Date.now() < rxLabToken.expiresAt * 1000 - refreshLeeway * 1000
        ) {
          return token;
        }

        const { exp: _sessionExpiry, ...rest } = rxLabToken;
        logger?.("debug", {
          event: "refresh-needed",
          hasRefreshToken: Boolean(rxLabToken.refreshToken),
          expiresAt: rxLabToken.expiresAt ?? null,
        });

        if (!rxLabToken.refreshToken) {
          logger?.("warn", {
            event: "refresh-missing-token",
            hasRefreshToken: false,
            expiresAt: rxLabToken.expiresAt ?? null,
          });
          return { ...rest, error: RX_LAB_REFRESH_TOKEN_ERROR };
        }

        try {
          const fresh = await refreshAccessToken(rxLabToken.refreshToken);
          logger?.("debug", {
            event: "refresh-succeeded",
            hasRefreshToken: true,
            expiresAt: fresh.expiresAt,
          });
          return {
            ...rest,
            accessToken: fresh.accessToken,
            refreshToken: fresh.refreshToken,
            expiresAt: fresh.expiresAt,
            error: undefined,
          };
        } catch (error) {
          const status =
            error instanceof Error &&
            "status" in error &&
            typeof error.status === "number"
              ? error.status
              : undefined;
          logger?.("error", {
            event: "refresh-failed",
            hasRefreshToken: true,
            expiresAt: rxLabToken.expiresAt ?? null,
            ...(status === undefined ? {} : { status }),
          });
          return { ...rest, error: RX_LAB_REFRESH_TOKEN_ERROR };
        }
      },
      async session({ session, token }) {
        const rxLabToken = token as typeof token & RxLabJWTFields;
        if (session.user) {
          if (rxLabToken.userId) session.user.id = rxLabToken.userId;
          if (token.name) session.user.name = token.name;
          if (token.email) session.user.email = token.email;
          session.user.roles = rxLabToken.roles ?? [];
        }
        session.accessToken = rxLabToken.accessToken;
        session.error = rxLabToken.error;
        return session;
      },
    },
    pages: { signIn: options.signInPage ?? "/login" },
    trustHost: options.trustHost ?? true,
    session: {
      strategy: "jwt",
      maxAge: options.sessionMaxAge ?? 30 * 24 * 60 * 60,
    },
  };
}

/** Create the complete Auth.js result used by route handlers and applications. */
export function createRxLabAuth(options: RxLabAuthOptions): NextAuthResult {
  return NextAuth(createRxLabAuthConfig(options));
}
