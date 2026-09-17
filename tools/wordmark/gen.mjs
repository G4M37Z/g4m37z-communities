// tools/wordmark/gen.mjs
//
// G4M37Z wordmark generator. Hand-drawn calligraphic caps from skeleton
// strokes with a variable-width "brush": each control polyline is smoothed
// (Catmull-Rom), then offset by half its stroke width along the local normal
// and closed with round caps. Thick downstrokes / thin upstrokes give the
// calligraphic contrast; a copper spark (circle) echoes the dot in the mark.
//
//   node tools/wordmark/gen.mjs
//
// Writes src/components/brand/BrandWordmark.tsx plus preview/ink/skeleton
// SVGs in tools/wordmark/out/ for inspection. Edit the glyph skeletons and
// width profiles here — never the generated component's path data.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const OUT = path.join(HERE, "out");
fs.mkdirSync(OUT, { recursive: true });

const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const norm = (v) => { const l = Math.hypot(v[0], v[1]) || 1; return [v[0] / l, v[1] / l]; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const fmt = (p) => p[0].toFixed(1) + " " + p[1].toFixed(1);

function catmullRom(pts, seg) {
  if (pts.length < 2) return pts.slice();
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 0; i < P.length - 3; i++) {
    const p0 = P[i], p1 = P[i + 1], p2 = P[i + 2], p3 = P[i + 3];
    for (let s = 0; s < seg; s++) {
      const t = s / seg, t2 = t * t, t3 = t2 * t;
      out.push([
        0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
      ]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

// width profile: [[t, width], ...] with t = fraction of arc length
function interpWF(wf, t) {
  if (t <= wf[0][0]) return wf[0][1];
  for (let i = 0; i < wf.length - 1; i++) {
    const [t0, w0] = wf[i], [t1, w1] = wf[i + 1];
    if (t <= t1) { const k = (t - t0) / ((t1 - t0) || 1); return w0 + (w1 - w0) * k; }
  }
  return wf[wf.length - 1][1];
}

const SEG = 7;          // samples per control-point span (7 keeps paths ~8.6KB)
const CAP_STEPS = 8;    // segments used to approximate round end caps

function stroke(ctrl, wf) {
  const samples = catmullRom(ctrl, SEG);
  const n = samples.length;
  const cum = [0];
  for (let i = 1; i < n; i++) cum.push(cum[i - 1] + dist(samples[i - 1], samples[i]));
  const total = cum[n - 1] || 1;
  const widths = samples.map((_, i) => interpWF(wf, cum[i] / total) / 2); // wf = total width
  const L = [], R = [];
  for (let i = 0; i < n; i++) {
    let t;
    if (i === 0) t = sub(samples[1], samples[0]);
    else if (i === n - 1) t = sub(samples[n - 1], samples[n - 2]);
    else t = sub(samples[i + 1], samples[i - 1]);
    t = norm(t);
    const nx = -t[1], ny = t[0];
    L.push([samples[i][0] + nx * widths[i], samples[i][1] + ny * widths[i]]);
    R.push([samples[i][0] - nx * widths[i], samples[i][1] - ny * widths[i]]);
  }
  let d = "M " + fmt(L[0]);
  for (let i = 1; i < n; i++) d += " L " + fmt(L[i]);

  // round end caps as point arcs (keeps one path per stroke and side-steps
  // SVG arc sweep-flag guesswork)
  const end = samples[n - 1], start = samples[0];
  const tEnd = norm(sub(samples[n - 1], samples[n - 2]));
  const tStart = norm(sub(samples[1], samples[0]));
  const nEnd = [-tEnd[1], tEnd[0]];
  const nStart = [-tStart[1], tStart[0]];
  const rot = (nn, th) => [nn[0] * Math.cos(th) - nn[1] * Math.sin(th), nn[0] * Math.sin(th) + nn[1] * Math.cos(th)];
  for (let k = 1; k < CAP_STEPS; k++) {
    const v = rot(nEnd, -Math.PI * k / CAP_STEPS);
    d += " L " + fmt([end[0] + widths[n - 1] * v[0], end[1] + widths[n - 1] * v[1]]);
  }
  for (let i = n - 1; i >= 0; i--) d += " L " + fmt(R[i]);
  for (let k = 1; k < CAP_STEPS; k++) {
    const v = rot(nStart, Math.PI - Math.PI * k / CAP_STEPS);
    d += " L " + fmt([start[0] + widths[0] * v[0], start[1] + widths[0] * v[1]]);
  }
  d += " Z";
  return { d, samples, widths };
}

// Per-glyph horizontal shift. Gaps are measured between real stroke edges:
// at DX=0 the G stem (x16.6 + 1.5) and the 4 diagonal (x19 − 1.1) touched,
// and the 7/Z top bars sat 1.2 units apart.
let DX = 0;
const S = (ctrl, wf) => stroke(ctrl.map(([x, y]) => [x + DX, y]), wf);

// glyphs on a cap-height-24 grid: top y=6, baseline y=30
const glyphs = [];

// G
DX = 0;
glyphs.push(
  S([[15.8, 8.2], [9.6, 6.0], [4.2, 8.4], [2.2, 14.2], [2.4, 20.4], [5.2, 26.8], [11.0, 30.0], [16.2, 28.0]],
    [[0, 1.4], [0.22, 2.6], [0.45, 3.2], [0.72, 2.6], [1, 1.8]]),
  S([[8.2, 20.2], [16.6, 20.2]], [[0, 1.5], [0.5, 1.7], [1, 2.4]]),
  S([[16.6, 20.2], [16.6, 28.2]], [[0, 2.6], [1, 3.0]]),
);

// 4
DX = 2.5;
glyphs.push(
  S([[31.4, 6.8], [25.6, 15.0], [20.6, 24.0], [19.0, 27.2]], [[0, 2.4], [0.6, 3.0], [1, 2.2]]),
  S([[19.0, 27.2], [33.0, 27.2]], [[0, 1.5], [0.5, 1.8], [1, 1.5]]),
  S([[31.4, 6.8], [31.4, 30.0]], [[0, 2.4], [0.5, 3.2], [1, 3.0]]),
);

// M
DX = 2.5;
glyphs.push(
  S([[37.4, 30.0], [37.4, 6.6]], [[0, 2.8], [1, 3.1]]),
  S([[37.4, 6.6], [45.9, 22.8]], [[0, 2.4], [0.5, 2.8], [1, 2.2]]),
  S([[45.9, 22.8], [54.4, 6.6]], [[0, 1.8], [0.5, 1.5], [1, 1.4]]),
  S([[54.4, 6.6], [54.4, 30.0]], [[0, 2.4], [0.5, 3.2], [1, 3.0]]),
);

// 3 — one continuous spine through both bowls
DX = 2.5;
glyphs.push(
  S([[59.2, 9.0], [63.4, 6.6], [67.6, 8.0], [69.0, 11.8], [66.8, 15.4], [62.6, 17.4], [67.4, 18.2], [69.8, 22.0], [68.8, 27.2], [63.6, 30.0], [58.6, 28.4]],
    [[0, 1.4], [0.2, 2.2], [0.42, 1.9], [0.55, 1.5], [0.78, 3.0], [1, 2.0]]),
);

// 7
DX = 3.0;
glyphs.push(
  S([[73.6, 6.6], [86.6, 6.6]], [[0, 1.4], [0.5, 1.8], [1, 1.4]]),
  S([[86.6, 6.6], [78.2, 30.0]], [[0, 2.4], [0.55, 3.1], [1, 2.4]]),
);

// Z
DX = 5.5;
glyphs.push(
  S([[89.4, 6.6], [102.6, 6.6]], [[0, 1.4], [0.5, 1.8], [1, 1.4]]),
  S([[102.6, 6.6], [89.8, 29.6]], [[0, 2.4], [0.55, 3.1], [1, 2.5]]),
  S([[89.4, 29.6], [102.6, 29.6]], [[0, 1.4], [0.5, 1.8], [1, 1.5]]),
);

const all = glyphs.flat();

// spark: copper dot continuing the "call & response" dot from the mark
const SPARK = { x: 114.6, y: 29.2, r: 2.4 };

// tight ink bounds (samples +/- half stroke width), plus the spark
let bx0 = 1e9, by0 = 1e9, bx1 = -1e9, by1 = -1e9;
for (const s of all) {
  for (let i = 0; i < s.samples.length; i++) {
    const [x, y] = s.samples[i], w = s.widths[i];
    bx0 = Math.min(bx0, x - w); by0 = Math.min(by0, y - w);
    bx1 = Math.max(bx1, x + w); by1 = Math.max(by1, y + w);
  }
}
bx0 = Math.min(bx0, SPARK.x - SPARK.r); by0 = Math.min(by0, SPARK.y - SPARK.r);
bx1 = Math.max(bx1, SPARK.x + SPARK.r); by1 = Math.max(by1, SPARK.y + SPARK.r);
const PAD = 0.6;
const VB = [bx0 - PAD, by0 - PAD, bx1 - bx0 + 2 * PAD, by1 - by0 + 2 * PAD];
const VB_STR = VB.map((v) => +v.toFixed(2)).join(" ");
const RATIO = VB[2] / VB[3];

// ---------------------------------------------------------------- component
const paths = all.map((s) => `        <path d="${s.d}" />`).join("\n");
const component = `// src/components/brand/BrandWordmark.tsx
// AUTO-GENERATED by tools/wordmark/gen.mjs — do not edit the path data by hand.
// G4M37Z wordmark: hand-drawn calligraphic caps (variable-width brush strokes,
// thick downstrokes / thin upstrokes) with a copper spark echoing the mark's
// dot. Inline (not <img>) so it inherits currentColor and stays theme-aware.

interface BrandWordmarkProps {
  height?: number;
  className?: string;
  title?: string;
}

const VIEW_BOX = "${VB_STR}";
const RATIO = ${RATIO.toFixed(4)};

export function BrandWordmark({ height = 28, className, title }: BrandWordmarkProps) {
  return (
    <svg
      viewBox={VIEW_BOX}
      width={Math.round(height * RATIO * 100) / 100}
      height={height}
      fill="none"
      aria-hidden={title ? undefined : true}
      role={title ? "img" : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      <g fill="currentColor">
${paths}
      </g>
      <circle cx="${SPARK.x}" cy="${SPARK.y}" r="${SPARK.r}" className="fill-accent" />
    </svg>
  );
}
`;
fs.writeFileSync(path.join(ROOT, "src/components/brand/BrandWordmark.tsx"), component);

// ------------------------------------------------------------- dev previews
const letters = `<g fill="currentColor">${all.map((s) => `<path d="${s.d}"/>`).join("")}</g>`;
const wordmarkSvg = (fill, accent) =>
  `${letters.replace(/currentColor/g, fill)}<circle cx="${SPARK.x}" cy="${SPARK.y}" r="${SPARK.r}" fill="${accent}"/>`;
const markSvg = (fill) =>
  `<g transform="scale(0.625)" fill="none" stroke="${fill}" stroke-linecap="round">
     <path d="M 17.03 29.31 A 15.5 15.5 0 0 1 46.47 28.31" stroke-width="11"/>
     <path d="M 25.5 49.5 A 16 16 0 0 0 50 49.5" stroke-width="11"/>
     <circle cx="54.6" cy="39.8" r="4.8" fill="${fill}" stroke="none"/>
   </g>`;
const lockup = (fill, accent) => `${markSvg(fill)}<g transform="translate(48,4)">${wordmarkSvg(fill, accent)}</g>`;

const W = 1500, H = 760;
const preview = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H / 2}" fill="#0B0C0E"/>
  <rect y="${H / 2}" width="${W}" height="${H / 2}" fill="#F3F0E8"/>
  <g transform="translate(70,50) scale(3.2)">${lockup("#F5F5F3", "#B4633C")}</g>
  <g transform="translate(70,270) scale(1.0)">${lockup("#F5F5F3", "#B4633C")}</g>
  <g transform="translate(420,270) scale(0.65)">${lockup("#F5F5F3", "#B4633C")}</g>
  <g transform="translate(70,430) scale(3.2)">${lockup("#111114", "#A44F28")}</g>
  <g transform="translate(70,650) scale(1.0)">${lockup("#111114", "#A44F28")}</g>
  <g transform="translate(420,650) scale(0.65)">${lockup("#111114", "#A44F28")}</g>
</svg>`;
fs.writeFileSync(path.join(OUT, "preview.svg"), preview);
fs.writeFileSync(path.join(OUT, "ink.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VB[2].toFixed(1)} ${VB[3].toFixed(1)}" width="1180" height="${Math.round(1180 * VB[3] / VB[2])}">${wordmarkSvg("#000", "#000")}</svg>`);
fs.writeFileSync(path.join(OUT, "skeleton.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 40" width="1200" height="400">` +
  all.map((s) => `<path d="M ${s.samples.map(fmt).join(" L ")}" stroke="#000" stroke-width="0.5" fill="none"/>`).join("") +
  `</svg>`);

console.log("viewBox", VB_STR, "ratio", RATIO.toFixed(4),
  "paths", all.length, "component bytes", component.length);
