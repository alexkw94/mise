"use client";

/**
 * The mise wordmark.
 *
 * Rendered as real text rather than as the SVG from `logo/mise-light.svg`,
 * for three reasons: the logo's own spec asks for the system sans that the
 * app already uses, live text stays crisp at every size and pixel density,
 * and the wordmark inherits `currentColor` so it works on light and dark
 * ground without a second asset.
 *
 * Proportions are taken from the SVG and expressed in `em`, so they hold at
 * any size: dot diameter 0.222em (r=20 at font-size 180), gap 0.11em, dot
 * centred on the baseline (cy 315 = baseline y).
 */
export function Logo({
  size = 22,
  className,
}: {
  /** Type size in px; the dot and its gap scale from it. */
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={className}
      style={{ fontSize: size, lineHeight: 1, display: "inline-block" }}
      // One accessible name for the whole mark — a screen reader should hear
      // "mise", not "mise" followed by a stray decorative dot.
      role="img"
      aria-label="mise"
    >
      <span aria-hidden="true" className="mlk-logo-word">
        mise
      </span>
      <span aria-hidden="true" className="mlk-logo-dot" />
    </span>
  );
}
