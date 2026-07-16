import type { Account, Profile, Session } from "next-auth";
import type { JWT } from "next-auth/jwt";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth", () => ({
  default: vi.fn(() => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
  })),
}));

import {
  createRxLabAuthConfig,
  RX_LAB_PROVIDER_ID,
  RX_LAB_REFRESH_TOKEN_ERROR,
  type RxLabAuthLogger,
} from "./index";

const baseOptions = {
  issuer: "https://auth.rxlab.app/",
  clientId: "admin-client",
  clientSecret: "client-secret",
  debug: false,
};

function callbacks(options = baseOptions) {
  const config = createRxLabAuthConfig(options);
  if (!config.callbacks?.jwt || !config.callbacks.session) {
    throw new Error("Auth callbacks were not configured");
  }
  return config.callbacks;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createRxLabAuthConfig", () => {
  it("configures the RxLab OIDC provider and long-lived JWT session", () => {
    const config = createRxLabAuthConfig(baseOptions);
    const provider = config.providers[0];

    expect(provider).toMatchObject({
      id: RX_LAB_PROVIDER_ID,
      name: "RxLab",
      type: "oidc",
      issuer: "https://auth.rxlab.app",
      clientId: "admin-client",
      clientSecret: "client-secret",
      client: { token_endpoint_auth_method: "client_secret_post" },
      authorization: {
        params: { scope: "openid email profile offline_access" },
      },
    });
    expect(config.pages).toEqual({ signIn: "/login" });
    expect(config.session).toEqual({
      strategy: "jwt",
      maxAge: 30 * 24 * 60 * 60,
    });
    expect(config.trustHost).toBe(true);
  });

  it("rejects missing credentials and invalid refresh leeway", () => {
    expect(() =>
      createRxLabAuthConfig({ ...baseOptions, issuer: " " }),
    ).toThrow("issuer is required");
    expect(() =>
      createRxLabAuthConfig({ ...baseOptions, refreshLeeway: -1 }),
    ).toThrow("refreshLeeway must be a non-negative number");
  });

  it("stores initial login state without preserving the reserved exp claim", async () => {
    const result = await callbacks().jwt({
      token: { exp: 123, name: "Admin" },
      account: {
        access_token: "access-one",
        refresh_token: "refresh-one",
        expires_at: 2_000,
      } as Account,
      profile: { sub: "oauth:user-1", roles: ["admin"] } as Profile,
      trigger: "signIn",
      user: {} as never,
      isNewUser: false,
    });

    expect(result).toMatchObject({
      name: "Admin",
      accessToken: "access-one",
      refreshToken: "refresh-one",
      expiresAt: 2_000,
      userId: "oauth:user-1",
      roles: ["admin"],
    });
    expect(result).not.toHaveProperty("exp");
  });

  it("keeps an access token that is outside the refresh window", async () => {
    vi.spyOn(Date, "now").mockReturnValue(1_000_000);
    const token: JWT = {
      accessToken: "access-one",
      refreshToken: "refresh-one",
      expiresAt: 2_000,
    };

    const result = await callbacks().jwt({ token, trigger: "update" });

    expect(result).toBe(token);
  });

  it("refreshes an expired access token and persists rotation", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          access_token: "access-two",
          refresh_token: "refresh-two",
          expires_in: 3_600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await callbacks({ ...baseOptions, fetch: fetchMock }).jwt({
      token: {
        exp: 99,
        accessToken: "access-one",
        refreshToken: "refresh-one",
        expiresAt: 1_900,
        roles: ["admin"],
      },
      trigger: "update",
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://auth.rxlab.app/api/oauth/token");
    expect(init.method).toBe("POST");
    expect(init.body?.toString()).toBe(
      "grant_type=refresh_token&refresh_token=refresh-one&client_id=admin-client&client_secret=client-secret",
    );
    expect(result).toMatchObject({
      accessToken: "access-two",
      refreshToken: "refresh-two",
      expiresAt: 5_600,
      roles: ["admin"],
    });
    expect(result).not.toHaveProperty("exp");
  });

  it("preserves the old refresh token when the endpoint does not rotate it", async () => {
    vi.spyOn(Date, "now").mockReturnValue(2_000_000);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ access_token: "access-two", expires_in: 3_600 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await callbacks({ ...baseOptions, fetch: fetchMock }).jwt({
      token: { refreshToken: "refresh-one", expiresAt: 1_900 },
      trigger: "update",
    });

    expect(result.refreshToken).toBe("refresh-one");
  });

  it("sets a session error when no refresh token is available", async () => {
    const result = await callbacks().jwt({
      token: { exp: 99, expiresAt: 1 },
      trigger: "update",
    });

    expect(result.error).toBe(RX_LAB_REFRESH_TOKEN_ERROR);
    expect(result).not.toHaveProperty("exp");
  });

  it("reports refresh failures without exposing credentials to the logger", async () => {
    const logger = vi.fn<RxLabAuthLogger>();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          error: "invalid_grant",
          leaked_value: "refresh-one",
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      ),
    );
    const result = await callbacks({
      ...baseOptions,
      fetch: fetchMock,
      logger,
    }).jwt({
      token: { refreshToken: "refresh-one", expiresAt: 1 },
      trigger: "update",
    });

    expect(result.error).toBe(RX_LAB_REFRESH_TOKEN_ERROR);
    expect(logger).toHaveBeenLastCalledWith("error", {
      event: "refresh-failed",
      hasRefreshToken: true,
      expiresAt: 1,
      status: 401,
    });
    expect(JSON.stringify(logger.mock.calls)).not.toContain("refresh-one");
    expect(JSON.stringify(logger.mock.calls)).not.toContain("client-secret");
  });

  it("projects the access token, identity, roles, and error onto the session", async () => {
    const session: Session = {
      user: { id: "temporary", name: "Old", email: "old@example.com" },
      expires: "2099-01-01T00:00:00.000Z",
    };
    const result = await callbacks().session({
      session,
      token: {
        userId: "oauth:user-1",
        name: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
        accessToken: "access-one",
        error: RX_LAB_REFRESH_TOKEN_ERROR,
      },
      trigger: "update",
      newSession: undefined,
    });

    expect(result).toMatchObject({
      accessToken: "access-one",
      error: RX_LAB_REFRESH_TOKEN_ERROR,
      user: {
        id: "oauth:user-1",
        name: "Admin",
        email: "admin@example.com",
        roles: ["admin"],
      },
    });
  });
});
