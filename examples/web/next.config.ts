import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The admin package ships unbundled ESM with "use client" directives intact;
  // let Next transpile it from source in the workspace.
  transpilePackages: ["@rxtech-lab/admin-next"],
  images: {
    remotePatterns: [{ protocol: "https", hostname: "i.pravatar.cc" }],
  },
};

export default nextConfig;
