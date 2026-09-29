// Bridge 1: three movements, handed off without a cut.
//  1 "And the multiple repos, that just might be / Ended up deprecated in this insanity"
//     repo cards branch off the git line (continuing the timeline scene), each stamped ARCHIVED on
//     the beats of line 2; INSANITY's letters come loose and scatter.
//  2 "We're still tuning the weights on a transformer theory."
//     a mixing desk of model weights: every fader labelled (attn.q, mlp.3, lr, temperature, vibes…),
//     the AI's cursor riding them to the music (the faders follow the audio envelopes).
//  3 "The only thing that's clear to me / Is…"
//     a white-out: bone paper, ink type, perfectly still; the three dots of "Is…" land on three beats.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, noise1, prog, springStep } from '../engine/util';
import { measure } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordRow, wordState } from './_look';

const LINE_Y = 930;
const REPOS = ['auth-service', 'auth-service-v2', 'auth-service-v2-final', 'legacy-api', 'shared-utils', 'utils-shared', 'monorepo', 'mono-repo-2',
  'design-system', 'design-system-new', 'infra', 'infra-old', 'ml-pipeline', 'hackathon-2019', 'poc-do-not-use', 'microservice-37'];
const FADERS = ['attn.q', 'attn.k', 'attn.v', 'mlp.1', 'mlp.2', 'mlp.3', 'norm', 'lr', 'dropout', 'temp', 'top_p', 'vibes'];

export default class Bridge1 extends Scene {
  layer = new Layer2D();
  l1!: Line; l2!: Line; l3!: Line; l4!: Line; l5!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('And the multiple repos');
    if (this.ctx.params.only === 'clear') { this.l2 = this.l3 = this.l1; }
    if (this.ctx.params.only !== 'clear') { this.l2 = ly.get('Ended up deprecated'); this.l3 = ly.get('tuning the weights'); }
    this.l4 = ly.get('The only thing that’s clear to me', this.ctx.params.nth ?? 0);
    this.l5 = ly.lines[this.l4.i + 1]!; // "Is…"
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    const white = this.ctx.params.only === 'clear' || t >= this.l4.start - 0.08; // the white-out lands on "The only thing"
    this.layer.clear(white ? col('bone') : col('ink'));
    if (white) this.clear(c, t);
    else if (t >= this.l3.start - 0.25) this.desk(c, t, f);
    else this.repos(c, t, f);
    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    const flash = white ? Math.max(0, 1 - (t - this.l4.start + 0.08) * 5) * 0.6 : 0;
    return white
      ? { bloom: 0, vignette: 0.15, grain: 0.035, halation: 0, flash }
      : { bloom: 0.5, bloomThreshold: 0.95, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.008 };
  }

  // ---- 1: repos off the git line, archived
  private repos(c: CanvasRenderingContext2D, t: number, f: Frame) {
    // the git line (continuing from the timeline scene), commits sliding left
    const slide = (t - this.ctx.start) * 120;
    c.fillStyle = col('graphite');
    c.fillRect(0, LINE_Y - 1, W, 2);
    for (let x = -((slide % 160)); x < W; x += 160) { c.fillStyle = col('ember'); c.beginPath(); c.arc(x, LINE_Y, 6, 0, Math.PI * 2); c.fill(); }
    // repo cards: branch up from the line, one per half-beat
    const au = this.ctx.audio;
    const b0 = au.beatAt(this.l1.start - 0.3), bn = au.beatAt(t);
    const n = clamp(Math.floor((bn - b0) * 2), 0, REPOS.length);
    const archive = this.l2.words;
    const cols = 4, cw = 214, ch = 84, x0 = 1920 - 96 - cols * (cw + 14) + 14, y0 = 130;
    for (let i = 0; i < n; i++) {
      const gc = i % cols, gr = Math.floor(i / cols);
      const x = x0 + gc * (cw + 14), y = y0 + gr * (ch + 22);
      const born = b0 + i / 2;
      const k = springStep(Math.max(0, (bn - born) * 60 / au.bpm), 3, 0.55);
      // branch line from the git line up to the card
      c.strokeStyle = col('graphite');
      c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(x + 24, LINE_Y); c.lineTo(x + 24, LINE_Y - (LINE_Y - (y + ch)) * clamp(k)); c.stroke();
      c.save();
      c.translate(0, (1 - k) * 60);
      c.globalAlpha = clamp(k * 2);
      c.fillStyle = col('ink2'); c.fillRect(x, y, cw, ch);
      c.strokeStyle = col('graphite'); c.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      c.font = TYPE.ai(15, 600); c.textAlign = 'left'; c.fillStyle = col('bone');
      c.fillText(REPOS[i]!, x + 14, y + 32);
      c.font = TYPE.ai(12, 400); c.fillStyle = col('ash');
      c.fillText(`★ ${Math.floor(hash(i, 1) * 90)} · ${Math.floor(2 + hash(i, 2) * 9)}y ago`, x + 14, y + 60);
      // ARCHIVED: stamped on the beats of line 2, card by card
      const st = this.l2.start + (i / REPOS.length) * (this.l2.end - this.l2.start);
      if (t >= st) {
        const s = springStep(t - st, 4, 0.5);
        c.save();
        c.translate(x + cw / 2, y + ch / 2);
        c.rotate(-0.12);
        c.scale(2 - s, 2 - s);
        c.strokeStyle = col('error'); c.lineWidth = 3;
        c.strokeRect(-70, -18, 140, 36);
        c.font = TYPE.ai(18, 700); c.textAlign = 'center'; c.fillStyle = col('error');
        c.fillText('ARCHIVED', 0, 7);
        c.restore();
        c.fillStyle = col('ink', 0.35); c.fillRect(x, y, cw, ch);
      }
      c.restore();
    }
    // the lyric
    const w1 = this.l1.words;
    const repos = w1.findIndex((w) => /repos/i.test(w.w));
    if (t < this.l2.start - 0.1) {
      wordRow(c, w1.slice(0, repos), t, 132, 520, 72);
      wordRow(c, w1.slice(repos, repos + 1), t, 124, 700, 190, { width: 112, weight: 900 });
      wordRow(c, w1.slice(repos + 1), t, 132, 810, 64);
    } else {
      const w2 = this.l2.words;
      const ins = w2.findIndex((w) => /insanity/i.test(w.w));
      wordRow(c, w2.slice(0, 2), t, 132, 450, 72);
      wordRow(c, w2.slice(2, 3), t, 124, 620, 170, { width: 75, weight: 900, color: () => 'error' });
      wordRow(c, w2.slice(3, ins), t, 132, 730, 64);
      this.insanity(c, w2[ins]!, t, 124, 880);
    }
    void f;
  }

  /** INSANITY: set tight, then its letters come loose and drift apart on the beat. */
  private insanity(c: CanvasRenderingContext2D, w: Line['words'][number], t: number, x: number, y: number) {
    const size = 150, fam = TYPE.humanFamily(75, 900), label = 'INSANITY';
    const st = wordState(w, t);
    c.font = TYPE.human(size, 75, 900);
    c.textBaseline = 'alphabetic';
    const loose = ease.outCubic(prog(t, w.end - 0.1, w.end + 0.9));
    let xx = x;
    Array.from(label).forEach((ch, i) => {
      const cw = measure(ch, fam, size);
      const dx = (hash(i, 3) - 0.5) * 220 * loose, dy = (hash(i, 4) - 0.6) * 260 * loose;
      c.save();
      c.translate(xx + cw / 2 + dx, y + dy);
      c.rotate((hash(i, 5) - 0.5) * 1.4 * loose);
      c.fillStyle = col('bone', wordAlpha(w, t) * (st.sung ? 1 : 1));
      c.fillText(ch, -cw / 2, 0);
      c.restore();
      xx += cw + 2;
    });
  }

  // ---- 2: the mixing desk of weights
  private desk(c: CanvasRenderingContext2D, t: number, f: Frame) {
    const au = this.ctx.audio;
    const k = ease.outCubic(prog(t, this.l3.start - 0.25, this.l3.start + 0.3));
    const x0 = 820, fw = 88, top = 230, bot = 860;
    // panel
    c.fillStyle = col('ink2'); c.fillRect(x0 - 40, top - 90, FADERS.length * fw + 60, bot - top + 190);
    c.strokeStyle = col('graphite'); c.strokeRect(x0 - 39.5, top - 89.5, FADERS.length * fw + 59, bot - top + 189);
    c.font = TYPE.ai(14, 600); c.fillStyle = col('steel', 0.8); c.textAlign = 'left';
    c.fillText('TRANSFORMER · MIXDOWN · ch 1–12', x0 - 16, top - 58);
    const feats = ['low', 'mid', 'high', 'vocal', 'drums', 'bass', 'rms', 'other'];
    let lastY = 0, lastX = 0;
    FADERS.forEach((name, i) => {
      const x = x0 + i * fw + fw / 2;
      // track + ticks
      c.fillStyle = col('graphite'); c.fillRect(x - 2, top, 4, bot - top);
      for (let v = 0; v <= 10; v++) c.fillRect(x - 12, top + ((bot - top) * v) / 10, 6, 1.5);
      // level follows the music (+ a slow LFO per fader), eased in with k
      const env = au.env(feats[i % feats.length]!, t);
      const lvl = clamp(0.25 + 0.6 * env + 0.12 * noise1(t * 0.7 + i, 3)) * k + 0.08 * (1 - k);
      const y = bot - (bot - top) * lvl;
      // meter
      c.fillStyle = col(i === FADERS.length - 1 ? 'signal' : 'cobalt', 0.35);
      c.fillRect(x + 10, y, 6, bot - y);
      // cap
      c.fillStyle = col(i === FADERS.length - 1 ? 'ember' : 'bone');
      c.fillRect(x - 24, y - 12, 48, 24);
      c.fillStyle = col('ink'); c.fillRect(x - 24, y - 1, 48, 2);
      c.font = TYPE.ai(15, 600); c.textAlign = 'center'; c.fillStyle = col(i === FADERS.length - 1 ? 'ember' : 'ash');
      c.fillText(name, x, bot + 40);
      c.font = TYPE.ai(12, 500); c.fillStyle = col('steel', 0.7);
      c.fillText((lvl * 2 - 1).toFixed(2), x, bot + 62);
      // the AI's cursor rides the fader of the current beat
      if (Math.floor(f.beat) % FADERS.length === i) { lastX = x; lastY = y; }
    });
    if (lastX && cursorOn(t, 0.3)) { c.fillStyle = col('cobalt'); c.fillRect(lastX + 28, lastY - 18, 18, 36); }
    // the lyric (left column)
    const ws = this.l3.words;
    const w = (re: RegExp) => ws.findIndex((x) => re.test(x.w));
    wordRow(c, ws.slice(0, w(/tuning/i)), t, 132, 300, 60);
    wordRow(c, ws.slice(w(/tuning/i), w(/weights/i)), t, 132, 400, 60);
    wordRow(c, ws.slice(w(/weights/i), w(/weights/i) + 1), t, 124, 560, 150, { width: 75, weight: 900 });
    wordRow(c, ws.slice(w(/weights/i) + 1, w(/transformer/i)), t, 132, 660, 60);
    wordRow(c, ws.slice(w(/transformer/i)), t, 132, 760, 60, { color: (x) => (/transformer/i.test(x.w) ? 'cobaltText' : 'bone') });
  }

  // ---- 3: the white-out
  private clear(c: CanvasRenderingContext2D, t: number) {
    const ws = this.l4.words;
    const size = 118, fam = TYPE.humanFamily(100, 800);
    // perfectly centred, ink on bone (the one still frame in the song): THE ONLY THING THAT'S / CLEAR TO ME
    const brk = ws.findIndex((w) => /clear/i.test(w.w));
    const rows = [ws.slice(0, brk), ws.slice(brk)];
    c.font = TYPE.human(size, 100, 800);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    rows.forEach((row, ri) => {
      const total = wordRow(c, row, t, 0, 0, size, { measureOnly: true });
      let xx = (W - total) / 2;
      for (const w of row) {
        const label = w.w.toUpperCase();
        c.font = TYPE.human(size, 100, 800);
        c.fillStyle = col('ink', 0.12 + 0.88 * wordState(w, t).on);
        c.fillText(label, xx, 400 + ri * 150);
        xx += measure(label, fam, size) + size * 0.26;
      }
    });
    // IS… : "IS" on its word, then three dots, one per beat (landing with a bounce)
    const is = this.l5.words[0]!;
    const st = wordState(is, t);
    if (st.pre > 0) {
      c.font = TYPE.human(170, 100, 900);
      c.fillStyle = col('ink', 0.12 + 0.88 * st.on);
      const iw = measure('IS', TYPE.humanFamily(100, 900), 170);
      const ix = W / 2 - (iw + 3 * 60) / 2;
      c.fillText('IS', ix, 800);
      const au = this.ctx.audio;
      const b0 = Math.ceil(au.beatAt(is.start));
      for (let d = 0; d < 3; d++) {
        const bt = is.start + 0.03 + d * 0.1; void b0; // (quick: all three land before the cut)
        if (t < bt) continue;
        const s = springStep(t - bt, 3.5, 0.4);
        c.fillStyle = col('ink');
        c.beginPath(); c.arc(ix + iw + 30 + d * 60, 800 - 12 - (1 - s) * 60, 14, 0, Math.PI * 2); c.fill();
      }
    }
  }
}
