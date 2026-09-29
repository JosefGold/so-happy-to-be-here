// The synth/organ interlude (+ the drum build into verse 2): the servers are the band, and every bar
// something new happens (bars counted from the scene's first downbeat):
//   bar 0  the rack organ: each rack's LED column is a level meter driven by the audio, its base
//          unit a key that presses on the hits; the AI's cursor hops rack to rack on the beat
//   bar 1  the AI plays it: a pod (cube) pops onto a rack on every beat, REPLICAS autoscale to the beat
//   bar 2  the LEDs join into one dot-matrix marquee: PROD IS FINE ✓ scrolls across all racks; the
//          cloud bill counts up with the music
//   bar 3+ the drum build: the racks overheat (LEDs to red, fans spinning up, flames on the rack
//          tops on the hits), the bill goes absurd
//   last   the racks part down the middle onto the AI's cobalt light (verse 2's corridor)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, noise1, prog, springStep } from '../engine/util';
import { TYPE, col, cursorOn } from './_look';

const N = 14, RW = 104, GAP = 16, UNITS = 22, UH = 26, BASE = 900;
const FEATS = ['bass', 'low', 'drums', 'mid', 'other', 'vocal', 'high', 'rms'];
const VX = 1250, VY = 400; // verse 2's vanishing point

// 5x7 dot-matrix font for the marquee
const GLYPHS: Record<string, string[]> = {
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'], T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'], R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'], D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'], S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'], N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'], '✓': ['00000', '00001', '00010', '10100', '01000', '00000', '00000'],
  ' ': ['000', '000', '000', '000', '000', '000', '000'], '·': ['000', '000', '000', '010', '000', '000', '000'],
};
const MARQUEE = 'PROD IS FINE ✓ · PROD IS FINE ✓ · PROD IS FINE ✓ · ';

export default class Synth extends Scene {
  layer = new Layer2D();
  laptop = 0;
  bar0 = 0;
  columns: boolean[][] = []; // marquee bitmap, column-major (7 rows)

  override init() {
    this.laptop = this.ctx.lyrics.get('My laptop is a code machine').words[0]!.start;
    this.bar0 = Math.round(this.ctx.audio.barAt(this.ctx.start));
    for (const ch of MARQUEE) {
      const g = GLYPHS[ch] ?? GLYPHS[' ']!;
      for (let x = 0; x < g[0]!.length; x++) this.columns.push(g.map((row) => row[x] === '1'));
      this.columns.push(Array(7).fill(false));
    }
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp, audio: au } = this.ctx;
    const t = f.t, c = this.layer.ctx;
    this.layer.clear(col('ink'));
    const bar = f.bar - this.bar0; // bars since the scene started (fractional)
    const phase = Math.floor(bar);
    const part = ease.inOutCubic(prog(t, this.laptop - 1.4, this.laptop - 0.1));
    const intro = ease.outCubic(prog(t, this.ctx.start, this.ctx.start + 0.8));
    const heat = clamp((bar - 3) / 0.9); // the overheat, over the drum build
    // the cobalt light behind the racks (revealed as they part)
    const g = c.createRadialGradient(VX, VY, 10, VX, VY, 700);
    g.addColorStop(0, col('cobalt', 0.9 * part + 0.06));
    g.addColorStop(0.15, col('cobalt', 0.25 * part + 0.02));
    g.addColorStop(1, col('cobalt', 0));
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
    // a warm glow from below as it overheats
    if (heat > 0) {
      const g2 = c.createLinearGradient(0, H, 0, H * 0.3);
      g2.addColorStop(0, col('blood', 0.5 * heat));
      g2.addColorStop(1, col('blood', 0));
      c.fillStyle = g2;
      c.fillRect(0, 0, W, H);
    }

    const total = N * RW + (N - 1) * GAP, x0 = (W - total) / 2;
    const top = BASE - UNITS * UH;
    const hop = Math.floor(f.beat) % N;
    const scroll = Math.floor((bar - 2) * 36); // marquee columns scrolled
    let cur = { x: 0, y: 0 };
    const rackX = (i: number) => {
      const side = i < N / 2 ? -1 : 1;
      return x0 + i * (RW + GAP) + side * part * (W * 0.62) + (1 - intro) * side * 400;
    };
    for (let i = 0; i < N; i++) {
      const x = rackX(i);
      const shake = heat > 0 ? Math.sin(t * 70 + i) * 2 * heat * f.a.kick : 0;
      c.save();
      c.translate(shake, 0);
      c.fillStyle = col('ink2');
      c.fillRect(x, top - 20, RW, UNITS * UH + 20 + 60);
      c.strokeStyle = col('graphite', 0.8);
      c.lineWidth = 1.5;
      c.strokeRect(x + 0.5, top - 19.5, RW - 1, UNITS * UH + 79);
      const env = au.env(FEATS[i % FEATS.length]!, t);
      const shape = 0.65 + 0.35 * Math.sin((i / (N - 1)) * Math.PI);
      const lvl = clamp((0.2 + 0.9 * Math.pow(env, 0.55)) * shape + 0.08 * noise1(t * 3 + i, 5) + heat * 0.3);
      const lit = Math.round(lvl * UNITS);
      for (let u = 0; u < UNITS; u++) {
        const y = BASE - (u + 1) * UH;
        // the two LED columns of this rack are columns 2i, 2i+1 of the marquee (rows 7..13 of the units)
        let a = u < lit, b = a && hash(i, u) > 0.7;
        let colA = u > UNITS * 0.8 ? 'error' : u > UNITS * 0.55 ? 'ember' : 'signal';
        if (heat > 0.4 && a) colA = 'error';
        c.fillStyle = a ? col(colA) : col('graphite', 0.3);
        c.fillRect(x + 12, y + 8, 10, 10);
        c.fillStyle = b ? col('cobaltText', 0.9) : col('graphite', 0.3);
        c.fillRect(x + 28, y + 8, 10, 10);
        c.fillStyle = col('ink', 0.8);
        c.fillRect(x + 48, y + 11, RW - 60, 4);
      }
      // a fan per rack, spinning up with the heat
      const fy = top + 8, fx = x + RW / 2;
      const spin = t * (4 + heat * 40) + i;
      c.strokeStyle = col(heat > 0.5 ? 'signal' : 'ash', 0.8);
      c.lineWidth = 2;
      c.beginPath(); c.arc(fx, fy, 12, 0, Math.PI * 2); c.stroke();
      for (let k = 0; k < 3; k++) { const a2 = spin + (k * Math.PI * 2) / 3; c.beginPath(); c.moveTo(fx, fy); c.lineTo(fx + Math.cos(a2) * 10, fy + Math.sin(a2) * 10); c.stroke(); }
      // the key presses on the hits
      const press = clamp((i < N / 2 ? f.a.kick : f.a.snare) * 1.4) * 8;
      c.fillStyle = col('bone', 0.9);
      c.fillRect(x + 4, BASE + 8 + press, RW - 8, 44 - press);
      c.restore();
      if (i === hop) cur = { x: x + RW / 2, y: top - 40 };
    }

    // bar 1+: pods pop onto the racks, one per beat (stack on the rack the cursor is on)
    const beat0 = au.beatAt(au.timeOfBeat(Math.ceil(au.beatAt(this.ctx.start))) + 0.01);
    const podsFrom = beat0 + 4, nb = f.beat - podsFrom;
    const pods = clamp(Math.floor(nb) + 1, 0, 40) * (bar >= 1 ? 1 : 0);
    const stack: number[] = Array(N).fill(0);
    for (let p = 0; p < pods; p++) {
      const rack = Math.floor(hash(p, 11) * N);
      const h = stack[rack]!++; if (h > 1) continue;
      const s = springStep(Math.max(0, (nb - p) * (60 / au.bpm)), 3.5, 0.45);
      const px = rackX(rack) + RW / 2 - 18, py = top - 64 - h * 40 - (1 - s) * 80;
      c.globalAlpha = clamp(s * 2) * (1 - part);
      c.fillStyle = col('cobalt');
      c.fillRect(px, py, 36, 36);
      c.fillStyle = col('cobaltText');
      c.fillRect(px + 4, py + 4, 28, 3);
      c.globalAlpha = 1;
    }
    // bar 3+: flames on the rack tops on the hits
    if (heat > 0) {
      for (let i = 0; i < N; i++) {
        const hot = hash(i, 21) < heat;
        if (!hot) continue;
        const x = rackX(i) + RW / 2, fl = (0.4 + 0.6 * f.a.kick) * 40 * heat;
        c.fillStyle = col('signal', 0.9);
        c.beginPath();
        c.moveTo(x - 30, top - 20);
        c.quadraticCurveTo(x - 20, top - 20 - fl, x + Math.sin(t * 9 + i) * 8, top - 20 - fl * 1.8);
        c.quadraticCurveTo(x + 20, top - 20 - fl, x + 30, top - 20);
        c.fill();
      }
    }
    // the AI's cursor hops on the beat
    const ph = f.beatPhase;
    const arc = Math.sin(Math.min(1, ph * 3) * Math.PI) * 50 * (ph < 0.33 ? 1 : 0);
    if (part < 0.9) {
      c.fillStyle = col('cobalt');
      c.fillRect(cur.x - 12, cur.y - 40 - arc - (pods ? 0 : 0), 24, 40);
    }

    // bar 2+: the LED sign above the racks, scrolling PROD IS FINE (red once it overheats)
    if (bar >= 2) {
      const pitch = 13, rows = 7, sx0 = x0, sw = total, cols = Math.floor(sw / pitch);
      const sy = 120, on = clamp((bar - 2) * 5) * (1 - part);
      c.globalAlpha = on;
      c.fillStyle = col('ink2'); c.fillRect(sx0 - 12, sy - 14, sw + 24, rows * pitch + 28);
      c.strokeStyle = col('graphite'); c.lineWidth = 1.5; c.strokeRect(sx0 - 11.5, sy - 13.5, sw + 23, rows * pitch + 27);
      for (let cx = 0; cx < cols; cx++) {
        const colBits = this.columns[(scroll + cx) % this.columns.length]!;
        for (let r = 0; r < rows; r++) {
          c.fillStyle = colBits[r] ? col(heat > 0.3 ? 'error' : 'ember') : col('graphite', 0.25);
          c.beginPath(); c.arc(sx0 + cx * pitch + pitch / 2, sy + r * pitch + pitch / 2, 4.2, 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
    }
    // one status line along the bottom (deadpan mono), growing per phase
    const replicas = Math.round(3 * Math.pow(2, clamp(nb / 1.2, 0, 8.4)));
    const bill = Math.pow(10, clamp((bar - 2) * 2.2, 0, 7.4)) - 1;
    const parts: [string, string][] = [];
    if (bar >= 1) parts.push([`REPLICAS ${replicas.toLocaleString('en-US')} (autoscaled to the beat)`, 'cobaltText']);
    if (bar >= 2) parts.push([`CLOUD BILL $${bill.toLocaleString('en-US', { maximumFractionDigits: 0 })}/hr`, heat > 0 ? 'error' : 'bone']);
    if (bar >= 3) parts.push([`CPU ${Math.round(62 + heat * 870)}°C · STATUS: ${heat > 0.6 ? 'FINE (ON FIRE)' : 'FINE'}`, 'signal']);
    c.globalAlpha = 1 - part;
    c.font = TYPE.ai(22, 600);
    c.textAlign = 'left';
    let lx = x0;
    for (const [txt, key] of parts) { c.fillStyle = col(key); c.fillText(txt, lx, 1030); lx += c.measureText(txt).width + 44; }
    if (parts.length && cursorOn(t)) { c.fillStyle = col('cobalt'); c.fillRect(lx - 34, 1008, 14, 26); }
    c.globalAlpha = 1;

    this.layer.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.layer.texture, out);
    return { bloom: 0.6, bloomThreshold: 0.9, vignette: 0.4, grain: 0.055, zoom: 1 + f.a.kick * (0.012 + heat * 0.02), shake: [heat * f.a.kick * 5, 0] as [number, number] };
  }
}
