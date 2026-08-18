/**
 * Renders the PWA icon set from the mise brand mark. Run with `npm run icons`.
 *
 * Geometry is transcribed from `logo/mise-icon-light_1.svg`: the "m" and the
 * silver dot on a #f5f5f7 ground, rounded at rx 112/512. Rasterised through
 * headless Chrome so the mark uses the same system sans as the app and the
 * logo spec, rather than a bundled font we would have to ship.
 *
 * Three variants, because the platforms want different things:
 *   web       rounded corners, transparent outside them — how it appears in a
 *             tab or task switcher
 *   apple     square, opaque, full bleed — iOS applies its own squircle mask,
 *             and baked corners under that mask leave pale slivers at the
 *             edges; iOS also composites transparency onto black
 *   maskable  square, opaque, mark scaled into the 80% safe zone — Android may
 *             crop it to a circle, so it must fill the whole canvas
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, copyFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "public");

const CHROME =
  process.env.CHROME_PATH ??
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

/** @param {{size:number, radius:number, scale:number}} opts */
function svg({ size, radius, scale }) {
  const inner =
    `<text x="150" y="340" font-family="-apple-system, 'Helvetica Neue', Arial, sans-serif" ` +
    `font-size="260" font-weight="500" fill="#17181a">m</text>` +
    `<circle cx="372" cy="340" r="26" fill="url(#silverDot)"/>`;

  // Scale about the centre of the 512 artboard.
  const body =
    scale === 1
      ? inner
      : `<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${inner}</g>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="silverDot" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e4e6e9"/>
      <stop offset="0.5" stop-color="#b9bec4"/>
      <stop offset="1" stop-color="#90969d"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="512" height="512" rx="${radius}" fill="#f5f5f7"/>
  ${body}
</svg>`;
}

const targets = [
  { file: "icon-192.png", size: 192, radius: 112, scale: 1, transparent: true },
  { file: "icon-512.png", size: 512, radius: 112, scale: 1, transparent: true },
  { file: "apple-touch-icon.png", size: 180, radius: 0, scale: 1, transparent: false },
  { file: "icon-maskable-512.png", size: 512, radius: 0, scale: 0.72, transparent: false },
];

mkdirSync(OUT, { recursive: true });
const work = mkdtempSync(join(tmpdir(), "mise-icons-"));

try {
  for (const t of targets) {
    // A page background the colour of the mark would hide the rounded corners
    // entirely; leave it transparent and let the SVG's own rect draw the shape.
    const bg = t.transparent ? "transparent" : "#f5f5f7";
    const html = `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:${bg}}svg{display:block}</style>
${svg(t)}`;
    const page = join(work, `${t.file}.html`);
    writeFileSync(page, html);

    execFileSync(
      CHROME,
      [
        "--headless",
        "--disable-gpu",
        "--hide-scrollbars",
        `--window-size=${t.size},${t.size}`,
        ...(t.transparent ? ["--default-background-color=00000000"] : []),
        `--screenshot=${join(work, t.file)}`,
        "--virtual-time-budget=2000",
        `file://${page}`,
      ],
      { stdio: "ignore" },
    );

    copyFileSync(join(work, t.file), join(OUT, t.file));
    console.log(`wrote public/${t.file} (${t.size}×${t.size})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
