// Intro chorus line 3, "A lot of prompts and 'vibes' are gonna be required but": a waterfall of
// prompt cards (the AI's cobalt, mono) slides up on the beat while the Human's line is set in a
// Swiss column on the left; VIBES wobbles like a mood. After "but" the cards fall into a grid and
// become the lit windows of the office tower (the next shot).
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog, springStep } from '../engine/util';
import { layout } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordRow } from './_look';

const PROMPTS = [
  'make it pop', 'no, the OTHER button', 'fix it (again)', 'make no mistakes', 'you are a senior engineer', 'ultrathink',
  'why is prod down', 'pls', 'undo that', 'same but faster', 'rewrite it in rust', 'explain like I’m the CTO',
  'add tests (real ones)', 'it worked yesterday', 'just vibe it', 'make it enterprise', 'ok now make it simple',
  'what does this regex do', 'act as a 10x engineer', 'center the div', 'ship it', 'is this secure?', 'more AI',
  'keep the tone but change everything', 'fix the fix', 'do not hallucinate', 'thanks!!', 'one more thing…',
];
const CARD_W = 700, CARD_H = 66, CX = 1130;
// the office tower's facade in the next shot (office.ts, exterior): 8 columns x 134 px, floors 163 px
const TOWER = { x0: 698, x1: 1773, cw: 134.4, fh: 163.3, y0: 484.4 - 163.3 * 3 };

export default class Prompts extends Scene {
  layer = new Layer2D();
  line!: Line;

  override init() {
    this.line = this.ctx.lyrics.get('A lot of prompts', this.ctx.params.nth ?? 0);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    const au = this.ctx.audio;
    const ws = this.line.words;
    const but = ws[ws.length - 1]!;
    this.layer.clear(col('ink'));

    // a faint cobalt glow from the feed (the AI's side of the frame)
    const g = c.createRadialGradient(CX + CARD_W / 2, 540, 50, CX + CARD_W / 2, 540, 900);
    g.addColorStop(0, col('cobaltDeep', 0.9));
    g.addColorStop(1, col('cobaltDeep', 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // ---- the feed: one card per half-beat, each sliding up with a spring; after "but" the cards
    // fall into a grid (the tower's windows)
    const b0 = au.beatAt(this.ctx.start), bNow = au.beatAt(t);
    const rate = (this.ctx.params.heat ?? 0) ? 4 : 2; // cards per beat (chorus 2: twice as fast)
    const n = Math.floor((bNow - b0) * rate) + 6; // cards so far (half-beats), with a few already there
    const toGrid = ease.inOutCubic(prog(t, this.ctx.end - 1.0, this.ctx.end - 0.2));
    // the tower's facade rises behind the cards as they settle into its windows
    if (toGrid > 0) {
      c.fillStyle = col('ink', toGrid);
      c.fillRect(TOWER.x0 - 6, 0, TOWER.x1 - TOWER.x0 + 12, H);
      c.fillStyle = col('graphite', 0.55 * toGrid);
      for (let x = TOWER.x0; x <= TOWER.x1 + 1; x += TOWER.cw) c.fillRect(x - 1, 0, 2, H);
    }
    const NG = 8 * 7;
    const total = Math.max(n, toGrid > 0 ? NG : 0);
    for (let slot = 0; slot < (toGrid > 0 ? NG : 14); slot++) {
      const i = n - 1 - slot;
      const born = b0 + (i - 6) / rate;
      const spring = springStep(Math.max(0, (bNow - born) * (60 / au.bpm)), 3.2, 0.55);
      let x = CX, y = 920 - slot * (CARD_H + 16) + (1 - spring) * 90;
      let w = CARD_W, h = CARD_H;
      if (slot >= 14) { y = -120 - (slot - 14) * 30; } // cards that scrolled away fall back in
      const gc = slot % 8, gr = Math.floor(slot / 8);
      const tx = TOWER.x0 + gc * TOWER.cw + 3, ty = TOWER.y0 + gr * TOWER.fh + 5;
      const kk = clamp(toGrid * 1.3 - (slot / NG) * 0.3);
      const e = ease.inOutCubic(kk);
      x += (tx - x) * e; y += (ty - y) * e; w += (TOWER.cw - 6 - w) * e; h += (TOWER.fh - 10 - h) * e;
      const a = slot >= 14 ? clamp(kk * 3) : clamp(spring * 2) * clamp((y + h) / 120);
      if (a <= 0.01 || y > H + 20 || i < 0 && slot < 14) continue;
      const p = PROMPTS[((i % PROMPTS.length) + PROMPTS.length) % PROMPTS.length]!;
      const lit = hash(slot, 3) > 0.84 ? 'ember' : hash(slot, 3) > 0.8 ? 'cobaltText' : null;
      c.globalAlpha = a;
      // in flight: outlines only; the window fill arrives as they land
      const land = clamp((e - 0.7) / 0.3);
      if (e < 0.05) { c.fillStyle = col('cobaltDeep', 0.6); c.fillRect(x, y, w, h); }
      if (land > 0) { c.fillStyle = lit ? col(lit, 0.26 * land) : col('ink2', 0.95 * land); c.fillRect(x, y, w, h); }
      c.strokeStyle = col('cobalt', 0.85 * (1 - e));
      c.lineWidth = 1.5;
      if (e < 0.95) c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      if (e < 0.6) {
        c.globalAlpha = a * (1 - e / 0.6);
        c.font = TYPE.ai(26, 400);
        c.textBaseline = 'middle';
        c.textAlign = 'left';
        c.fillStyle = col('cobalt');
        c.fillText('›', x + 22, y + h / 2 + 1);
        c.fillStyle = col('cobaltText');
        const typed = slot === 0 ? p.slice(0, Math.floor(p.length * clamp((bNow - born) * 1.6))) : p;
        c.fillText(typed, x + 52, y + h / 2 + 1);
        if (slot === 0 && cursorOn(t)) c.fillRect(x + 56 + c.measureText(typed).width, y + h / 2 - 14, 14, 28);
        if (slot > 0) {
          c.font = TYPE.ai(14, 500);
          c.textAlign = 'right';
          c.fillStyle = col(hash(i, 5) > 0.75 ? 'signal' : 'steel', 0.8);
          c.fillText(hash(i, 5) > 0.75 ? 'ERR · retrying' : `${(hash(i, 7) * 9 + 1).toFixed(1)}s · 42k tokens`, x + w - 20, y + h / 2 + 1);
        }
      }
      c.globalAlpha = 1;
    }
    void total;
    // prompt counter
    const sent = Math.floor(1204 + (bNow - b0) * 37);
    c.globalAlpha = 1 - toGrid;
    c.font = TYPE.ai(15, 500);
    c.textAlign = 'left';
    c.textBaseline = 'alphabetic';
    c.fillStyle = col('steel', 0.8);
    c.fillText(`PROMPTS SENT ${sent.toLocaleString('en-US')}  ·  VIBES: IMMACULATE`, CX, 1045);

    c.globalAlpha = 1 - toGrid;
    // ---- the lyric column (left): A LOT OF / PROMPTS / AND “VIBES” / ARE GONNA BE REQUIRED / BUT
    const L = (i: number, j: number) => ws.slice(i, j);
    wordRow(c, L(0, 3), t, 132, 250, 72);
    wordRow(c, L(3, 4), t, 124, 430, 180, { width: 100, weight: 900 });
    const andW = wordRow(c, L(4, 5), t, 132, 600, 120, { width: 100, weight: 800 });
    this.vibes(c, ws[5]!, t, 132 + andW + 36, 600, 120);
    wordRow(c, L(6, 10), t, 132, 720, 64);
    wordRow(c, L(10, 11), t, 132, 860, 120, { width: 100, weight: 900, color: () => 'bone' });
    c.globalAlpha = 1;

    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.5, bloomThreshold: 0.95, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.008 };
  }

  /** “VIBES”: glyph by glyph, each floating on its own sine, a little amber shimmer. */
  private vibes(c: CanvasRenderingContext2D, w: { w: string; start: number; end: number }, t: number, x: number, y: number, size: number) {
    const label = w.w.toUpperCase();
    const fam = TYPE.humanFamily(100, 800);
    const lay = layout(label, fam, size);
    const a = wordAlpha(w as never, t);
    const k = clamp((t - w.start) / 0.4);
    c.font = TYPE.human(size, 100, 800);
    c.textBaseline = 'alphabetic';
    lay.glyphs.forEach((g, i) => {
      const dy = Math.sin(t * 5.5 + i * 0.9) * 14 * k;
      const rot = Math.sin(t * 4 + i * 1.3) * 0.08 * k;
      c.save();
      c.translate(x + g.x + g.w / 2, y + dy);
      c.rotate(rot);
      c.fillStyle = col(i % 2 && k > 0 ? 'ember' : 'bone', a);
      c.fillText(g.ch, -g.w / 2, 0);
      c.restore();
    });
  }
}
