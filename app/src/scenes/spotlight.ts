// The AI's spotlight: "At this point in the song, the artificial intelligence would like to
// thank the conference organizers, the AV team, the sponsors, and the one person in the front row already
// asking ChatGPT to summarize the talk." / "Honestly?" (the Human) / "Respect." (the AI).
// A black stage. The AI stands at an ASCII podium: a real human silhouette (CC0, assets/) rebuilt from
// characters, dense in the middle and light at the edges, shimmering, flying together as it starts to
// speak. Its speech is typed like a terminal; each thank-you lands as a giant pixel banner under a sweeping
// cobalt spotlight, and a brightness wave runs down its body. On "the one person in the front row" the
// camera tilts down to a uniform row of audience heads; the one in the middle holds a glowing phone
// (and still wears the Human's frozen spinner). "HONESTLY?": a hard spotlight snaps onto him.
// "RESPECT.": a full-frame pixel banner slams in, and its pixels fall away into the next scene.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog, springStep } from '../engine/util';
import { F, font, plain } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, loadImage, silhouetteGrid } from './_look';

const CELL = 11;
const EDGE = '.:-', MID = '=+*', DEEP = '#%@';
const FX = 1480, FY = 860 - 72 * 11; // the figure's top-centre (feet on the stage floor)

/** A text rasterized to a grid of cells (for pixel banners). */
function bitmap(text: string, rows = 9, weight = 900): boolean[][] {
  const cv = document.createElement('canvas');
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  const size = rows * 1.25;
  c.font = font(F.archivo(100, weight), size);
  const w = Math.ceil(c.measureText(text).width) + 2;
  cv.width = w; cv.height = Math.ceil(size * 1.3);
  c.font = font(F.archivo(100, weight), size);
  c.fillStyle = '#fff';
  c.fillText(text, 1, Math.round(size * 1.02));
  const d = c.getImageData(0, 0, cv.width, cv.height).data;
  const out: boolean[][] = [];
  for (let y = 0; y < cv.height; y++) { const row: boolean[] = []; for (let x = 0; x < w; x++) row.push(d[(y * w + x) * 4 + 3]! > 110); out.push(row); }
  return out;
}

export default class Spotlight extends Scene {
  layer = new Layer2D();
  lines: Line[] = [];
  honest!: Line; respect!: Line;
  banners = new Map<string, boolean[][]>();
  fig: { cov: number[][]; depth: number[][]; cols: number; rows: number } | null = null;

  override async init() {
    const ly = this.ctx.lyrics;
    this.lines = ['At this point in the song', 'the artificial intelligence', 'the AV team', 'the sponsors', 'and the one person', 'already asking ChatGPT'].map((q) => ly.get(q));
    this.honest = ly.get('Honestly?');
    this.respect = ly.get('Respect.');
    for (const b of ['THE CONFERENCE', 'ORGANIZERS', 'THE AV TEAM', 'THE SPONSORS']) this.banners.set(b, bitmap(b, 9));
    this.banners.set('RESPECT.', bitmap('RESPECT.', 22, 800));
    const img = await loadImage('assets/man_standing.svg');
    this.fig = silhouetteGrid(img, 24, 72);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const person = this.lines[4]!.words.find((w) => /person/i.test(w.w))!;
    const tilt = ease.inOutCubic(prog(t, person.start - 0.35, person.start + 0.45));
    const oy = -tilt * 720;
    c.save();
    c.translate(0, oy);
    this.stage(c, t);
    c.restore();
    this.frontRow(c, t, 1120 + oy);
    this.speech(c, t, tilt);
    this.respectBanner(c, t);
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    const slam = t >= this.respect.start ? Math.exp(-(t - this.respect.start) * 6) : 0;
    const snap = t >= this.honest.start ? Math.exp(-(t - this.honest.start) * 8) : 0;
    // one- or two-frame hits only (a longer additive flash washes the frame out grey)
    const hit = (t0: number) => (t >= t0 ? Math.exp(-(t - t0) * 30) : 0);
    const flashK = hit(this.respect.start) * 0.12 + hit(this.honest.start) * 0.06;
    return { bloom: 0.6, bloomThreshold: 0.85, vignette: 0.45, grain: 0.055, flash: flashK, shake: [slam * 10, slam * -6] as [number, number] };
  }

  /** The ASCII figure (from the silhouette), with a brightness wave down it on each thank-you. */
  private figure(c: CanvasRenderingContext2D, t: number) {
    const g = this.fig;
    if (!g) return;
    const s0 = this.lines[0]!.start;
    const build = prog(t, s0 - 0.6, s0 + 1.0);
    const x0 = FX - (g.cols * CELL) / 2;
    const hits = [this.lines[1]!.words.find((w) => /conference/i.test(w.w))!.start, this.lines[2]!.words.find((w) => /AV/i.test(w.w))!.start, this.lines[3]!.words.find((w) => /sponsors/i.test(w.w))!.start];
    const fi = Math.floor(t * 10);
    // talking: a small lift and lean per syllable of the AI's current word (no face: just the body)
    const words = this.lines.flatMap((l) => l.words);
    const cw = words.find((w) => t >= w.start && t < w.end);
    let open = 0;
    if (cw) { const n = Math.max(1, Math.round(plain(cw.w).length / 3.2)); open = Math.abs(Math.sin(Math.PI * ((t - cw.start) / (cw.end - cw.start)) * n)); }
    c.font = TYPE.ai(CELL * 1.35, 700);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let y = 0; y < g.rows; y++) for (let x = 0; x < g.cols; x++) {
      const cov = g.cov[y]![x]!;
      if (cov < 0.35) continue;
      const dep = g.depth[y]![x]!;
      const seed = hash(x, y);
      const k = clamp(build * 1.6 - seed * 0.6);
      if (k <= 0) continue;
      // a slow sway from the ankles (the head moves most), a small nod while it talks
      const up = 1 - y / g.rows;
      const sway = up * (Math.sin(t * 1.1) * 7 + open * 5);
      let px = x0 + x * CELL + sway, py = FY + y * CELL - up * up * open * 5;
      if (k < 1) { px += (hash(x, y + 9) - 0.5) * 1400 * (1 - k); py += (hash(x + 3, y) - 0.5) * 900 * (1 - k); }
      const set = dep > 0.55 ? DEEP : dep > 0.2 ? MID : EDGE;
      const ch = set[Math.floor(hash(x + fi, y) * set.length)]!;
      let wave = 0;
      for (const h of hits) { const d = (t - h) * 3.2 - y / g.rows; if (d > 0 && d < 0.25) wave = Math.max(wave, 1 - d / 0.25); }
      c.fillStyle = wave > 0.1 ? col('bone', k) : dep < 0.2 ? col('cobaltText', k) : col('cobalt', k * (0.45 + 0.3 * (1 - dep)));
      c.fillText(ch, px, py);
      // its reflection in the stage floor
      const ry = 2 * 860 - py;
      if (k >= 1 && ry < 860 + 260) { c.fillStyle = col('cobalt', 0.14 * (1 - (ry - 860) / 260)); c.fillText(ch, px, ry); }
    }
    c.textBaseline = 'alphabetic';
  }

  private stage(c: CanvasRenderingContext2D, t: number) {
    const L = this.lines;
    const org = L[1]!.words.find((w) => /conference/i.test(w.w))!;
    const beamX = t < org.start ? FX : t < L[2]!.start ? 520 : t < L[3]!.start ? 960 : t < L[4]!.start ? 1400 : FX;
    for (const [sx, tx, a] of [[300, beamX, 0.18], [1620, FX, 0.22]] as const) {
      const g = c.createLinearGradient(sx, 0, tx, 860);
      g.addColorStop(0, col('cobalt', a)); g.addColorStop(1, col('cobalt', a * 0.3));
      c.fillStyle = g;
      c.beginPath(); c.moveTo(sx - 20, -40); c.lineTo(sx + 20, -40); c.lineTo(tx + 260, 860); c.lineTo(tx - 260, 860); c.closePath(); c.fill();
    }
    c.fillStyle = col('ink2'); c.fillRect(0, 860, W, 400);
    c.fillStyle = col('graphite'); c.fillRect(0, 860, W, 2);
    this.figure(c, t);
    // a microphone stand in front of it, and its name on the floor
    const build = prog(t, L[0]!.start - 0.4, L[0]!.start + 0.6);
    c.font = TYPE.ai(22, 500);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = col('steel', 0.9 * build);
    for (let y = 330; y < 850; y += 22) c.fillText('│', FX - 150, y);
    c.fillText('╭─', FX - 138, 318); c.fillText('●', FX - 118, 306);
    c.fillText('┴', FX - 150, 852);
    c.font = TYPE.ai(20, 600);
    c.fillStyle = col('steel', 0.8 * build);
    c.fillText('[ AI · v10 ]', FX, 900);
    c.textBaseline = 'alphabetic';
    const banner = (key: string, x: number, y: number, cell: number, a: number) => {
      const bm = this.banners.get(key)!;
      cell = Math.min(cell, Math.floor(1060 / bm[0]!.length)); // keep clear of the figure
      c.fillStyle = col('bone', a);
      for (let yy = 0; yy < bm.length; yy++) for (let xx = 0; xx < bm[0]!.length; xx++) if (bm[yy]![xx]) c.fillRect(x + xx * cell, y + yy * cell, cell - 2, cell - 2);
    };
    const show = (w: Word | undefined, until: number) => (w && t >= w.start && t < until ? clamp((t - w.start) / 0.08) : 0);
    const orgs = L[1]!.words.find((w) => /organizers/i.test(w.w));
    banner('THE CONFERENCE', 120, 60, 11, show(org, L[2]!.start));
    banner('ORGANIZERS', 120, 190, 11, show(orgs, L[2]!.start));
    banner('THE AV TEAM', 120, 60, 14, show(L[2]!.words.find((w) => /AV/i.test(w.w)), L[3]!.start));
    banner('THE SPONSORS', 120, 60, 14, show(L[3]!.words.find((w) => /sponsors/i.test(w.w)), L[4]!.start));
  }

  /** A uniform row of audience heads; the middle one holds a glowing phone (and the frozen spinner). */
  private frontRow(c: CanvasRenderingContext2D, t: number, y0: number) {
    if (y0 > H + 400) return;
    const g = c.createLinearGradient(0, y0 - 300, 0, y0 + 200);
    g.addColorStop(0, col('cobaltDeep', 0.5)); g.addColorStop(1, col('ink', 0));
    c.fillStyle = g; c.fillRect(0, y0 - 300, W, 500);
    const snap = t >= this.honest.start;
    if (snap) { // the hard spotlight on HONESTLY?
      const k = clamp((t - this.honest.start) / 0.06);
      const sg = c.createLinearGradient(0, 0, 0, y0 + 500);
      sg.addColorStop(0, col('bone', 0.0)); sg.addColorStop(1, col('bone', 0.22 * k));
      c.fillStyle = sg;
      c.beginPath(); c.moveTo(960 - 40, 0); c.lineTo(960 + 40, 0); c.lineTo(960 + 260, y0 + 600); c.lineTo(960 - 260, y0 + 600); c.closePath(); c.fill();
    }
    for (let i = 0; i < 11; i++) {
      const me = i === 5;
      const hx = 960 + (i - 5) * 176 + (me ? 0 : (hash(i, 1) - 0.5) * 30), hy = y0 + 240 + (me ? 0 : hash(i, 2) * 26), r = 60 + hash(i, 3) * 10;
      c.fillStyle = col(me && snap ? 'bone' : 'cobalt', me && snap ? 0.9 : 0.55);
      c.beginPath(); c.arc(hx, hy - 3, r + 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.roundRect(hx - r * 1.8 - 3, hy + r * 0.6 - 3, r * 3.6 + 6, 400, r); c.fill();
      c.fillStyle = col('ink');
      c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.roundRect(hx - r * 1.8, hy + r * 0.6, r * 3.6, 400, r); c.fill();
      if (!me) continue;
      // the phone, held up in front of his face, lighting it from below
      const glow = c.createRadialGradient(hx, hy + 20, 5, hx, hy + 20, 170);
      glow.addColorStop(0, col('cobaltText', 0.45)); glow.addColorStop(1, col('cobaltText', 0));
      c.fillStyle = glow; c.fillRect(hx - 170, hy - 150, 340, 340);
      c.fillStyle = col('ink');
      c.beginPath(); c.roundRect(hx - 30, hy + 50, 60, 40, 16); c.fill();
      c.fillStyle = col('bone');
      c.beginPath(); c.roundRect(hx - 22, hy + 6, 44, 70, 6); c.fill();
      c.fillStyle = col('cobalt');
      c.fillRect(hx - 16, hy + 16, 32, 5);
      c.fillStyle = col('graphite');
      for (let k = 0; k < 4; k++) c.fillRect(hx - 16, hy + 28 + k * 9, 20 + (k % 2) * 10, 3);
      if (!snap) { // the frozen spinner, until HONESTLY?
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2, q = (((k - Math.floor(t * 14)) % 12) + 12) % 12 / 12;
          c.fillStyle = col('cobaltText', 0.15 + 0.85 * q);
          c.beginPath(); c.arc(hx + Math.cos(a) * 26, hy - r - 50 + Math.sin(a) * 26, 4.5, 0, Math.PI * 2); c.fill();
        }
      } else { // HONESTLY? in his voice, big, beside him
        const w = this.honest.words[0]!;
        const s = springStep(t - w.start, 3, 0.5);
        c.save();
        c.translate(hx + 150, hy - 130);
        c.scale(0.6 + 0.4 * s, 0.6 + 0.4 * s);
        c.font = TYPE.human(120, 75, 900);
        c.textAlign = 'left';
        c.fillStyle = col('bone', clamp((t - w.start) / 0.08) * (1 - clamp((t - this.respect.start + 0.02) / 0.08)));
        c.fillText('HONESTLY?', 0, 0);
        c.restore();
      }
    }
  }

  /** RESPECT.: a full-frame pixel banner slammed in, then its pixels fall away into the next scene. */
  private respectBanner(c: CanvasRenderingContext2D, t: number) {
    if (t < this.respect.start - 0.02) return;
    const bm = this.banners.get('RESPECT.')!;
    const cols = bm[0]!.length, rows = bm.length;
    const cell = Math.floor((W - 200) / cols);
    const x0 = (W - cols * cell) / 2, y0 = (H - rows * cell) / 2 - 40;
    const slam = ease.outBack(clamp((t - this.respect.start + 0.02) / 0.18));
    const fall = clamp((t - this.respect.end - 0.75) / 0.8);
    c.save();
    c.translate(W / 2, H / 2);
    c.scale(1.6 - 0.6 * slam, 1.6 - 0.6 * slam);
    c.translate(-W / 2, -H / 2);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (!bm[y]![x]) continue;
      const d = clamp(fall * 1.6 - hash(x, y) * 0.6);
      c.fillStyle = col(hash(x, y + 1) > 0.85 ? 'bone' : 'cobaltText', clamp(slam * 3) * (1 - d));
      c.fillRect(x0 + x * cell, y0 + y * cell + d * d * 900, cell - 3, cell - 3);
    }
    c.restore();
    c.textAlign = 'left';
  }

  /** The speech itself: typed like a terminal, bottom left (stage) / top left (front row). */
  private speech(c: CanvasRenderingContext2D, t: number, tilt: number) {
    if (t >= this.honest.start) return;
    const all = this.lines.flatMap((l) => l.words);
    const said = plain(all.filter((w) => t >= w.start).map((w) => w.w).join(' '));
    const rows: string[] = [];
    let cur = '';
    for (const word of said.split(' ')) { if ((cur + ' ' + word).trim().length > 46) { rows.push(cur); cur = word; } else cur = (cur + ' ' + word).trim(); }
    if (cur) rows.push(cur);
    const vis = rows.slice(-3);
    c.font = TYPE.ai(34, 500);
    c.textAlign = 'left';
    const y0 = tilt < 0.5 ? 920 : 150;
    c.fillStyle = col('cobaltText');
    vis.forEach((r, i) => c.fillText((i === 0 && rows.length > 3 ? '… ' : '') + r, 120, y0 + i * 46));
    const last = vis[vis.length - 1] ?? '';
    if (cursorOn(t)) { c.fillStyle = col('cobalt'); c.fillRect(124 + c.measureText(last).width + 6, y0 + (vis.length - 1) * 46 - 30, 18, 36); }
  }
}
