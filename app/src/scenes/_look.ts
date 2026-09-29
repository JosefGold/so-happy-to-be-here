// Shared look for "Happy to be here": two lights, the Human's fire and the AI's cobalt; the Human is a
// black silhouette and speaks in Archivo; the AI speaks in IBM Plex Mono with a block cursor; the third
// voice is Cormorant italic. Lyrics are set editorially (Swiss grid, asymmetric, hairlines) and
// synced per word. Everything is a pure function of time (docs/ENGINE.md, "Deterministic").
import { F, font } from '../engine/type';
import { rgba, type PaletteKey } from '../engine/palette';
import { clamp, ease } from '../engine/util';
import type { Word } from '../engine/lyrics';

export const TYPE = {
  /** The Human: Archivo; width 62..125 and weight 300..900 are expressive axes. */
  human: (size: number, width = 100, weight = 800) => font(F.archivo(width, weight), size),
  humanFamily: (width = 100, weight = 800) => F.archivo(width, weight),
  /** The AI: IBM Plex Mono in cobalt, always with the block cursor. */
  ai: (size: number, weight = 400) => font(F.mono(weight), size),
  aiFamily: (weight = 400) => F.mono(weight),
  /** The interlude's third voice: Cormorant italic. */
  third: (size: number, weight = 400) => font(F.serif(weight, true), size),
  thirdFamily: (weight = 400) => F.serif(weight, true),
};

export const col = (k: PaletteKey | string, a = 1) => rgba(k, a);

/**
 * Karaoke state of a word: `pre` rises 0 -> 1 in the 0.4 s before it is sung (dim anticipation),
 * `on` snaps 0 -> 1 over the first 60 ms of the word (it never runs ahead of the voice).
 */
export function wordState(w: Word, t: number) {
  const pre = clamp((t - (w.start - 0.4)) / 0.4);
  const on = clamp((t - w.start) / 0.06);
  return { pre, on, sung: t >= w.start };
}

/** Alpha of a word: unsung words sit at `dim` (after their anticipation), sung ones at 1. */
export const wordAlpha = (w: Word, t: number, dim = 0.28) => {
  const s = wordState(w, t);
  return s.pre * dim + s.on * (1 - dim);
};

/** Blinking block cursor: on for 55% of each period. */
export const cursorOn = (t: number, period = 0.6) => ((t % period) + period) % period < period * 0.55;

/**
 * A hairline callout: a dot at the target, a leader with one elbow, and a label anchor.
 * `p` (0..1) draws it on. Returns the label anchor point.
 */
export function callout(c: CanvasRenderingContext2D, tx: number, ty: number, ex: number, ey: number, lx: number, p: number, color = col('cobaltText', 0.9)) {
  const L1 = Math.hypot(ex - tx, ey - ty), L2 = Math.abs(lx - ex), L = L1 + L2;
  const d = ease.outCubic(clamp(p)) * L;
  c.save();
  c.strokeStyle = color;
  c.fillStyle = color;
  c.lineWidth = 1.5;
  c.beginPath();
  c.arc(tx, ty, 4, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.moveTo(tx, ty);
  if (d <= L1) c.lineTo(tx + ((ex - tx) * d) / L1, ty + ((ey - ty) * d) / L1);
  else {
    c.lineTo(ex, ey);
    c.lineTo(ex + Math.sign(lx - ex) * (d - L1), ey);
  }
  c.stroke();
  c.restore();
  return { x: lx, y: ey };
}

/**
 * GLSL: posterized cartoon fire (four flat bands, white-hot core for bloom), rising from a
 * baseline. `fire(p, t, h, kick)` returns rgb (linear, HDR) and alpha; p in logical px (y down),
 * `base` the floor line, `h` the flame height in px.
 */
export const FIRE_GLSL = /* glsl */ `
vec4 fireAt(vec2 p, float base, float h, float t, float kick, float seed) {
  float y = (base - p.y) / max(h, 1.0);            // 0 at the base, 1 at nominal tip height
  if (y < -0.05 || h < 1.0) return vec4(0.0);
  // big, slow, graphic tongues: low-frequency columns, a gentle lick, sharp posterized bands
  float x = p.x / 300.0; // fixed spatial scale: shrinking h lowers the flames, it doesn't make them noisier
  float cols = 0.62 + 0.42 * snoise(vec2(x * 0.9 + seed, t * 0.28)) + 0.18 * snoise(vec2(x * 2.1 - seed, t * 0.5));
  float lick = 0.16 * snoise(vec2(x * 2.4 + seed * 3.1, y * 1.7 - t * 1.6));
  float v = cols * (1.0 + 0.15 * kick) - y + lick;
  vec3 c = C_BLOOD * 0.9; 
  if (v > 0.12) c = C_SIGNAL * 0.95;
  if (v > 0.30) c = C_EMBER * 1.05;
  if (v > 0.52) c = mix(C_EMBER, vec3(1.0, 0.93, 0.8), 0.5) * 1.35;  // hot core: only this blooms
  float w = fwidth(v) * 1.2;
  float a = smoothstep(0.0, w, v);
  return vec4(c, a);
}`;

export { ease };

/**
 * Set a row of sung words in the Human's type (per-word karaoke alpha). Returns the row's width.
 * `upper` uppercases; `color(w)` picks a palette key per word; `gap` is in ems.
 */
export function wordRow(c: CanvasRenderingContext2D, words: Word[], t: number, x: number, y: number, size: number,
  o: { width?: number; weight?: number; upper?: boolean; gap?: number; dim?: number; color?: (w: Word) => string; align?: 'left' | 'right' | 'center'; measureOnly?: boolean } = {}) {
  const width = o.width ?? 100, weight = o.weight ?? 800, gap = (o.gap ?? 0.26) * size;
  const fam = TYPE.humanFamily(width, weight);
  const labels = words.map((w) => (o.upper ?? true ? w.w.toUpperCase() : w.w));
  const ws = labels.map((l) => measureText(l, fam, size));
  const total = ws.reduce((a, b) => a + b, 0) + gap * Math.max(0, words.length - 1);
  if (o.measureOnly) return total;
  let xx = o.align === 'right' ? x - total : o.align === 'center' ? x - total / 2 : x;
  c.font = TYPE.human(size, width, weight);
  c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  words.forEach((w, i) => {
    c.fillStyle = col(o.color ? o.color(w) : 'bone', wordAlpha(w, t, o.dim ?? 0.22));
    c.fillText(labels[i]!, xx, y);
    xx += ws[i]! + gap;
  });
  return total;
}

import { measure as measureText } from '../engine/type';

/** Typewriter reveal of an AI line (monospace), word-synced: returns the visible prefix. */
export function aiTyped(words: Word[], t: number) {
  let s = '';
  for (const w of words) { if (t >= w.start) s += (s ? ' ' : '') + w.w; }
  return s;
}

/** Load an image from app/public (cached). */
const IMG = new Map<string, Promise<HTMLImageElement>>();
export function loadImage(url: string): Promise<HTMLImageElement> {
  let p = IMG.get(url);
  if (!p) {
    p = new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url; });
    IMG.set(url, p);
  }
  return p;
}

/**
 * A silhouette image rasterized to a coverage grid (cols x rows, 0..1), plus a per-cell "depth":
 * how far the cell is inside the shape (0 at the edge .. 1 deep inside), for ASCII density.
 */
export function silhouetteGrid(img: HTMLImageElement, cols: number, rows: number, crop?: { y0: number; y1: number }) {
  const cv = document.createElement('canvas');
  cv.width = cols * 4; cv.height = rows * 4;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const sy = (crop?.y0 ?? 0) * img.height, sh = ((crop?.y1 ?? 1) - (crop?.y0 ?? 0)) * img.height;
  c.drawImage(img, 0, sy, img.width, sh, 0, 0, cv.width, cv.height);
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  const cov: number[][] = [];
  for (let y = 0; y < rows; y++) {
    const r: number[] = [];
    for (let x = 0; x < cols; x++) {
      let a = 0;
      for (let yy = 0; yy < 4; yy++) for (let xx = 0; xx < 4; xx++) a += d[((y * 4 + yy) * cv.width + x * 4 + xx) * 4 + 3]!;
      r.push(a / (16 * 255));
    }
    cov.push(r);
  }
  // depth: chamfer distance to the outside, normalized
  const INF = 1e9, dist: number[][] = cov.map((r) => r.map((v) => (v > 0.5 ? INF : 0)));
  for (let pass = 0; pass < 2; pass++) {
    const ys = pass ? [...Array(rows).keys()].reverse() : [...Array(rows).keys()];
    const xs = pass ? [...Array(cols).keys()].reverse() : [...Array(cols).keys()];
    const dy = pass ? 1 : -1, dx = pass ? 1 : -1;
    for (const y of ys) for (const x of xs) {
      if (dist[y]![x] === 0) continue;
      const n1 = dist[y + dy]?.[x] ?? 0, n2 = dist[y]?.[x + dx] ?? 0;
      dist[y]![x] = Math.min(dist[y]![x]!, n1 + 1, n2 + 1);
    }
  }
  let mx = 1;
  for (const r of dist) for (const v of r) if (v < INF && v > mx) mx = v;
  const depth = dist.map((r) => r.map((v) => Math.min(1, v / (mx * 0.6))));
  return { cov, depth, cols, rows };
}
