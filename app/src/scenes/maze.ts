// Outro A, "In this maze of possibilities / It's easy to lose the 'Why' / Between the hype, the fear,
// the tools / It's nice to look a human in the eye. / (Or a camera lens. Whatever you've got.) /
// and that's why…": a top-down hairline maze (seeded, perfect maze) with the Human as an amber dot
// wandering it. WHY wanders off into a dead end and fades. Three walls are labelled HYPE, FEAR,
// TOOLS as they're sung. On "look a human in the eye" the maze irises into a camera aperture that
// opens onto a viewfinder (REC, crop marks, the timecode): the AI's "Or a camera lens" is its
// overlay. On "and that's why…" the lost WHY flies back and lands in the line.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, mulberry32, prog, springStep } from '../engine/util';
import type { Line } from '../engine/lyrics';
import { TYPE, col, cursorOn, loadImage, wordAlpha, wordRow, wordState } from './_look';

const MC = 24, MR = 11, CS = 52, MX0 = 1920 - 96 - MC * CS, MY0 = 110;

export default class Maze extends Scene {
  layer = new Layer2D();
  l: Line[] = [];
  walls: [number, number, number, number][] = []; // x0,y0,x1,y1 in cells
  path: [number, number][] = []; // the dot's wander path (cells)
  whyPath: [number, number][] = [];
  ghosts: { label: string; key: string; re: RegExp; path: [number, number][]; t0: number }[] = []; // HYPE, FEAR, TOOLS: chasing him
  eye: HTMLCanvasElement | null = null; // the photo (PDM, assets/), graded to an amber duotone

  /** Grade the eye photo through the palette: ink → blood → signal → ember → bone by luminance. */
  private grade(img: HTMLImageElement) {
    const lut = document.createElement('canvas');
    lut.width = 256; lut.height = 1;
    const lc = lut.getContext('2d', { willReadFrequently: true })!;
    const g = lc.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0, col('ink')); g.addColorStop(0.3, col('blood')); g.addColorStop(0.62, col('signal')); g.addColorStop(0.85, col('ember')); g.addColorStop(1, col('bone'));
    lc.fillStyle = g; lc.fillRect(0, 0, 256, 1);
    const L = lc.getImageData(0, 0, 256, 1).data;
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d', { willReadFrequently: true })!;
    c.drawImage(img, 0, 0);
    const im = c.getImageData(0, 0, cv.width, cv.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) {
      // luminance with a contrast curve (the skin is bright; push it down so the iris carries the image)
      let y = (0.3 * d[i]! + 0.55 * d[i + 1]! + 0.15 * d[i + 2]!) / 255;
      y = Math.pow(y, 1.8);
      y = y * y * (3 - 2 * y);
      const k = Math.min(255, Math.max(0, Math.round(y * 255))) * 4;
      d[i] = L[k]!; d[i + 1] = L[k + 1]!; d[i + 2] = L[k + 2]!;
    }
    c.putImageData(im, 0, 0);
    this.eye = cv;
  }

  override async init() {
    this.grade(await loadImage('assets/eye.jpg'));
    const ly = this.ctx.lyrics;
    this.l = ['maze of possibilities', 'lose the', 'Between the hype', 'look a human in the eye', 'Or a camera lens', 'and that’s why'].map((q) => ly.get(q));
    // a perfect maze by randomized DFS
    const rnd = mulberry32(31);
    const seen = new Set<number>();
    const open = new Set<string>(); // opened edges "a-b"
    const id = (x: number, y: number) => y * MC + x;
    const stack: [number, number][] = [[0, 0]];
    seen.add(0);
    while (stack.length) {
      const [x, y] = stack[stack.length - 1]!;
      const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [x + dx, y + dy] as [number, number]).filter(([a, b]) => a >= 0 && b >= 0 && a < MC && b < MR && !seen.has(id(a, b)));
      if (!nb.length) { stack.pop(); continue; }
      const [nx, ny] = nb[Math.floor(rnd() * nb.length)]!;
      seen.add(id(nx, ny));
      open.add(`${Math.min(id(x, y), id(nx, ny))}-${Math.max(id(x, y), id(nx, ny))}`);
      stack.push([nx, ny]);
    }
    const isOpen = (a: number, b: number) => open.has(`${Math.min(a, b)}-${Math.max(a, b)}`);
    for (let y = 0; y < MR; y++) for (let x = 0; x < MC; x++) {
      if (x + 1 < MC && !isOpen(id(x, y), id(x + 1, y))) this.walls.push([x + 1, y, x + 1, y + 1]);
      if (y + 1 < MR && !isOpen(id(x, y), id(x, y + 1))) this.walls.push([x, y + 1, x + 1, y + 1]);
    }
    this.walls.push([0, 0, MC, 0], [0, MR, MC, MR], [0, 0, 0, MR], [MC, 0, MC, MR]);
    // wander paths: random walks along open edges
    const walk = (sx: number, sy: number, n: number, seed: number) => {
      const r2 = mulberry32(seed);
      const p: [number, number][] = [[sx, sy]];
      let [x, y] = [sx, sy], px = -1, py = -1;
      for (let i = 0; i < n; i++) {
        const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [x + dx, y + dy] as [number, number])
          .filter(([a, b]) => a >= 0 && b >= 0 && a < MC && b < MR && isOpen(id(x, y), id(a, b)));
        const fwd = nb.filter(([a, b]) => a !== px || b !== py);
        const pick = (fwd.length ? fwd : nb)[Math.floor(r2() * (fwd.length ? fwd.length : nb.length))]!;
        px = x; py = y; [x, y] = pick;
        p.push([x, y]);
      }
      return p;
    };
    this.path = walk(11, 5, 80, 5);
    this.whyPath = walk(11, 5, 40, 9);
    // the ghosts: each spawns on its wall when sung and chases the dot through the corridors (greedy at
    // each junction toward where he is at that moment, never reversing unless it's a dead end)
    const lHype = this.l[2]!;
    const GS = 3.6; // cells per second
    for (const [re, x, y, label, key] of [[/hype/i, 3, 1, 'HYPE', 'ember'], [/fear/i, 13, 4, 'FEAR', 'error'], [/tools/i, 19, 8, 'TOOLS', 'cobaltText']] as const) {
      const w = lHype.words.find((ww) => re.test(ww.w));
      const t0 = w ? w.start : this.ctx.start;
      const p: [number, number][] = [[x, y]];
      let [cx, cy]: [number, number] = [x, y], px = -1, py = -1;
      for (let i = 0; i < 90; i++) {
        const ti = t0 + i / GS;
        const k = Math.min(this.path.length - 1, Math.max(0, Math.floor((ti - this.ctx.start) * 2.2)));
        const [tx, ty] = this.path[k]!;
        const nb = ([[1, 0], [-1, 0], [0, 1], [0, -1]] as const).map(([dx, dy]) => [cx + dx, cy + dy] as [number, number])
          .filter(([a, b]) => a >= 0 && b >= 0 && a < MC && b < MR && isOpen(id(cx, cy), id(a, b)));
        const fwd = nb.filter(([a, b]) => a !== px || b !== py);
        const opts = fwd.length ? fwd : nb;
        opts.sort((a, b) => Math.abs(a[0] - tx) + Math.abs(a[1] - ty) - (Math.abs(b[0] - tx) + Math.abs(b[1] - ty)) || hash(a[0] * 7 + i, a[1]) - hash(b[0] * 7 + i, b[1]));
        px = cx; py = cy; [cx, cy] = opts[0]!;
        p.push([cx, cy]);
      }
      this.ghosts.push({ label, key, re, path: p, t0 });
    }
  }

  private at(p: [number, number][], k: number) {
    const i = Math.min(p.length - 2, Math.floor(k)), f = k - i;
    const [ax, ay] = p[i]!, [bx, by] = p[i + 1]!;
    return { x: MX0 + (ax + (bx - ax) * f + 0.5) * CS, y: MY0 + (ay + (by - ay) * f + 0.5) * CS };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const [lMaze, lWhy, lHype, lEye, lLens, lThats] = this.l as [Line, Line, Line, Line, Line, Line];
    const iris = ease.inOutCubic(prog(t, lEye.start - 0.2, lEye.start + 0.9));
    // ---- the maze (fades into the iris)
    if (iris < 1) {
      c.globalAlpha = 1 - iris;
      c.strokeStyle = col('bone', 0.55);
      c.lineWidth = 2;
      c.lineCap = 'square';
      const draw = prog(t, lMaze.start - 0.3, lMaze.end);
      this.walls.forEach(([x0, y0, x1, y1], i) => {
        if (i / this.walls.length > draw * 1.2) return;
        c.beginPath(); c.moveTo(MX0 + x0 * CS, MY0 + y0 * CS); c.lineTo(MX0 + x1 * CS, MY0 + y1 * CS); c.stroke();
      });
      // HYPE, FEAR, TOOLS: they appear when sung and chase him through the maze, Pac-Man ghosts
      c.font = TYPE.human(30, 75, 900);
      c.textAlign = 'center';
      for (const g of this.ghosts) {
        const w = lHype.words.find((ww) => g.re.test(ww.w));
        if (!w || t < w.start) continue;
        const pos = this.at(g.path, Math.max(0, (t - g.t0) * 3.6));
        const pop = springStep(t - w.start, 3, 0.45);
        c.save();
        c.translate(pos.x, pos.y + 10 + Math.sin(t * 9 + g.t0) * 2);
        c.scale(pop, pop);
        c.fillStyle = col(g.key, wordState(w, t).on);
        c.fillText(g.label, 0, 0);
        c.restore();
      }
      c.textAlign = 'left';
      // the Human: an amber dot wandering
      const d = this.at(this.path, (t - this.ctx.start) * 2.2);
      c.fillStyle = col('ember');
      c.beginPath(); c.arc(d.x, d.y, 11, 0, Math.PI * 2); c.fill();
      // WHY: lost in the maze (after "lose the"), wanders off and fades
      const why = lWhy.words[lWhy.words.length - 1]!;
      if (t >= why.start && t < lThats.start - 0.3) {
        const k = (t - why.start) * 3.2;
        const p = this.at(this.whyPath, k);
        c.font = TYPE.human(34, 100, 900);
        c.fillStyle = col('bone', clamp(1 - k / 14) * 0.9 + 0.1);
        c.textAlign = 'center';
        c.fillText('WHY', p.x, p.y + 12);
        c.textAlign = 'left';
      }
      c.globalAlpha = 1;
    }
    // ---- the iris / viewfinder
    if (iris > 0) this.viewfinder(c, t, iris, lEye, lLens);
    // ---- lyric column (left)
    const lines = t < lWhy.start - 0.1 ? [lMaze] : t < lHype.start - 0.1 ? [lWhy] : t < lEye.start - 0.1 ? [lHype] : t < lThats.start - 0.1 ? [lEye] : [lThats];
    const L0 = lines[0]!;
    if (L0 === lThats) this.thatsWhy(c, t, lThats);
    else if (L0 === lEye) {
      const ws = lEye.words; const hu = ws.findIndex((w) => /human/i.test(w.w));
      wordRow(c, ws.slice(0, hu - 1), t, 132, 820, 64);
      wordRow(c, ws.slice(hu - 1), t, 124, 960, 130, { width: 75, weight: 900 });
    } else {
      const ws = L0.words;
      const cut = Math.ceil(ws.length / 2);
      wordRow(c, ws.slice(0, cut), t, 132, 820, 64);
      wordRow(c, ws.slice(cut), t, 124, 960, 110, { width: 75, weight: 900, color: (w) => (/why/i.test(w.w) ? 'ember' : 'bone') });
    }
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.42, grain: 0.055 };
  }

  /** A camera aperture opening onto a viewfinder: REC, crop marks, timecode, the AI's overlay. */
  private viewfinder(c: CanvasRenderingContext2D, t: number, k: number, lEye: Line, lLens: Line) {
    const cx = 1300, cy = 540, R = 420;
    // aperture blades (hexagonal iris), opening with k
    const open = 40 + k * (R - 40);
    c.save();
    c.globalAlpha = k;
    c.strokeStyle = col('graphite');
    c.lineWidth = 3;
    c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.stroke();
    c.fillStyle = col('ink2');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + k * 0.8;
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * open, cy + Math.sin(a) * open);
      c.lineTo(cx + Math.cos(a + Math.PI / 3) * open, cy + Math.sin(a + Math.PI / 3) * open);
      c.lineTo(cx + Math.cos(a + Math.PI / 3) * R, cy + Math.sin(a + Math.PI / 3) * R);
      c.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      c.closePath(); c.fill();
      c.strokeStyle = col('graphite', 0.6); c.lineWidth = 1.5; c.stroke();
    }
    // inside: the eye (a real photo, graded amber), slowly pushing in, drifting a little
    const ph = this.eye;
    if (ph) {
      c.save();
      c.beginPath(); c.arc(cx, cy, open * 0.99, 0, Math.PI * 2); c.clip();
      const u = clamp((t - lEye.start) / 5);
      const sc = 1.38 * (1 + 0.2 * u); // the whole almond in the lens, pushing in towards the iris
      const ix = 497 + Math.sin(t * 0.6) * 6, iy = 314 + Math.cos(t * 0.45) * 4; // the pupil in the photo
      c.drawImage(ph, cx - ix * sc, cy - iy * sc, ph.width * sc, ph.height * sc);
      // a vignette inside the lens
      const g = c.createRadialGradient(cx, cy, open * 0.45, cx, cy, open);
      g.addColorStop(0, col('ink', 0)); g.addColorStop(1, col('ink', 0.75));
      c.fillStyle = g; c.fillRect(cx - R, cy - R, 2 * R, 2 * R);
      c.restore();
    }
    // the blink: the aperture blades snap shut and open again, at the end of the line
    const bt = (t - lEye.end) / 0.28;
    const shut = bt > 0 && bt < 1 ? Math.sin(bt * Math.PI) : 0;
    if (shut > 0) {
      const o2 = open * (1 - 0.92 * shut);
      c.save();
      c.beginPath(); c.arc(cx, cy, R, 0, Math.PI * 2); c.clip();
      c.fillStyle = col('ink2');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k * 0.8 + shut * 0.5;
        c.beginPath();
        c.moveTo(cx + Math.cos(a) * o2, cy + Math.sin(a) * o2);
        c.lineTo(cx + Math.cos(a + Math.PI / 3) * o2, cy + Math.sin(a + Math.PI / 3) * o2);
        c.lineTo(cx + Math.cos(a + Math.PI / 3) * R * 2, cy + Math.sin(a + Math.PI / 3) * R * 2);
        c.lineTo(cx + Math.cos(a) * R * 2, cy + Math.sin(a) * R * 2);
        c.closePath(); c.fill();
        c.strokeStyle = col('graphite', 0.8); c.lineWidth = 1.5; c.stroke();
      }
      c.restore();
    }
    c.restore();
    // the viewfinder overlay (the AI's: cobalt), from "Or a camera lens"
    if (t >= lLens.start - 0.05) {
      const a = clamp((t - lLens.start + 0.05) / 0.2);
      c.strokeStyle = col('cobaltText', a);
      c.lineWidth = 3;
      const m = 120, L = 70;
      for (const [x, y, dx, dy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
        c.beginPath(); c.moveTo(x, y + dy * L); c.lineTo(x, y); c.lineTo(x + dx * L, y); c.stroke();
      }
      c.font = TYPE.ai(26, 600);
      c.fillStyle = col('error', a * (Math.floor(t * 2) % 2 ? 1 : 0.35));
      c.beginPath(); c.arc(W - m - 150, m + 34, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = col('cobaltText', a);
      c.fillText('REC', W - m - 130, m + 43);
      const tc = t; c.fillText(`${String(Math.floor(tc / 60)).padStart(2, '0')}:${String(Math.floor(tc % 60)).padStart(2, '0')}:${String(Math.floor((tc % 1) * 30)).padStart(2, '0')}`, m + 20, m + 43);
      // the AI's detection box, locking onto the iris
      const lk = springStep(Math.max(0, t - lLens.start), 3, 0.55);
      const bw = 300 + (1 - lk) * 260, bx = cx - bw / 2 + Math.sin(t * 0.6) * 6, by = cy - bw / 2;
      c.strokeStyle = col('cobaltText', a * 0.9); c.lineWidth = 2;
      const q = 34;
      for (const [x, y, dx, dy] of [[bx, by, 1, 1], [bx + bw, by, -1, 1], [bx, by + bw, 1, -1], [bx + bw, by + bw, -1, -1]] as const) {
        c.beginPath(); c.moveTo(x, y + dy * q); c.lineTo(x, y); c.lineTo(x + dx * q, y); c.stroke();
      }
      c.font = TYPE.ai(20, 600);
      c.fillStyle = col('cobaltText', a);
      c.fillText(`human? ${(0.51 + 0.46 * lk).toFixed(2)}`, bx, by - 14);
      // the AI's line, typed
      const said = lLens.words.filter((w) => t >= w.start).map((w) => w.w).join(' ');
      c.font = TYPE.ai(40, 500);
      c.fillText(said, m + 20, m + 110);
      if (cursorOn(t)) c.fillRect(m + 26 + c.measureText(said).width, m + 76, 20, 40);
    }
  }

  /** "and that's WHY…": the lost WHY flies back into place. */
  private thatsWhy(c: CanvasRenderingContext2D, t: number, l: Line) {
    const ws = l.words;
    const w = wordRow(c, ws.slice(0, 2), t, 132, 900, 110, { width: 75, weight: 900 });
    const why = ws[ws.length - 1]!;
    const s = springStep(Math.max(0, t - why.start + 0.3), 2.2, 0.6);
    const x = 132 + w + 34, y = 900;
    const fx = 1500, fy = 300;
    c.font = TYPE.human(110 * (0.4 + 0.6 * s), 75, 900);
    c.fillStyle = col('ember', wordAlpha(why, t, 0.6));
    c.fillText('WHY…', fx + (x - fx) * s, fy + (y - fy) * s);
  }
}
