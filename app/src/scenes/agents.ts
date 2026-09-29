// Bridge 2b, "And the multiple agents, that just might be / Simulating us in this infinity / Are still
// shipping code on our borrowed sanity":
//  1-2  an infinite zoom into a monitor showing the room showing the monitor… (Droste recursion):
//       every level is a "simulation" labelled by the agent running it; the camera falls through
//       one level per bar; INFINITY's letters repeat into the tunnel.
//  3    a conveyor of shipped boxes (SHIPPED ✓ stamps land on the beat), each with a draining
//       SANITY gauge; a loan slip: SANITY · BORROWED · DUE: YESTERDAY.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog, springStep } from '../engine/util';
import type { Line } from '../engine/lyrics';
import { TYPE, col, wordAlpha, wordRow } from './_look';

// the monitor rectangle in the frame (the recursion lives inside it)
const MX = 1060, MY = 180, MW = 720, MH = 405;
const S = MW / W; // scale of one level

export default class Agents extends Scene {
  layer = new Layer2D();
  base = new Layer2D();
  l1!: Line; l2!: Line; l3!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('multiple agents');
    this.l2 = ly.get('Simulating us');
    this.l3 = ly.get('shipping code');
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const ship = t >= this.l3.start - 0.12;
    const c = this.layer.ctx;
    if (!ship) this.recursion(t, f);
    else this.conveyor(t, f);
    // lyric
    if (!ship) {
      if (t < this.l2.start - 0.12) {
        const ws = this.l1.words;
        const ag = ws.findIndex((w) => /agents/i.test(w.w));
        wordRow(c, ws.slice(0, ag), t, 132, 690, 72);
        wordRow(c, ws.slice(ag, ag + 1), t, 124, 860, 190, { width: 75, weight: 900, color: () => 'cobaltText' });
        wordRow(c, ws.slice(ag + 1), t, 132, 960, 64);
      } else {
        const ws = this.l2.words;
        wordRow(c, ws.slice(0, 3), t, 132, 690, 72);
        this.infinity(c, ws[ws.length - 1]!, t);
      }
    }
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.5, bloomThreshold: 0.9, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.008 };
  }

  /** The room: dark wall, a big monitor (cobalt), a desk line, the agent's label. Drawn once per level. */
  private room(c: CanvasRenderingContext2D, level: number, t: number) {
    c.fillStyle = col(level % 2 ? 'ink2' : 'ink');
    c.fillRect(0, 0, W, H);
    c.fillStyle = col('graphite');
    c.fillRect(0, 760, W, 2);
    // the monitor frame and stand
    c.fillStyle = col('ink2');
    c.fillRect(MX - 18, MY - 18, MW + 36, MH + 36);
    c.fillRect(MX + MW / 2 - 14, MY + MH + 18, 28, 760 - MY - MH - 18);
    c.strokeStyle = col('cobalt');
    c.lineWidth = 4;
    c.strokeRect(MX - 18, MY - 18, MW + 36, MH + 36);
    // the agent running this level
    c.font = TYPE.ai(26, 600);
    c.fillStyle = col('cobaltText');
    c.textAlign = 'left';
    c.fillText(`agent-${7 - (level % 7)} · simulation depth ${level}`, MX - 18, MY + MH + 70);
    c.font = TYPE.ai(20, 400);
    c.fillStyle = col('steel', 0.7);
    c.fillText(`running: humans.sim  ·  fps: ${(60 / (level + 1)).toFixed(1)}  ·  ${hash(level, 3) > 0.5 ? 'vibes: ok' : 'vibes: ??'}`, MX - 18, MY + MH + 106);
    // us: a row of heads and shoulders from behind, watching the screen (cobalt rim from it)
    for (let i = 0; i < 6; i++) {
      const hx = MX - 40 + i * 150 + (hash(level, i) - 0.5) * 30, hy = 930 + hash(i, level + 2) * 30, r = 42 + hash(i, 5) * 10;
      c.fillStyle = col('cobalt', 0.8);
      c.beginPath(); c.arc(hx, hy - 4, r + 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.roundRect(hx - r * 1.9 - 3, hy + r * 0.6 - 3, r * 3.8 + 6, 200, r); c.fill();
      c.fillStyle = col('ink');
      c.beginPath(); c.arc(hx, hy, r, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.roundRect(hx - r * 1.9, hy + r * 0.6, r * 3.8, 200, r); c.fill();
    }
    void t;
  }

  /** Droste recursion with a continuous zoom: fall one level per bar into the monitor. */
  private recursion(t: number, f: Frame) {
    const b = this.base.ctx;
    const k = f.bar - Math.floor(this.ctx.audio.barAt(this.ctx.start)); // levels fallen (continuous)
    const lvl = Math.floor(k), frac = ease.inOutCubic(k - lvl);
    // paint the base: level lvl+5 innermost, outward to lvl
    this.base.clear();
    for (let d = 0; d <= 6; d++) {
      b.save();
      // screen of level d sits at MX,MY scaled S^d
      let x = 0, y = 0, s = 1;
      for (let i = 0; i < d; i++) { x += MX * s; y += MY * s; s *= S; }
      b.translate(x, y);
      b.scale(s, s);
      this.room(b, lvl + d, t);
      b.restore();
    }
    // zoom toward the monitor by frac (s from 1 to 1/S)
    const c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const z = Math.pow(1 / S, frac);
    const cx = MX + (MX * S) / (1 - S) * 0, cy = 0;
    void cx; void cy;
    // the fixed point of the recursion (where the tunnel converges)
    const fx = MX / (1 - S), fy = MY / (1 - S);
    c.save();
    c.translate(fx, fy);
    c.scale(z, z);
    c.translate(-fx, -fy);
    c.drawImage(this.base.canvas, 0, 0, W, H);
    c.restore();
  }

  /** INFINITY: repeated into the tunnel, smaller and smaller. */
  private infinity(c: CanvasRenderingContext2D, w: Line['words'][number], t: number) {
    const a = wordAlpha(w, t);
    for (let i = 5; i >= 0; i--) {
      const s = Math.pow(0.62, i);
      c.font = TYPE.human(190 * s, 75, 900);
      c.fillStyle = col(i === 0 ? 'bone' : 'cobaltText', a * (i === 0 ? 1 : 0.5 * (1 - i / 6)));
      c.fillText('INFINITY', 124 + i * 60 * s + i * 30, 880 - i * 28);
    }
  }

  /** The conveyor of shipped code, each box with a draining sanity gauge. */
  private conveyor(t: number, f: Frame) {
    const c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const au = this.ctx.audio;
    const belt = 760;
    const speed = 260;
    const off = ((t - this.l3.start) * speed) % 260;
    // belt
    c.fillStyle = col('ink2'); c.fillRect(0, belt, W, 40);
    c.strokeStyle = col('graphite'); c.lineWidth = 2;
    for (let x = -off; x < W; x += 52) { c.beginPath(); c.moveTo(x, belt + 6); c.lineTo(x + 26, belt + 34); c.stroke(); }
    for (let x = -off % 130; x < W; x += 130) { c.beginPath(); c.arc(x, belt + 56, 16, 0, Math.PI * 2); c.stroke(); }
    // boxes
    for (let i = -1; i < 9; i++) {
      const x = W - (i * 260 + off) - 240;
      const id = Math.floor((t - this.l3.start) * speed / 260) + i;
      const bw = 190, bh = 150, y = belt - bh;
      c.fillStyle = col('ink2'); c.fillRect(x, y, bw, bh);
      c.strokeStyle = col('bone', 0.7); c.lineWidth = 2; c.strokeRect(x + 1, y + 1, bw - 2, bh - 2);
      c.fillStyle = col('bone', 0.8); c.fillRect(x + bw / 2 - 18, y, 36, bh); // tape
      c.font = TYPE.ai(15, 600); c.fillStyle = col('ash'); c.textAlign = 'left';
      c.fillText(`PR #${4400 + ((id * 37) % 600)}`, x + 12, y + 26);
      // sanity gauge draining as it travels
      const drain = clamp(1 - (x + bw) / W);
      const s = clamp(0.9 - drain * 0.95 - hash(id, 2) * 0.1);
      c.fillStyle = col('graphite'); c.fillRect(x + 12, y + bh - 30, bw - 24, 8);
      c.fillStyle = col(s < 0.25 ? 'error' : 'ember'); c.fillRect(x + 12, y + bh - 30, (bw - 24) * s, 8);
      c.font = TYPE.ai(12, 600); c.fillStyle = col('steel', 0.8);
      c.fillText(`SANITY ${Math.round(s * 100)}%`, x + 12, y + bh - 38);
      // SHIPPED stamp, landing on the beat as the box passes the middle
      if (x < W * 0.55) {
        const tb = au.timeOfBeat(Math.floor(au.beatAt(t)));
        const pop = springStep(Math.max(0, x < W * 0.5 ? 1 : t - tb), 4, 0.5);
        c.save();
        c.translate(x + bw / 2, y + bh / 2 - 6);
        c.rotate(-0.15);
        c.scale(2 - Math.min(1, pop), 2 - Math.min(1, pop));
        c.strokeStyle = col('signal'); c.lineWidth = 3; c.strokeRect(-72, -18, 144, 36);
        c.font = TYPE.ai(19, 700); c.fillStyle = col('signal'); c.textAlign = 'center';
        c.fillText('SHIPPED ✓', 0, 7);
        c.restore();
      }
    }
    // the loan slip
    c.textAlign = 'left';
    c.fillStyle = col('bone'); c.fillRect(1380, 180, 400, 150);
    c.fillStyle = col('ink'); c.font = TYPE.ai(16, 700);
    c.fillText('LOAN SLIP  #0001', 1400, 214);
    c.font = TYPE.ai(22, 600);
    c.fillText('SANITY · BORROWED', 1400, 256);
    c.fillStyle = col('error'); c.fillText('DUE: YESTERDAY', 1400, 296);
    // lyric
    const ws = this.l3.words;
    const shipping = ws.findIndex((w) => /shipping/i.test(w.w)), on = ws.findIndex((w) => /^on$/i.test(w.w)), sanity = ws.findIndex((w) => /sanity/i.test(w.w));
    wordRow(c, ws.slice(0, shipping), t, 132, 250, 72);
    wordRow(c, ws.slice(shipping, on), t, 124, 400, 150, { width: 75, weight: 900 });
    wordRow(c, ws.slice(on, sanity), t, 132, 500, 72);
    wordRow(c, ws.slice(sanity), t, 124, 650, 150, { width: 75, weight: 900, color: () => 'ember' });
    void prog; void f;
  }
}
