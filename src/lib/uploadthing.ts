"use client";

import { generateReactHelpers } from "@uploadthing/react";
import type { MiseFileRouter } from "@/app/api/uploadthing/core";

/**
 * Client helpers, typed against the file router. Importing the router's *type*
 * costs nothing at runtime — no server code reaches the bundle.
 */
export const { useUploadThing } = generateReactHelpers<MiseFileRouter>();
