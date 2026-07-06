import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Admin Generator Example",
  description: "Schema-driven admin UI demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
