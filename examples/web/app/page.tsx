import Link from "next/link";
import { cookies } from "next/headers";

export default async function Home() {
  const signedIn = (await cookies()).has("admin_token");
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Admin Generator Example</h1>
      <p className="text-sm text-muted-foreground">
        A schema-driven admin UI rendered entirely from the Go backend&apos;s
        JSON schema.
      </p>
      {signedIn ? (
        <Link
          href="/admin"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Open admin →
        </Link>
      ) : (
        <a
          href="/api/dev-login"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
        >
          Sign in (dev)
        </a>
      )}
    </main>
  );
}
