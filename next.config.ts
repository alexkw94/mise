import type { NextConfig } from "next";

/**
 * Two build shapes from one codebase:
 *
 *   default          Node server — API routes live, AI nutrition works.
 *                    This is `npm run dev` and any Vercel/Node deployment.
 *   STATIC_EXPORT=1  Pre-rendered files only, for GitHub Pages. Pages cannot
 *                    run server code, so the workflow removes src/app/api
 *                    before building and the app computes nutrition locally.
 */
const isStatic = process.env.STATIC_EXPORT === "1";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  ...(isStatic
    ? {
        output: "export",
        // GitHub Pages serves /<repo>/, not the domain root.
        basePath: basePath || undefined,
        // Trailing slashes keep deep links working on a plain file host.
        trailingSlash: true,
        // The image optimizer needs a server; there is none here.
        images: { unoptimized: true },
      }
    : {
        // `headers()` is a server feature and is rejected by `output: export`.
        async headers() {
          return [
            {
              // The service worker must be allowed to control the whole origin.
              source: "/sw.js",
              headers: [
                { key: "Service-Worker-Allowed", value: "/" },
                {
                  key: "Cache-Control",
                  value: "no-cache, no-store, must-revalidate",
                },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
