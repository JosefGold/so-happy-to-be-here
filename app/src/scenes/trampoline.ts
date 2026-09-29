// Verse 2a (cont.), "But my model's like a trampoline / Bouncing 'tween 'hallucinating stuff' and
// having 'super-human powers'": the model (the AI's cobalt block cursor, with a little shadow)
// bounces on a trampoline, one bounce per beat, drifting between two giant words: HALLUCINATING
// (left, soft, melting, misspelling itself) and SUPER-HUMAN POWERS (right, hard cobalt, confident).
// The trampoline's bed dips on each landing.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, prog } from '../engine/util';
import { layout } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { TYPE, col, wordAlpha, wordRow, wordState } from './_look';

const BED_Y = 840, BED_X0 = 680, BED_X1 = 1240;

export default class Trampoline extends Scene {
  layer = new Layer2D();
  l1!: Line; l2!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('like a trampoline');
    this.l2 = ly.get('super-human');
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const w2 = this.l2.words;
    const hall = w2.find((w) => /hallucinating/i.test(w.w))!;
    const sup = w2.find((w) => /super/i.test(w.w))!;
    // which side the model leans to: towards HALLUCINATING, then SUPER-HUMAN, alternating per bar after
    const bar = Math.floor(f.bar);
    let side = t < hall.start ? 0 : t < sup.start ? -1 : 1;
    if (t > this.l2.end) side = bar % 2 ? -1 : 1;
    // the bounce: parabola per beat, landing on the beat
    const ph = f.beatPhase;
    const hgt = 4 * ph * (1 - ph); // 0 at the beat, 1 mid-beat
    const lean = ease.inOutCubic(clamp(prog(t, this.l1.start, this.l1.start + 0.5))) * 0;
    void lean;
    const targetX = 960 + side * 200;
    const drift = 960 + (targetX - 960) * ease.inOutCubic(ph < 0.5 ? ph * 2 : 1);
    const bx = side === 0 ? 960 : drift;
    const by = BED_Y - 60 - hgt * 380;
    const dip = Math.max(0, 1 - ph * 5) * 60; // the bed dips just after landing

    // the two words, big, on either side (only once they're sung; dim before)
    const hA = wordAlpha(hall, t, 0.1), sA = wordAlpha(sup, t, 0.1);
    this.hallucinating(c, t, 110, 560, hA, side === -1 && hgt < 0.2);
    c.textAlign = 'right';
    const hitR = side === 1 && t >= sup.start ? Math.max(0, 1 - ph * 5) : 0; // it lands: the word flares
    c.font = TYPE.human(128, 75, 900);
    c.fillStyle = col(hitR > 0.3 ? 'bone' : 'cobaltText', sA);
    c.fillText('SUPER-', W - 110, 470);
    c.fillText('HUMAN', W - 110, 590);
    c.font = TYPE.human(86, 75, 900);
    c.fillText('POWERS', W - 110, 690);
    c.textAlign = 'left';
    // the trampoline: frame, legs, a sagging bed
    c.strokeStyle = col('bone', 0.9);
    c.lineWidth = 4;
    c.beginPath();
    const mx = Math.max(BED_X0 + 40, Math.min(BED_X1 - 40, bx));
    c.moveTo(BED_X0, BED_Y);
    c.quadraticCurveTo(mx, BED_Y + dip * 2, BED_X1, BED_Y);
    c.stroke();
    c.lineWidth = 6;
    c.beginPath(); c.moveTo(BED_X0 - 30, BED_Y); c.lineTo(BED_X1 + 30, BED_Y); c.stroke();
    for (const x of [BED_X0 + 30, BED_X1 - 30]) { c.beginPath(); c.moveTo(x, BED_Y); c.lineTo(x - 30 * Math.sign(x - 960), BED_Y + 110); c.stroke(); }
    // springs
    c.lineWidth = 1.5;
    for (let x = BED_X0; x <= BED_X1; x += 40) { c.beginPath(); c.moveTo(x, BED_Y); c.lineTo(x, BED_Y + 8); c.stroke(); }
    // ---- the model: the AI's cursor. Each landing bumps its version; each bounce does a trick
    const au = this.ctx.audio;
    const b0 = Math.floor(au.beatAt(this.ctx.start + 0.05));
    const bounce = Math.max(0, Math.floor(f.beat) - b0); // bounces so far
    const VERSIONS = ['v7', 'v7.1', 'v7.1-fix', 'v8-preview', 'v8-turbo', 'v8-turbo-max', 'v9-ultra', 'v9-ultra-max', 'v10 (agi?)', 'v10.1'];
    const ver = VERSIONS[Math.min(VERSIONS.length - 1, bounce)]!;
    const trick = bounce < 1 ? 0 : [1, 2, 3, 4, 2, 3, 4, 1][(bounce - 1) % 8]!; // 1 flip, 2 double spin, 3 split, 4 trail
    const sq = 1 + Math.max(0, 1 - ph * 6) * 0.35;
    c.fillStyle = col('ink2');
    c.beginPath(); c.ellipse(bx, BED_Y + 4, 40 * (1.2 - hgt * 0.6), 8, 0, 0, Math.PI * 2); c.fill();
    const air = clamp((ph - 0.08) / 0.84); // 0..1 through the airtime
    const drawModel = (x: number, y: number, rot: number, a: number) => {
      c.save();
      c.translate(x, y + 60 - 50 / sq);
      c.rotate(rot);
      c.globalAlpha = a;
      c.fillStyle = col('cobalt');
      c.fillRect(-28 * sq, -50 / sq, 56 * sq, 100 / sq);
      c.restore();
      c.globalAlpha = 1;
    };
    const rot = trick === 1 ? air * Math.PI * 2 : trick === 2 ? air * Math.PI * 4 : 0;
    if (trick === 4) for (let k = 5; k >= 1; k--) { // afterimage trail
      const pp = Math.max(0, ph - k * 0.045), hh = 4 * pp * (1 - pp);
      drawModel(bx - (bx - 960) * 0 - k * 0, BED_Y - 60 - hh * 380, 0, 0.12 * (6 - k));
    }
    if (trick === 3 && air > 0.05 && air < 0.95) { // it splits into three agents mid-air
      const spread = Math.sin(air * Math.PI) * 170;
      drawModel(bx - spread, by + 20, -0.2, 0.9);
      drawModel(bx + spread, by + 20, 0.2, 0.9);
    }
    drawModel(bx, by, rot, 1);
    // sparks on each landing
    const land = Math.max(0, 1 - ph * 4);
    if (land > 0 && t > this.ctx.start + 0.1) {
      c.strokeStyle = col(side < 0 ? 'ember' : 'cobaltText', land);
      c.lineWidth = 2;
      for (let k = 0; k < 10; k++) {
        const a = Math.PI + (k / 9) * Math.PI, r0 = 40 + (1 - land) * 80, r1 = r0 + 30;
        c.beginPath(); c.moveTo(bx + Math.cos(a) * r0, BED_Y + Math.sin(a) * r0 * 0.6); c.lineTo(bx + Math.cos(a) * r1, BED_Y + Math.sin(a) * r1 * 0.6); c.stroke();
      }
    }
    c.font = TYPE.ai(17, 600);
    c.fillStyle = col('steel', 0.8);
    c.textAlign = 'center';
    c.fillText(`model.${ver}`, 960, BED_Y + 150);
    // ---- what it says when it lands: confident nonsense (left, amber) or brags (right, cobalt)
    const NONSENSE = ['2 + 2 = 5 (high confidence)', 'source: trust me', 'the moon is a CDN', 'Python was written in 1066', 'null == “yes”', 'HTTP 418 is best practice'];
    const BRAGS = ['wrote 10,000 tests ✓', 'solved P = NP (probably)', 'refactored everything ✓', 'read every RFC ✓', 'shipped 3 startups ✓', 'fixed prod in 4 ms ✓'];
    const lb = Math.floor(f.beat);
    for (let k = 0; k < 1; k++) {
      const bi = lb - k;
      if (bi <= b0) continue;
      const tb = au.timeOfBeat(bi);
      const sd = tb < hall.start ? 0 : tb < sup.start ? -1 : tb > this.l2.end ? (Math.floor(au.barAt(tb)) % 2 ? -1 : 1) : 1;
      if (sd === 0) continue;
      const age = t - tb;
      const a = clamp(1 - age / 0.9) * clamp(age * 10);
      if (a <= 0) continue;
      const txt = (sd < 0 ? NONSENSE : BRAGS)[bi % 6]!;
      c.font = TYPE.ai(30, 500);
      c.textAlign = sd < 0 ? 'left' : 'right';
      c.fillStyle = col(sd < 0 ? 'ember' : 'cobaltText', a);
      c.fillText(txt, sd < 0 ? 110 : W - 110, 780 - age * 40);
    }
    // ---- the gauges: CONFIDENCE pinned, ACCURACY swinging
    const acc = clamp(side < 0 ? 0.1 + 0.08 * Math.sin(t * 9) : side > 0 ? 0.9 + 0.05 * Math.sin(t * 7) : 0.5);
    const gx = 700, gy = 1030, gw = 220;
    c.textAlign = 'left';
    c.font = TYPE.ai(15, 600);
    const gauge = (label: string, v: number, x: number, key: string) => {
      c.fillStyle = col('steel', 0.8); c.fillText(label, x, gy - 14);
      c.fillStyle = col('graphite'); c.fillRect(x, gy, gw, 6);
      c.fillStyle = col(key); c.fillRect(x, gy, gw * clamp(v), 6);
      c.fillStyle = col('steel', 0.8); c.fillText(`${Math.round(v * 100)}%`, x + gw + 12, gy + 8);
    };
    gauge('CONFIDENCE', 0.99, gx, 'cobalt');
    gauge('ACCURACY', acc, gx + 300, acc < 0.3 ? 'error' : 'cobaltText');
    c.textAlign = 'left';
    void hash;

    // the lyric, top
    if (t < this.l2.start - 0.1) {
      const w1 = this.l1.words;
      const tr = w1.findIndex((w) => /trampoline/i.test(w.w));
      wordRow(c, w1.slice(0, tr), t, 132, 190, 64);
      wordRow(c, w1.slice(tr), t, 124, 330, 140, { width: 75, weight: 900 });
    } else {
      const ht = w2.indexOf(hall);
      wordRow(c, w2.slice(0, ht), t, 132, 190, 64);
      const i2 = w2.findIndex((w) => /^and$/i.test(w.w));
      wordRow(c, w2.slice(i2, i2 + 2), t, W - 110, 330, 64, { align: 'right' });
    }
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.55, bloomThreshold: 0.9, vignette: 0.42, grain: 0.055, zoom: 1.02 - hgt * 0.02 + Math.max(0, 1 - ph * 6) * 0.012, shake: [0, Math.max(0, 1 - ph * 8) * 4] as [number, number] };
  }

  /** HALLUCINATING: warm, soft, its letters drifting and occasionally swapping for wrong ones. */
  private hallucinating(c: CanvasRenderingContext2D, t: number, x: number, y: number, a: number, glow: boolean) {
    const label = 'HALLUCINATING';
    const alt = 'HALUCINATTING';
    const size = 92, fam = TYPE.humanFamily(62, 900);
    const lay = layout(label, fam, size);
    c.font = TYPE.human(size, 62, 900);
    lay.glyphs.forEach((g, i) => {
      const fi = Math.floor(t * 6);
      void fi; void alt;
      const ch = g.ch;
      const dy = Math.sin(t * 3 + i * 0.7) * 16;
      c.fillStyle = col(glow ? 'ember' : 'signal', a);
      c.fillText(ch, x + g.x, y + dy);
    });
    c.font = TYPE.human(70, 75, 900);
    c.fillStyle = col('signal', a);
    c.fillText('STUFF', x, y + 110);
    void wordState;
  }
}
