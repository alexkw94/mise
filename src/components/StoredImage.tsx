"use client";

import { useEffect, useState } from "react";
import { getImage } from "@/lib/idb";

/**
 * Renders a blob from IndexedDB. Object URLs are revoked on unmount so a long
 * scroll through many recipe cards does not leak them.
 */
export function StoredImage({
  id,
  src,
  alt,
  className,
}: {
  id: string | null;
  /** Hosted URL; wins over `id` because it works on every device. */
  src?: string | null;
  alt: string;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (src) {
      setUrl(src);
      return;
    }
    if (!id) {
      setUrl(null);
      return;
    }
    let revoked = false;
    let objectUrl: string | null = null;

    getImage(id)
      .then((blob) => {
        if (!blob || revoked) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => setUrl(null));

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setUrl(null);
    };
  }, [id, src]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element -- blob: URLs cannot go through next/image
  return <img src={url} alt={alt} className={className} />;
}
