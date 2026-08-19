import { createRouteHandler } from "uploadthing/next";
import { fileRouter } from "./core";

/**
 * Needs UPLOADTHING_TOKEN in the server environment. It must never be exposed
 * to the browser — no NEXT_PUBLIC_ prefix, and the client only ever talks to
 * this route, never to UploadThing directly.
 */
export const { GET, POST } = createRouteHandler({ router: fileRouter });
