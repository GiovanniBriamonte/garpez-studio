import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The home page is the garpez.tv television: a static page in public/tv/ (built by tools/build_site.py).
  async rewrites() {
    return {
      beforeFiles: [{ source: "/", destination: "/tv/index.html" }],
      afterFiles: [],
      fallback: [],
    };
  },
  /* config options here */
  experimental: {
    agentFeedback: true,
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
