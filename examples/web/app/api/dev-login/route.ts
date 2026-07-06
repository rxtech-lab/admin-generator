import { cookies } from "next/headers";
import { NextResponse } from "next/server";

// Dev-only: mint a token from the Go server's /dev/login and store it in an
// httpOnly cookie, then redirect to the admin UI. Replace with a real OAuth
// flow (e.g. rxlab-auth) in production.
export async function GET() {
  const apiUrl = process.env.ADMIN_API_URL ?? "http://localhost:8080";
  const res = await fetch(`${apiUrl}/dev/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: "admin" }),
    cache: "no-store",
  });
  if (!res.ok) {
    return NextResponse.json({ error: "dev login failed" }, { status: 502 });
  }
  const { token } = (await res.json()) as { token: string };
  const store = await cookies();
  store.set("admin_token", token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
  return NextResponse.redirect(new URL("/admin", process.env.APP_URL ?? "http://localhost:3000"));
}
