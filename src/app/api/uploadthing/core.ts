import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";

const f = createUploadthing();

/**
 * Where recipe photos go.
 *
 * The app is single-user and has no login, so there is no session to check
 * here. What the middleware does instead is refuse requests that did not come
 * from the app's own pages. That stops a browser on someone else's site from
 * using this endpoint; it does **not** stop a determined person with curl.
 *
 * For a personal collection on an obscure URL that is proportionate. If the
 * 2 GB ever starts filling with things you did not upload, the fix is real
 * auth here, not a bigger allowlist.
 */
const ALLOWED_ORIGINS = [
  process.env.NEXT_PUBLIC_SITE_ORIGIN,
  process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : null,
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
  "http://localhost:3001",
].filter(Boolean) as string[];

export const fileRouter = {
  recipePhoto: f({
    image: {
      // Photos are compressed client-side to a 1600px edge before upload;
      // this is the ceiling for anything that slips past that.
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const origin = req.headers.get("origin");
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        throw new UploadThingError("Von dieser Herkunft nicht erlaubt.");
      }
      return {};
    })
    .onUploadComplete(async ({ file }) => {
      // The return value reaches the client as the upload result. `ufsUrl` is
      // the current field; `url` and `appUrl` are deprecated and go away in v9.
      return { url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type MiseFileRouter = typeof fileRouter;
