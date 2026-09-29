// Verse 2, "My laptop is a code machine / Traveling through Jira tickets at sixty million tokens
// per hour": a dark plate. A corridor of Jira tickets drawn in hairlines rushes past;
// at its end the AI's cold light, and the laptop in silhouette against it. The karaoke is the joke:
// the AI wrote this verse, so every line is already there as steel ghost mono, typed ahead with a
// cursor, and each word becomes the Human's type as he sings it. A throughput readout counts to 60M.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { clamp, ease, fract, hash, prog } from '../engine/util';
import { measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordState } from './_look';

const VX = 1250, VY = 400; // vanishing point (right of centre: the text owns the left)
const N = 90;
const FAM = TYPE.humanFamily(100, 800);

interface Slot { x: number; y: number; w: number; size: number; word: Word }

const FRAG = /* glsl */ `
uniform sampler2D tLayer;
uniform float warp, flash;
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  // ink ground with the AI's cold light at the end of the corridor
  float d = length((p - vec2(${VX.toFixed(1)}, ${VY.toFixed(1)})) * vec2(1.0, 1.4));
  vec3 col = C_INK + C_COBALT * (1.4 * exp(-d / 70.0) + 0.035 * exp(-d / 380.0)) * (1.0 + warp * 0.6) + C_COBALT * flash * 0.35;
  vec4 l = texture(tLayer, vUv);
  col = mix(col, l.rgb, l.a);
  fragColor = vec4(col, 1.0);
}`;

export default class Verse2 extends Scene {
  layer = new Layer2D();
  pass!: FSPass;
  lines: Line[] = [];
  slots: Slot[][] = [];

  override init() {
    const ly = this.ctx.lyrics;
    this.lines = [ly.get('My laptop is a code machine'), ly.get('Traveling through Jira tickets')];
    // Swiss block, bottom left: line 1 on one row, line 2 broken after "tickets"
    const rows: { words: Word[]; y: number; size: number }[] = [
      { words: this.lines[0]!.words, y: 690, size: 84 },
      { words: this.lines[1]!.words.slice(0, 4), y: 800, size: 84 },
      { words: this.lines[1]!.words.slice(4), y: 902, size: 84 },
    ];
    const byLine: Slot[][] = [[], []];
    rows.forEach((r, ri) => {
      let x = 132;
      for (const w of r.words) {
        const ww = measure(w.w, FAM, r.size);
        byLine[ri === 0 ? 0 : 1]!.push({ x, y: r.y, w: ww, size: r.size, word: w });
        x += ww + r.size * 0.26;
      }
    });
    this.slots = byLine;
    this.pass = new FSPass(FRAG, { tLayer: { value: this.layer.texture }, warp: { value: 0 }, flash: { value: 0 } });
  }

  private warpStart() { return this.lines[1]!.words[0]!.start; }
  /** Corridor travel: cruising, then warp from "Traveling". */
  private dist(t: number) { return t * 0.3 + 0.5 * Math.max(0, t - this.warpStart()) ** 1.6; }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t, c = this.layer.ctx;
    this.layer.clear();
    const warp = prog(t, this.warpStart(), this.warpStart() + 1.2, ease.outCubic);

    // ---- the corridor of tickets (hairline cards on four walls, fogging into the light); it banks on the bar
    const bank = Math.sin(f.bar * Math.PI) * 0.035 * (0.4 + warp);
    c.save();
    c.translate(VX, VY); c.rotate(bank); c.translate(-VX, -VY);
    const D = this.dist(t);
    const cards = Array.from({ length: N }, (_, i) => ({ i, z: fract(hash(i, 3) - D * 0.16) })).sort((a, b) => a.z - b.z);
    for (const { i, z } of cards) {
      const k = 0.03 + z * z * 2.6;
      const wall = i % 4, u = hash(i, 5) - 0.5;
      const dx = wall < 2 ? (wall === 0 ? -1 : 1) * 760 : u * 1700;
      const dy = wall >= 2 ? (wall === 2 ? -1 : 1) * 460 : u * 900;
      const x = VX + dx * k, y = VY + dy * k;
      const cw = 190 * k, ch = 110 * k;
      // dim, and nearly gone where they would cross the type (the left block and the readout)
      const inText = (x < 1420 && y > 600) || (x < 700 && y < 340);
      const a = clamp(z * 3) * 0.6 * (inText ? 0.18 : 1);
      c.save();
      c.translate(x, y);
      c.strokeStyle = col('bone', a * 0.55);
      c.lineWidth = Math.max(0.6, 1.4 * k);
      // at warp, cards smear toward the vanishing point
      const sm = warp * 60 * k;
      c.strokeRect(-cw / 2, -ch / 2, cw, ch);
      if (sm > 1) {
        const ux = (VX - x), uy = (VY - y), L = Math.hypot(ux, uy) || 1;
        c.strokeStyle = col('bone', a * 0.25);
        c.beginPath(); c.moveTo(0, 0); c.lineTo((ux / L) * sm * 4, (uy / L) * sm * 4); c.stroke();
      }
      if (k > 0.3) {
        c.fillStyle = col('bone', a * 0.8);
        c.font = TYPE.ai(13 * k, 500);
        c.textBaseline = 'top';
        c.fillText(`JIRA-${1000 + Math.floor(hash(i, 11) * 8999)}`, -cw / 2 + 12 * k, -ch / 2 + 10 * k);
        c.fillStyle = col('bone', a * 0.25);
        c.fillRect(-cw / 2 + 12 * k, -ch / 2 + 38 * k, cw * 0.6, 1.2 * k);
        c.fillRect(-cw / 2 + 12 * k, -ch / 2 + 54 * k, cw * 0.4, 1.2 * k);
        if (hash(i, 13) < 0.2) { // a few are on fire
          c.fillStyle = col('signal', a);
          c.fillText('P0 · BLOCKER', -cw / 2 + 12 * k, ch / 2 - 26 * k);
        } else if (hash(i, 17) < 0.45 && z > 0.55) { // the AI closes tickets as they fly past
          c.save();
          c.rotate(-0.18);
          c.strokeStyle = col('cobalt', a);
          c.lineWidth = 2.5 * k;
          c.strokeRect(-34 * k, -12 * k, 92 * k, 30 * k);
          c.fillStyle = col('cobalt', a);
          c.font = TYPE.ai(17 * k, 700);
          c.fillText('DONE ✓', -26 * k, -6 * k);
          c.restore();
        }
      }
      c.restore();
    }

    // ---- the laptop's exhaust at warp: it is burning tokens (sparks streaming back toward camera)
    if (warp > 0) {
      for (let i = 0; i < 70; i++) {
        const life = fract(hash(i, 31) + t * (0.9 + hash(i, 32)));
        const ang = (hash(i, 33) - 0.5) * 1.1 + Math.PI / 2;
        const r0 = 30 + life * life * 900;
        const x = VX + Math.cos(ang) * r0 * 0.9, y = VY + 70 + Math.sin(ang) * r0 * 0.5;
        c.fillStyle = col(life < 0.3 ? 'ember' : 'signal', warp * (1 - life) * 0.9);
        c.fillRect(x, y, 2 + life * 5, 2 + life * 5);
      }
    }
    // ---- the laptop, in silhouette against the light, riding the corridor
    const bob = f.a.kick * 4 + Math.sin(t * 38) * 2 * warp;
    c.save();
    c.translate(VX, VY + 60 + bob);
    c.scale(1.7, 1.7);
    c.fillStyle = col('ink');
    c.beginPath(); // base, in perspective
    c.moveTo(-80, 0); c.lineTo(80, 0); c.lineTo(66, -14); c.lineTo(-66, -14); c.closePath(); c.fill();
    c.beginPath(); // lid, back view, tilted away
    c.moveTo(-64, -14); c.lineTo(-56, -96); c.lineTo(56, -96); c.lineTo(64, -14); c.closePath(); c.fill();
    c.strokeStyle = col('cobalt', 1); // the screen's light leaking round the lid edge
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-64, -14); c.lineTo(-56, -96); c.lineTo(56, -96); c.lineTo(64, -14); c.stroke();
    c.restore();

    c.restore();

    // ---- throughput readout (top left, Swiss)
    const sixty = this.lines[1]!.words.find((w) => /sixty/i.test(w.w))!;
    const hour = this.lines[1]!.words[this.lines[1]!.words.length - 1]!;
    const v = 400_000 * prog(t, this.lines[0]!.start, sixty.start) + (60_000_000 - 400_000) * prog(t, sixty.start, hour.end, ease.outExpo);
    c.font = TYPE.ai(15, 500);
    c.fillStyle = col('steel', 0.8);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    c.fillText('THROUGHPUT', 132, 150);
    c.font = TYPE.human(112, 62, 800);
    c.fillStyle = col(v > 55_000_000 ? 'signal' : 'bone', 0.95);
    c.fillText(Math.round(v).toLocaleString('en-US'), 126, 262);
    c.font = TYPE.ai(15, 500);
    c.fillStyle = col('steel', 0.8);
    c.fillText('TOKENS / HOUR', 132, 292);
    c.fillStyle = col('graphite');
    c.fillRect(132, 306, 420, 1.5);
    c.fillStyle = col(v > 55_000_000 ? 'signal' : 'bone');
    c.fillRect(132, 302, 420 * clamp(v / 60_000_000), 5);

    // ---- ghost-text karaoke
    this.slots.forEach((ss, li) => this.karaoke(c, this.lines[li]!, ss, t, li));

    this.layer.upload();
    this.pass.u.warp!.value = warp;
    const hit = Math.max(0, 1 - Math.abs(t - this.warpStart()) / 0.25);
    this.pass.u.flash!.value = hit;
    this.pass.render(this.ctx.renderer, out);
    return { bloom: 0.55, bloomThreshold: 0.95, vignette: 0.42, grain: 0.055, halation: 0.1, zoom: 1 + hit * 0.03 + f.a.kick * 0.006 };
  }

  /**
   * One line: the AI's ghost text is typed ahead into the word slots (steel mono, dim, with a
   * cursor at its head); each word, when sung, snaps into the Human's type (bone Archivo).
   */
  private karaoke(c: CanvasRenderingContext2D, line: Line, ss: Slot[], t: number, li: number) {
    const typeStart = li === 0 ? -1 : this.lines[0]!.start + 0.2;
    const typeEnd = line.start - 0.4;
    const total = ss.reduce((n, s) => n + s.word.w.length + 1, 0);
    const typed = li === 0 ? total : Math.floor(total * prog(t, typeStart, typeEnd));
    let chars = 0;
    let head: { x: number; y: number; s: number } | null = null;
    for (const s of ss) {
      const w = s.word, st = wordState(w, t);
      const n = clamp(typed - chars, 0, w.w.length);
      chars += w.w.length + 1;
      const ghostA = 1 - st.on;
      if (n > 0 && ghostA > 0) {
        const gs = s.size * 0.46; // one ghost size per line: the AI types evenly
        c.font = TYPE.ai(gs, 400);
        c.fillStyle = col('cobaltText', 0.5 * ghostA);
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        const part = w.w.slice(0, n);
        c.fillText(part, s.x, s.y);
        head = { x: s.x + measure(part, TYPE.aiFamily(400), gs), y: s.y, s: gs };
      }
      if (st.on > 0) {
        c.font = TYPE.human(s.size, 100, 800);
        c.fillStyle = col('bone', st.on);
        c.textAlign = 'left';
        c.textBaseline = 'alphabetic';
        c.fillText(w.w, s.x, s.y);
      }
    }
    if (head && t < line.start && (typed < total || cursorOn(t))) {
      c.fillStyle = col('cobalt', 1);
      c.fillRect(head.x + 4, head.y - head.s * 0.8, head.s * 0.55, head.s * 0.95);
    }
    void W; void H;
  }
}
