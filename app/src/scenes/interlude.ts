// The interlude (the third voice: a voice, not a character), "Now I take the time to remind
// you, to find you / Take your seat / Kindly remind me, to find me / (Check my uptime) / I will take the
// time to remind you, to find you / Kindly remind me, to find me": the conference hall itself, as a seat
// map. RESPECT's falling pixels land as seats (empty, a booking chart). A spotlight searches the rows
// and finds you: YOU ARE HERE. "Take your seat": the hall fills, row by row, front to back. The camera
// tilts up to the stage, the spotlight finds the lectern ("find me"), and the screen rises into view:
// the AI checks its uptime on it. Then back over the full hall to your seat, and down, top-down, until
// only your dot is left: the amber dot the maze picks up.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog, springStep } from '../engine/util';
import { measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha } from './_look';

// the hall (world units ≈ cm): the stage at y ≈ 0, rows arcing around a focus behind it
const FOCUS = { x: 0, y: -520 };
const ROWS = 14;
const LECTERN = { x: 420, y: -70 };
const DOT = { x: 1174, y: 396 }; // where the maze's amber dot starts (screen)

interface Seat { x: number; y: number; row: number; nx: number; ny: number; h: number; fill: number; you?: boolean }
interface Cam { tx: number; ty: number; yaw: number; pitch: number; scale: number; ax: number; ay: number }

export default class Interlude extends Scene {
  layer = new Layer2D();
  seats: Seat[] = [];
  you!: Seat;
  l1!: Line; seat!: Line; r1!: Line; uptime!: Line; l2!: Line; r2!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('Now I take the time');
    this.seat = ly.get('Take your seat');
    this.r1 = ly.get('Kindly remind me', 0);
    this.uptime = ly.get('Check my uptime');
    this.l2 = ly.get('I will take the time');
    this.r2 = ly.get('Kindly remind me', 1);
    for (let row = 0; row < ROWS; row++) {
      const r = 640 + row * 94;
      const step = 66 / r;
      const tmax = Math.min(0.66, Math.asin(Math.min(1, 1120 / r)));
      for (let th = -tmax; th <= tmax + 1e-6; th += step) {
        const x = r * Math.sin(th), y = FOCUS.y + r * Math.cos(th);
        if (Math.abs(x) < 48 || Math.abs(Math.abs(x) - 640) < 44) continue; // the aisles
        const n = Math.hypot(FOCUS.x - x, FOCUS.y - y);
        const h = hash(Math.round(x), row);
        this.seats.push({ x, y, row, nx: (FOCUS.x - x) / n, ny: (FOCUS.y - y) / n, h, fill: h < 0.12 ? 1e9 : 0 });
      }
    }
    // your seat: row H, left of centre
    this.you = this.seats.reduce((b, s) => (Math.hypot(s.x + 330, s.y - (FOCUS.y + 640 + 7 * 94)) < Math.hypot(b.x + 330, b.y - (FOCUS.y + 640 + 7 * 94)) ? s : b));
    this.you.you = true;
    // "Take your seat": the hall fills front to back, a little ragged
    const t0 = this.seat.start - 0.15;
    for (const s of this.seats) if (s.fill === 0) s.fill = t0 + s.row * 0.1 + s.h * 0.35;
  }

  /** The camera, keyed to the lyric: top-down search → tilt to the stage → orbit back → top-down on your dot. */
  private cam(t: number): Cam {
    const Y = this.you;
    const keys: [number, Cam][] = [
      [this.ctx.start, { tx: 0, ty: 720, yaw: -0.28, pitch: 0, scale: 0.47, ax: 1180, ay: 630 }],
      [this.seat.start, { tx: 0, ty: 660, yaw: -0.06, pitch: 0.18, scale: 0.54, ax: 1180, ay: 600 }],
      [this.uptime.start - 0.2, { tx: 60, ty: 260, yaw: 0.02, pitch: 0.98, scale: 0.56, ax: 1120, ay: 700 }],
      [this.l2.start, { tx: 40, ty: 280, yaw: 0.04, pitch: 0.98, scale: 0.57, ax: 1120, ay: 700 }],
      [this.r2.start, { tx: Y.x, ty: Y.y, yaw: 0.42, pitch: 0.72, scale: 0.72, ax: 1100, ay: 560 }],
      [this.ctx.end - 0.6, { tx: Y.x, ty: Y.y, yaw: 0.12, pitch: 0, scale: 1.25, ax: DOT.x, ay: DOT.y }],
      [this.ctx.end + 5, { tx: Y.x, ty: Y.y, yaw: 0.12, pitch: 0, scale: 1.25, ax: DOT.x, ay: DOT.y }],
    ];
    let i = 0;
    while (i < keys.length - 2 && t >= keys[i + 1]![0]) i++;
    const [ta, a] = keys[i]!, [tb, b] = keys[i + 1]!;
    const k = ease.inOutCubic(clamp((t - ta) / (tb - ta)));
    const L = (p: keyof Cam) => a[p] + (b[p] - a[p]) * k;
    return { tx: L('tx'), ty: L('ty'), yaw: L('yaw'), pitch: L('pitch'), scale: L('scale'), ax: L('ax'), ay: L('ay') };
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const cam = this.cam(t);
    const D = 2600, F = D * cam.scale;
    const cy = Math.cos(cam.yaw), sy = Math.sin(cam.yaw), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    const P = (x: number, y: number, z = 0) => {
      const dx = x - cam.tx, dy = y - cam.ty;
      const u = dx * cy - dy * sy, v = dx * sy + dy * cy;
      const depth = D - v * sp - z * cp;
      return { x: cam.ax + (F * u) / depth, y: cam.ay + (F * (v * cp - z * sp)) / depth, d: depth, s: F / depth };
    };
    const end = prog(t, this.ctx.end - 1.6, this.ctx.end - 0.4); // everything but your dot fades
    const keep = 1 - end;
    c.lineJoin = 'round';

    // the hall: floor outline, aisles, the stage
    c.globalAlpha = keep;
    c.strokeStyle = col('graphite', 0.9);
    c.lineWidth = 1.5;
    const arc = (r: number, a0: number, a1: number) => {
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const th = a0 + ((a1 - a0) * i) / 40, p = P(FOCUS.x + r * Math.sin(th), FOCUS.y + r * Math.cos(th)); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); }
      c.stroke();
    };
    arc(640 + ROWS * 94, -0.62, 0.62);
    arc(560, -0.9, 0.9);
    const quad = (pts: { x: number; y: number }[], fill?: string, stroke?: string) => {
      c.beginPath(); pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); }
      if (stroke) { c.strokeStyle = stroke; c.stroke(); }
    };
    quad([P(-760, -170), P(760, -170), P(760, 30), P(-760, 30)], col('ink2'), col('steel', 0.5));
    // the lectern (a small block on the stage)
    const lz = 110;
    quad([P(LECTERN.x - 30, LECTERN.y - 20, lz), P(LECTERN.x + 30, LECTERN.y - 20, lz), P(LECTERN.x + 30, LECTERN.y + 20, lz), P(LECTERN.x - 30, LECTERN.y + 20, lz)], col('graphite'), col('steel', 0.7));
    quad([P(LECTERN.x - 30, LECTERN.y + 20, 0), P(LECTERN.x + 30, LECTERN.y + 20, 0), P(LECTERN.x + 30, LECTERN.y + 20, lz), P(LECTERN.x - 30, LECTERN.y + 20, lz)], col('ink2'), col('steel', 0.7));
    this.screen(c, t, P);
    // EXIT, at the back (it's that kind of song)
    for (const sx of [-1, 1]) {
      const p = P(sx * 1080, FOCUS.y + 640 + ROWS * 94 - 60, 0);
      c.font = TYPE.ai(Math.max(8, 20 * p.s), 700);
      c.textAlign = 'center';
      c.fillStyle = col('error', 0.85);
      c.fillText('EXIT', p.x, p.y);
    }
    // row letters
    c.font = TYPE.ai(Math.max(8, 18 * cam.scale * 1.6), 600);
    c.fillStyle = col('steel', 0.6);
    for (let row = 0; row < ROWS; row++) {
      const r = 640 + row * 94, th = -Math.min(0.66, Math.asin(Math.min(1, 1120 / r))) - 60 / r;
      const p = P(FOCUS.x + r * Math.sin(th), FOCUS.y + r * Math.cos(th));
      c.fillText(String.fromCharCode(65 + row), p.x, p.y + 6);
    }
    c.textAlign = 'left';

    // the spotlight pool (under the seats' tops, over the floor)
    const spot = this.spotAt(t);
    const pr = 170 * (1 - 0.6 * end);
    const ring = Array.from({ length: 28 }, (_, i) => P(spot.x + Math.cos((i / 28) * Math.PI * 2) * pr, spot.y + Math.sin((i / 28) * Math.PI * 2) * pr));
    const sc = P(spot.x, spot.y);
    c.save();
    c.globalCompositeOperation = 'lighter';
    // the beam, once the camera is tilted enough to see it
    const beam = clamp((cam.pitch - 0.3) / 0.4) * keep;
    if (beam > 0) {
      const g = c.createLinearGradient(0, -100, 0, sc.y);
      g.addColorStop(0, col('bone', 0)); g.addColorStop(1, col('bone', 0.1 * beam));
      c.fillStyle = g;
      const xs = ring.map((p) => p.x);
      c.beginPath(); c.moveTo(sc.x - 30, -100); c.lineTo(sc.x + 30, -100); c.lineTo(Math.max(...xs), sc.y); c.lineTo(Math.min(...xs), sc.y); c.closePath(); c.fill();
    }
    const rg = c.createRadialGradient(sc.x, sc.y, 0, sc.x, sc.y, Math.max(...ring.map((p) => Math.hypot(p.x - sc.x, p.y - sc.y))));
    rg.addColorStop(0, col('bone', 0.3 * keep)); rg.addColorStop(0.7, col('bone', 0.16 * keep)); rg.addColorStop(1, col('bone', 0));
    c.fillStyle = rg;
    quad(ring);
    c.fill();
    c.restore();

    // the seats, far to near
    const w2 = 25, d2 = 22, back = 44;
    const drawn = this.seats.map((s) => ({ s, d: P(s.x, s.y).d })).sort((a, b) => b.d - a.d);
    for (const { s } of drawn) {
      // they land: dropped in (RESPECT's pixels) row by row at the start
      const dt = this.ctx.start - 0.2 + s.row * 0.06 + s.h * 0.45;
      const land = ease.outCubic(clamp((t - dt) / 0.4));
      if (land <= 0) continue;
      const z0 = (1 - land) * 900;
      const tx = -s.ny, ty = s.nx; // across the seat
      const corner = (a: number, b: number, z: number) => P(s.x + tx * a + s.nx * b, s.y + ty * a + s.ny * b, z0 + z);
      const taken = t >= s.fill;
      const fk = taken ? clamp((t - s.fill) / 0.15) : 0;
      const lit = Math.exp(-(((s.x - spot.x) ** 2 + (s.y - spot.y) ** 2) / (pr * pr)));
      const a = (s.you ? 1 : keep) * clamp(land * 2);
      if (a <= 0.01) continue;
      c.globalAlpha = a;
      // the cushion
      const cushion = [corner(-w2, -d2, 0), corner(w2, -d2, 0), corner(w2, d2, 0), corner(-w2, d2, 0)];
      const falling = 1 - land;
      if (s.you && t >= this.l1.words[this.l1.words.length - 1]!.start - 0.3) {
        c.globalAlpha = keep;
        quad(cushion, col('bone'), col('ember'));
      } else if (fk > 0) {
        quad(cushion, col(lit > 0.35 ? 'signal' : 'blood', (0.6 + 0.3 * fk) * (0.75 + 0.25 * lit)), col(lit > 0.35 ? 'ember' : 'signal', 0.35 + 0.5 * lit));
      } else {
        quad(cushion, falling > 0.05 ? col('cobaltText', 0.8 * falling + 0.1) : col('ink2'), col('steel', 0.35 + 0.5 * lit));
      }
      // the backrest (away from the stage), standing up when the camera tilts
      const br = [corner(-w2, d2, 0), corner(w2, d2, 0), corner(w2, d2 + 6, back), corner(-w2, d2 + 6, back)];
      if (cam.pitch > 0.08) {
        quad(br, fk > 0 && !s.you ? col('blood', 0.95) : col('graphite', 0.95));
        // the backrest's top edge catches the light
        const e0 = br[3]!, e1 = br[2]!;
        c.strokeStyle = col(fk > 0 ? (lit > 0.35 ? 'bone' : 'signal') : 'steel', fk > 0 ? 0.55 + 0.45 * lit : 0.5);
        c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(e0.x, e0.y); c.lineTo(e1.x, e1.y); c.stroke();
      }
    }
    c.globalAlpha = 1;

    // YOU ARE HERE: a pin standing on your seat, from "find you"
    this.pin(c, t, P, end);
    // a soft left-side ground for the type
    const lg = c.createLinearGradient(0, 0, 900, 0);
    lg.addColorStop(0, col('ink', 0.75 * keep)); lg.addColorStop(1, col('ink', 0));
    c.fillStyle = lg; c.fillRect(0, 0, 900, H);
    this.words(c, t, keep);
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.55, bloomThreshold: 0.85, halation: 0.2, vignette: 0.5, grain: 0.06 };
  }

  /** Where the spotlight is: searching; your seat on "find you"; the lectern on "find me"; you again. */
  private spotAt(t: number) {
    const last = (l: Line) => l.words[l.words.length - 1]!.start;
    const S = { x: Math.sin(t * 0.9) * 640, y: 700 + Math.cos(t * 0.63) * 360 };
    const mix = (p: { x: number; y: number }, q: { x: number; y: number }, k: number) => ({ x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k });
    let p = mix(S, this.you, ease.inOutCubic(prog(t, last(this.l1) - 0.5, last(this.l1) + 0.1)));
    p = mix(p, LECTERN, ease.inOutCubic(prog(t, last(this.r1) - 0.6, last(this.r1) + 0.1)));
    p = mix(p, this.you, ease.inOutCubic(prog(t, last(this.l2) - 0.6, last(this.l2) + 0.1)));
    return p;
  }

  /** The stage screen: a slide ("please take your seat"), then the AI checking its uptime. */
  private screen(c: CanvasRenderingContext2D, t: number, P: (x: number, y: number, z?: number) => { x: number; y: number; s: number }) {
    const x0 = -540, x1 = 540, y = -190, z0 = 70, z1 = 640;
    const bl = P(x0, y, z0), br = P(x1, y, z0), tl = P(x0, y, z1), tr = P(x1, y, z1);
    if (Math.abs(tl.y - bl.y) < 6) { // edge-on (top-down): just a line
      c.strokeStyle = col('cobalt', 0.8); c.lineWidth = 3;
      c.beginPath(); c.moveTo(bl.x, bl.y); c.lineTo(br.x, br.y); c.stroke();
      return;
    }
    c.beginPath(); c.moveTo(bl.x, bl.y); c.lineTo(br.x, br.y); c.lineTo(tr.x, tr.y); c.lineTo(tl.x, tl.y); c.closePath();
    c.fillStyle = col('ink'); c.fill();
    c.strokeStyle = col('cobalt', 0.9); c.lineWidth = 3; c.stroke();
    // content, affine-mapped onto the screen (1080 × 570 units)
    c.save();
    const ux = (br.x - bl.x) / 1080, uy = (br.y - bl.y) / 1080, vx = (tl.x - bl.x) / 570, vy = (tl.y - bl.y) / 570;
    c.transform(ux, uy, -vx, -vy, tl.x, tl.y);
    c.beginPath(); c.rect(0, 0, 1080, 570); c.clip();
    const up = this.uptime;
    if (t < up.start - 0.05) {
      c.font = TYPE.third(84, 400);
      c.textAlign = 'center';
      c.fillStyle = col('bone', 0.85);
      c.fillText('please take your seat', 540, 270);
      c.font = TYPE.ai(24, 500);
      c.fillStyle = col('steel', 0.8);
      c.fillText('the talk will begin shortly', 540, 340);
    } else {
      const k = clamp((t - up.start) / 0.15);
      const secs = Math.floor(3_155_760 + (t - up.start) * 97);
      const d = Math.floor(secs / 86400), h = Math.floor((secs % 86400) / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
      c.fillStyle = col('cobaltDeep', 0.5 * k); c.fillRect(0, 0, 1080, 570);
      c.textAlign = 'left';
      c.font = TYPE.ai(40, 600);
      c.fillStyle = col('cobaltText', k);
      c.fillText('$ uptime', 70, 130);
      c.font = TYPE.ai(96, 700);
      c.fillText(`${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`, 70, 270);
      c.font = TYPE.ai(34, 500);
      c.fillStyle = col('steel', 0.85 * k);
      c.fillText('load average: ∞, ∞, ∞', 70, 360);
      c.fillText('status: still here', 70, 410);
      if (cursorOn(t)) { c.fillStyle = col('cobalt', k); c.fillRect(70, 450, 26, 50); }
    }
    c.restore();
  }

  /** YOU ARE HERE: a pin on your seat (a map's marker), from "find you". */
  private pin(c: CanvasRenderingContext2D, t: number, P: (x: number, y: number, z?: number) => { x: number; y: number; s: number }, end: number) {
    const w = this.l1.words[this.l1.words.length - 1]!;
    if (t < w.start - 0.1) return;
    const s = springStep(t - w.start + 0.1, 2.6, 0.55);
    const Y = this.you;
    const base = P(Y.x, Y.y, 0), top = P(Y.x, Y.y, 60 + 200 * s);
    // the dot (it stays; it becomes the maze's)
    c.fillStyle = col('ember');
    const dr = 11 + (1 - end) * 5 * Math.max(0, Math.sin(t * 4));
    c.beginPath(); c.arc(base.x, base.y, dr, 0, Math.PI * 2); c.fill();
    if (end >= 1) return;
    c.globalAlpha = 1 - end;
    c.strokeStyle = col('ember'); c.lineWidth = 2;
    c.beginPath(); c.arc(base.x, base.y, 18 + 26 * ((t * 0.9) % 1), 0, Math.PI * 2); c.globalAlpha = (1 - end) * (1 - ((t * 0.9) % 1)); c.stroke();
    c.globalAlpha = 1 - end;
    const tip = { x: top.x + (Math.abs(top.y - base.y) < 30 ? 40 : 0), y: Math.min(top.y, base.y - 40) };
    c.beginPath(); c.moveTo(base.x, base.y); c.lineTo(tip.x, tip.y); c.stroke();
    c.font = TYPE.ai(26, 700);
    const label = 'YOU ARE HERE';
    const lw = c.measureText(label).width + 28;
    c.fillStyle = col('bone');
    c.fillRect(tip.x - 2, tip.y - 46, lw * s, 46);
    c.fillStyle = col('ink');
    c.textAlign = 'left';
    if (s > 0.6) c.fillText(label, tip.x + 12, tip.y - 15);
    c.globalAlpha = 1;
  }

  /** The type: the third voice in Cormorant italic, bottom left; the AI's line typed in its mono. */
  private words(c: CanvasRenderingContext2D, t: number, keep: number) {
    const lines = [this.l1, this.seat, this.r1, this.uptime, this.l2, this.r2];
    const cur = [...lines].reverse().find((l) => t >= l.start - 0.35);
    if (!cur) return;
    const nextStart = lines[lines.indexOf(cur) + 1]?.start ?? this.ctx.end;
    const out = clamp((nextStart - 0.1 - t) / 0.25) * (cur === this.r2 ? keep : 1);
    if (cur === this.uptime) {
      const said = cur.words.filter((w) => t >= w.start).map((w) => w.w).join(' ');
      c.font = TYPE.ai(44, 500);
      c.fillStyle = col('cobaltText', out);
      c.textAlign = 'left';
      c.fillText(`(${said}`, 120, 930);
      if (cursorOn(t)) c.fillRect(126 + c.measureText(`(${said}`).width, 896, 20, 42);
      return;
    }
    // split at the comma (or keep short lines whole), two rows
    const ws = cur.words;
    const cut = ws.findIndex((w) => /,$/.test(w.w));
    const rows: Word[][] = cut > 0 && cut < ws.length - 1 ? (ws.length > 6 ? [ws.slice(0, ws.findIndex((w) => /^to$/i.test(w.w))), ws.slice(ws.findIndex((w) => /^to$/i.test(w.w)))] : [ws.slice(0, cut + 1), ws.slice(cut + 1)]) : [ws];
    const size = cur === this.seat ? 150 : 96;
    const fam = TYPE.thirdFamily(400);
    c.font = TYPE.third(size, 400);
    c.textAlign = 'left';
    rows.forEach((r, ri) => {
      let x = 120;
      const y = (rows.length === 1 ? 940 : 860) + ri * size * 1.05;
      for (const w of r) {
        const key = /^(you|you,|me|me,|seat)$/i.test(w.w) ? 'ember' : 'bone';
        c.fillStyle = col(key, wordAlpha(w, t, 0.18) * out);
        c.fillText(w.w, x, y);
        x += measure(w.w, fam, size) + size * 0.26;
      }
    });
  }
}
