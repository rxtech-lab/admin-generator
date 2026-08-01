# @rxtech-lab/authjs-rxlab

Auth.js v5 integration for the RxLab OIDC service. It configures the RxLab
provider, keeps the OAuth access token and app-specific roles on the session,
and rotates expired access tokens without shortening the Auth.js session.

## Install

```bash
bun add @rxtech-lab/authjs-rxlab next-auth@beta
```

## Usage

```ts
// lib/auth.ts
import { createRxLabAuth } from "@rxtech-lab/authjs-rxlab";

export const { handlers, signIn, signOut, auth, proxy } = createRxLabAuth({
  issuer: process.env.AUTH_ISSUER!,
  clientId: process.env.AUTH_CLIENT_ID!,
  clientSecret: process.env.AUTH_CLIENT_SECRET!,
  signInPage: "/login",
});
```

```ts
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

Add a root `src/proxy.ts` so Auth.js owns an outgoing response on application
requests and can persist rotated refresh tokens:

```ts
// src/proxy.ts
export { proxy as default } from "@/lib/auth";

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

The matcher excludes Auth.js endpoints, Next.js static/image requests, and
common metadata or image assets. Keep the proxy enabled for every route that
may read the session.

Sign in with the provider ID `rxlab`:

```ts
await signIn("rxlab", { redirectTo: "/admin" });
```

The resulting session includes the access token and RxLab roles:

```ts
const session = await auth();
const bearer = session?.accessToken;
const isAdmin = session?.user?.roles?.includes("admin") ?? false;
```

## Environment

The application still owns Auth.js's standard `AUTH_SECRET` and public base URL
configuration. Pass the RxLab client values explicitly so missing configuration
fails at startup instead of during an OAuth callback.

```dotenv
AUTH_ISSUER=https://auth.rxlab.app
AUTH_CLIENT_ID=your-client-id
AUTH_CLIENT_SECRET=your-client-secret
AUTH_SECRET=replace-with-a-random-secret
```

The RxLab OAuth client must allow your Auth.js callback URL and the scopes
`openid email profile offline_access`.

## Refresh behavior

Exporting `proxy` is required for reliable refresh-token rotation. Auth.js
5.0.0-beta.31's no-argument `auth()` path for React Server Components reads the
session response body but does not copy its `Set-Cookie` header to a browser
response. An RSC call can therefore refresh successfully in that invocation
while the browser keeps the old JWT cookie. Once RxLab's grace window for the
old refresh token closes, a later refresh fails with `invalid_grant`.

The package's `proxy` is pre-wrapped through Auth.js's request/response path,
which copies the refreshed session cookie to the outgoing response. Continue
using `auth()` in Server Components to read the session, but do not rely on RSC
`auth()` calls alone to persist token rotation.

- Uses an encrypted Auth.js JWT session lasting 30 days by default.
- Stores OAuth expiry in `expiresAt`, separate from Auth.js's reserved `exp`.
- Refreshes access tokens 60 seconds before expiry.
- Persists a rotated refresh token, or keeps the previous token when the server
  does not return a replacement.
- Exposes `RefreshTokenError` on `session.error` when re-authentication is
  required.
- Logs only token presence, expiry, event, HTTP status, and sanitized OAuth
  `error`/`error_description` details. Known token and client-secret values are
  redacted and all other response fields are discarded.

All defaults can be adjusted through `RxLabAuthOptions`. Advanced applications
can call `createRxLabAuthConfig(options)` and inspect or extend the resulting
Auth.js configuration before passing it to `NextAuth`.
