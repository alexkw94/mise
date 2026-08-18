/**
 * Sub-path the app is served from.
 *
 * Empty locally and on any root-domain host. On GitHub Pages the app lives at
 * `/<repo>/`, so every absolute URL the app builds itself — the service
 * worker, the icons, a share link — has to carry this prefix. Next rewrites
 * `<Link>` and imported assets automatically; these are the cases it cannot
 * see.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** True in the static export, where there is no server to answer /api/*. */
export const IS_STATIC = process.env.NEXT_PUBLIC_STATIC === "1";
