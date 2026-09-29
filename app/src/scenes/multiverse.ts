// Verse 1a, "I'm sure there's many versions, inside this multiverse / Where I didn't use the LLM to
// write the second verse" + the AI's "It's a bit derivative, don't you think?".
// A drifting wall of portals: every tile is the same man in a different art style (flat, halftone,
// engraving, pixel, blueprint, neon, paper-cut, negative, stipple, CRT, woodcut, dither), some
// mirrored. Each sung word lights a tile and is set in its own typeface on a lower-third band.
// On "derivative" every tile snaps to the same style. The AI's review comment is pinned on top.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H, makeRT, clearRT } from '../engine/gl';
import { clamp, ease, prog, springStep } from '../engine/util';
import { F, font, measure, plain } from '../engine/type';
import { strokeText, drawStrokeText } from '../engine/stroke';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordState, callout } from './_look';
import { Human, drawChair } from './_human';

const TW = 344, TH = 236, GAP = 16, COLS = 7, ROWS = 4;
const BAND_Y = 800;

const FRAG = /* glsl */ `
uniform sampler2D tFig, tChair, tLayer;
uniform vec2 cam;          // grid offset (px)
uniform float t, kick, same, actTile, pop, intro;
float maskAt(vec2 uv) {    // uv 0..1 in the figure window
  vec2 q = vec2(mix(300.0, 1330.0, uv.x), mix(100.0, 1060.0, uv.y));
  vec2 st = vec2(q.x / 1920.0, 1.0 - q.y / 1080.0);
  return max(texture(tFig, st).a, texture(tChair, st).a);
}
vec3 style(int s, vec2 uv, vec2 px, float m, float edge) {
  float cell;
  if (s == 0) return mix(C_SIGNAL, C_INK, m);                                         // flat
  if (s == 1) { vec2 g = fract(px / 9.0) - 0.5; float d = length(g); return mix(C_COBALT_DEEP, C_BONE, m * step(d, 0.36)); } // halftone
  if (s == 2) { float h = step(0.5, fract((px.x + px.y) / 7.0)); return mix(C_BONE * 0.95, C_INK, m * h + edge); }        // engraving
  if (s == 3) { vec2 b = floor(uv * vec2(24.0, 32.0)) / vec2(24.0, 32.0); float mb = maskAt(b + 0.5 / vec2(24.0, 32.0)); return mix(C_INK2, C_EMBER, step(0.5, mb)); } // pixel
  if (s == 4) { float gl = step(0.94, fract(px.x / 24.0)) + step(0.94, fract(px.y / 24.0)); return C_COBALT_DEEP * 1.4 + C_STEEL * (0.12 * gl + 0.9 * edge); } // blueprint
  if (s == 5) return C_INK + (C_SIGNAL * 2.4) * edge + C_BLOOD * 0.3 * m;              // neon
  if (s == 6) { float sh = maskAt(uv - vec2(0.012, -0.016)); vec3 c = mix(C_BONE, C_INK * 1.3, sh * 0.5 * (1.0 - m)); return mix(c, C_SIGNAL, m); } // paper cut
  if (s == 7) return mix(C_INK, C_BONE, m);                                             // negative
  if (s == 8) { float r = hash12(floor(px / 2.0)); return mix(C_BONE, C_INK, step(r, m * 0.75 + 0.02)); }                 // stipple
  if (s == 9) { float sl = 0.7 + 0.3 * step(0.5, fract(px.y / 4.0)); return (C_INK + C_COBALT * m * 1.2) * sl; }           // CRT
  if (s == 10) { float w = step(0.5, fract(px.y / 6.0 + sin(px.x / 30.0) * 0.4)); return mix(C_EMBER, C_INK, m * (0.6 + 0.4 * w)); } // woodcut
  { float b = hash12(mod(floor(px), 4.0) + 3.0); return mix(C_BLOOD, C_ember_fix, 0.0) * 0.0 + mix(C_INK2, C_SIGNAL, step(b, 1.0 - m * 0.9)); } // dither
}
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec2 g = p + cam;
  vec2 cellSize = vec2(${TW + GAP}.0, ${TH + GAP}.0);
  vec2 ci = floor(g / cellSize);
  vec2 lp = g - ci * cellSize;               // px inside the cell
  vec3 col = C_INK;
  float tileId = mod(ci.x + ci.y * 7.0 + 70.0, 28.0);
  // tiles appear one by one at the start (they were the tower's windows)
  float appear = step(hash11(tileId * 3.1) * 0.9, intro);
  if (lp.x < ${TW}.0 && lp.y < ${TH}.0 && appear > 0.5) {
    vec2 uv = lp / vec2(${TW}.0, ${TH}.0);
    // the active tile pops (scaled around its centre)
    float isAct = 1.0 - step(0.5, abs(tileId - actTile));
    uv = (uv - 0.5) / (1.0 + 0.1 * pop * isAct) + 0.5;
    bool flip = mod(tileId, 3.0) == 1.0;
    vec2 fuv = vec2(flip ? 1.0 - uv.x : uv.x, uv.y);
    float m = maskAt(fuv);
    float e = 1.4 / 1030.0;
    float mn = min(min(maskAt(fuv + vec2(e, 0.0)), maskAt(fuv - vec2(e, 0.0))), min(maskAt(fuv + vec2(0.0, e * 1.8)), maskAt(fuv - vec2(0.0, e * 1.8))));
    float edge = clamp((m - mn) * 3.0, 0.0, 1.0);
    int s = same > 0.5 ? 0 : int(mod(tileId * 5.0, 12.0));
    col = style(s, fuv, lp, m, edge);
    if (isAct > 0.5) col += C_BONE * 0.25 * pop;
    // hairline frame
    float fr = step(lp.x, 1.0) + step(${TW - 1}.0, lp.x) + step(lp.y, 1.0) + step(${TH - 1}.0, lp.y);
    col = mix(col, C_GRAPHITE, clamp(fr, 0.0, 1.0) * 0.6);
  }
  vec4 l = texture(tLayer, vUv);
  col = mix(col, l.rgb, l.a);
  fragColor = vec4(col, 1.0);
}`.replace('mix(C_BLOOD, C_ember_fix, 0.0) * 0.0 + ', '');

interface Slot { w: Word; family: string; size: number; kind: 'font' | 'stroke'; upper: boolean }

export default class Multiverse extends Scene {
  pass!: FSPass;
  layer = new Layer2D();
  chairL = new Layer2D();
  human = new Human();
  figRT = makeRT();
  l1!: Line; l2!: Line; ai!: Line;
  slots: Slot[] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('many versions');
    this.l2 = ly.get('second verse');
    this.ai = ly.get('derivative');
    // every word of line 1 in its own face
    const faces: [string, number, boolean][] = [
      [F.archivo(125, 900), 92, true], [F.serif(600, true), 110, false], [F.mono(600), 76, true], [F.archivo(62, 900), 110, true],
      ['stroke:script', 100, false], [F.archivo(100, 300), 96, true], [F.serif(400, false), 104, true], [F.archivo(125, 700), 88, true],
    ];
    this.l1.words.forEach((w, i) => {
      const [family, size, upper] = faces[i % faces.length]!;
      this.slots.push({ w, family, size, kind: family.startsWith('stroke:') ? 'stroke' : 'font', upper });
    });
    this.pass = new FSPass(FRAG, {
      tFig: { value: this.human.rt.texture }, tChair: { value: this.chairL.texture }, tLayer: { value: this.layer.texture },
      cam: { value: new THREE.Vector2() }, t: { value: 0 }, kick: { value: 0 }, same: { value: 0 }, actTile: { value: -1 }, pop: { value: 0 }, intro: { value: 0 },
    });
    // the chair, in the same frame as the figure render (origin 800,1040, 7 px/cm)
    this.chairL.clear();
    drawChair(this.chairL.ctx, 800, 1040, 7, '#ffffff');
    this.chairL.upload();
    void this.figRT;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    // the figure mask (nods on the beat, sips on the bar)
    this.human.render(renderer, 800, 1040, 7, { nod: Math.sin(f.beat * Math.PI) * 0.04, lift: 0.5 + 0.5 * Math.sin(f.bar * Math.PI) }, { ink: [1, 1, 1], rimCold: null, rimWarm: null, rimPx: 1 });
    const words = [...this.l1.words, ...this.l2.words];
    const cur = [...words].reverse().find((w) => t >= w.start);
    const activeTile = cur ? (words.indexOf(cur) * 5 + 3) % 28 : -1;
    const pop = cur ? Math.exp(-(t - cur.start) * 5) : 0;
    const derivative = this.ai.words.find((w) => /derivative/i.test(w.w))!;
    const same = t >= derivative.start ? 1 : 0;
    const u = this.pass.u;
    // camera: a slow diagonal drift, with a kick on each bar
    const drift = (t - this.ctx.start) * 38 + f.a.kick * 4;
    (u.cam!.value as THREE.Vector2).set(200 + drift, 120 + drift * 0.35);
    u.t!.value = t; u.kick!.value = f.a.kick; u.same!.value = same; u.actTile!.value = activeTile; u.pop!.value = pop;
    u.intro!.value = prog(t, this.ctx.start, this.ctx.start + 1.0);

    this.drawLayer(t);
    this.layer.upload();
    clearRT(renderer, out, [0, 0, 0]);
    this.pass.render(renderer, out);
    return { bloom: 0.5, bloomThreshold: 1.0, vignette: 0.4, grain: 0.055, zoom: 1 + f.a.kick * 0.008, flash: same ? Math.max(0, 1 - (t - derivative.start) * 6) * 0.4 : 0 };
  }

  private drawLayer(t: number) {
    const c = this.layer.ctx;
    this.layer.clear();
    // lower-third band
    c.fillStyle = col('ink');
    c.fillRect(0, BAND_Y, W, H - BAND_Y);
    c.fillStyle = col('graphite');
    c.fillRect(0, BAND_Y, W, 1.5);
    const showL2 = t >= this.l2.start - 0.35;
    if (!showL2) this.line1(c, t);
    else this.line2(c, t);
    this.review(c, t);
  }

  /** Line 1: every word in its own face, sized to one row. */
  private line1(c: CanvasRenderingContext2D, t: number) {
    const y = BAND_Y + 150;
    let x = 110;
    const widths = this.slots.map((s) => {
      const label = s.upper ? s.w.w.toUpperCase() : s.w.w;
      return s.kind === 'stroke' ? strokeText(label, 'script', s.size).width : measure(label, s.family, s.size);
    });
    const total = widths.reduce((a, b) => a + b, 0) + 30 * (widths.length - 1);
    const k = Math.min(1, (W - 220) / total);
    this.slots.forEach((s, i) => {
      const label = s.upper ? s.w.w.toUpperCase() : s.w.w;
      const a = wordAlpha(s.w, t, 0.18);
      const hit = springStep(Math.max(0, t - s.w.start), 3.2, 0.45);
      c.save();
      c.translate(x, y - (1 - hit) * 20 * wordState(s.w, t).on);
      c.scale(k, k);
      if (s.kind === 'stroke') {
        c.strokeStyle = col('ember', a);
        c.lineWidth = 6;
        c.lineCap = 'round'; c.lineJoin = 'round';
        const st = strokeText(label, 'script', s.size);
        drawStrokeText(c, st, st.total * clamp((t - s.w.start) / Math.max(0.2, s.w.end - s.w.start)) + (t < s.w.start ? 0 : 0));
      } else {
        c.font = font(s.family, s.size);
        c.fillStyle = col(i % 3 === 1 ? 'ember' : 'bone', a);
        c.textBaseline = 'alphabetic';
        c.fillText(label, 0, 0);
      }
      c.restore();
      x += (widths[i]! + 30) * k;
    });
  }

  /** Line 2: the Human's type, with "SECOND VERSE" ghost-autocompleted by the AI before it's sung. */
  private line2(c: CanvasRenderingContext2D, t: number) {
    const ws = this.l2.words;
    const size = 72, fam = TYPE.humanFamily(100, 800);
    const gi = ws.findIndex((w) => /second/i.test(w.w));
    const brk = ws.findIndex((w) => /^to$/i.test(w.w));
    let x = 110, y = BAND_Y + 100;
    ws.forEach((w, i) => {
      if (i === brk) { x = 110; y += size * 1.1; }
      const label = w.w.toUpperCase();
      const ww = measure(label, fam, size);
      const st = wordState(w, t);
      if (i >= gi && !st.sung) {
        // the AI's suggestion, typed ahead in cobalt mono
        const k = clamp((t - (this.l2.start + 0.2)) / 0.5);
        c.font = TYPE.ai(size * 0.62, 500);
        c.fillStyle = col('cobaltText', 0.55 * k);
        const g = label.slice(0, Math.floor(label.length * k));
        c.fillText(g, x, y - 6);
        if (i === ws.length - 1 && cursorOn(t) && k > 0) c.fillRect(x + measure(g, TYPE.aiFamily(500), size * 0.62) + 4, y - 46, 20, 46);
      } else {
        c.font = TYPE.human(size, 100, 800);
        c.fillStyle = col('bone', wordAlpha(w, t));
        c.fillText(label, x, y);
      }
      x += ww + size * 0.26;
    });
    c.font = TYPE.ai(15, 500);
    c.fillStyle = col('cobaltText', 0.8);
    if (t >= this.l2.start + 0.3 && t < ws[gi]!.start) c.fillText('⇥ TAB TO ACCEPT', x + 10, y - 6);
  }

  /** The AI's review comment, pinned over the grid. */
  private review(c: CanvasRenderingContext2D, t: number) {
    const a = this.ai;
    if (t < a.start - 0.1) return;
    const k = ease.outBack(clamp((t - a.start + 0.1) / 0.35));
    const bx = 1080, by = 150, bw = 700, bh = 170;
    callout(c, 900, 470, 960, 330, bx, clamp((t - a.start) / 0.3), col('cobalt', 0.9));
    c.save();
    c.translate(bx, by + (1 - k) * 30);
    c.globalAlpha = clamp(k);
    c.fillStyle = col('ink', 0.94);
    c.fillRect(0, 0, bw, bh);
    c.strokeStyle = col('cobalt');
    c.lineWidth = 2;
    c.strokeRect(1, 1, bw - 2, bh - 2);
    c.fillStyle = col('cobalt');
    c.fillRect(0, 0, 6, bh);
    c.font = TYPE.ai(15, 600);
    c.fillStyle = col('cobaltText', 0.8);
    c.fillText('AI · REVIEW COMMENT · verse-1.txt L33', 28, 36);
    c.font = TYPE.ai(34, 500);
    c.fillStyle = col('cobaltText');
    const text = plain(a.words.filter((w) => t >= w.start).map((w) => w.w).join(' '));
    const [r1, r2] = text.length > 26 ? [text.slice(0, text.indexOf(' ', 20) > 0 ? text.indexOf(' ', 20) : 26), text.slice((text.indexOf(' ', 20) > 0 ? text.indexOf(' ', 20) : 26) + 1)] : [text, ''];
    c.fillText(r1, 28, 90);
    c.fillText(r2, 28, 136);
    if (cursorOn(t)) { const tw = c.measureText(r2 || r1).width; c.fillRect(28 + tw + 6, (r2 ? 136 : 90) - 30, 18, 34); }
    c.restore();
  }
}
