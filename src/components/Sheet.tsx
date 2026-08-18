"use client";

import { useEffect, type ReactNode } from "react";

/** Bottom sheet. Backdrop click and Escape both dismiss. */
export function Sheet({
  title,
  subtitle,
  brand,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  /** Optional mark above the title — used where the app introduces itself. */
  brand?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Stop the page behind the sheet from scrolling with it.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <div className="mlk-sheet-backdrop" onClick={onClose} aria-hidden="true" />
      <div
        className="mlk-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex flex-none items-start justify-between gap-3 px-[22px] pt-5 pb-3">
          <div className="min-w-0">
            {brand && <div className="mb-2">{brand}</div>}
            <h2 className="mlk-t-display" style={{ fontSize: 22 }}>
              {title}
            </h2>
            {subtitle && <p className="mlk-t-meta mt-1">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="mlk-icon-btn -mr-2 flex-none"
            aria-label="Schliessen"
          >
            ✕
          </button>
        </div>

        <div className="mlk-scroll min-h-0 flex-1 overflow-y-auto px-[22px] pb-2">
          {children}
        </div>

        {footer && (
          <div
            className="flex-none px-[22px] pt-3"
            style={{ borderTop: "0.5px solid var(--hairline)" }}
          >
            {footer}
          </div>
        )}
      </div>
    </>
  );
}
