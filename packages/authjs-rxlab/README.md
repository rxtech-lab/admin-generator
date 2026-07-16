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

export const { handlers, signIn, signOut, auth } = createRxLabAuth({
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

- Uses an encrypted Auth.js JWT session lasting 30 days by default.
- Stores OAuth expiry in `expiresAt`, separate from Auth.js's reserved `exp`.
- Refreshes access tokens 60 seconds before expiry.
- Persists a rotated refresh token, or keeps the previous token when the server
  does not return a replacement.
- Exposes `RefreshTokenError` on `session.error` when re-authentication is
  required.
- Logs only token presence, expiry, event, and HTTP status. Token values are
  never passed to the optional logger.

All defaults can be adjusted through `RxLabAuthOptions`. Advanced applications
can call `createRxLabAuthConfig(options)` and inspect or extend the resulting
Auth.js configuration before passing it to `NextAuth`.
