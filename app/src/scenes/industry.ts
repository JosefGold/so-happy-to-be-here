// Intro chorus line 1, "Still I know the industry's on fire": the burning city turns into data.
// The skyline's buildings become the bars of a chart (hairline axes draw in, the windows go out,
// the bars re-sort into an exponential "industry index"), a line joins the rooftops, and on "fire"
// the rooftops catch: posterized fire rides the top of every bar. The camera drifts in toward the
// tallest bar, which hands off to the Jenga tower.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { clamp, ease, hash, mulberry32, prog } from '../engine/util';
import type { Line } from '../engine/lyrics';
import { FIRE_GLSL, TYPE, col, wordRow, wordState } from './_look';

const N = 24;
const X0 = 520, X1 = 1840, GROUND = 930;

const FRAG = /* glsl */ `
uniform sampler2D tLayer, tTops;
uniform float t, kick, fireH, glow;
${FIRE_GLSL}
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  float yf = p.y / 1080.0;
  vec3 col = mix(C_COBALT_DEEP * 0.5, C_INK2, smoothstep(0.0, 0.75, yf)) + (C_BLOOD * 0.55 + C_SIGNAL * 0.2) * glow * smoothstep(0.3, 1.0, yf);
  vec4 l = texture(tLayer, vUv);
  col = mix(col, l.rgb, l.a);
  // fire along the bar tops (the height texture holds each column's rooftop y / 1080)
  vec2 tt = texture(tTops, vec2(vUv.x, 0.5)).rg;
  float top = tt.r * 1080.0;
  if (top > 0.0 && fireH > 1.0) {
    float shape = pow(sin(3.14159 * clamp(tt.g, 0.0, 1.0)), 0.8);   // a tongue per bar, tallest mid-bar
    vec4 f = fireAt(p, top + 2.0, fireH * (0.35 + 0.65 * shape), t, kick, 5.0);
    col = mix(col, f.rgb, f.a * step(p.y, top + 2.0));
  }
  fragColor = vec4(col, 1.0);
}`;

export default class Industry extends Scene {
  layer = new Layer2D();
  pass!: FSPass;
  tops = new Float32Array(1920 * 2);
  topsTex!: THREE.DataTexture;
  line!: Line;
  bldg: { h: number; w: number; lights: [number, number][] }[] = [];
  data: number[] = [];
  heat = 0;

  override init() {
    this.line = this.ctx.lyrics.get('Still I know the industry', this.ctx.params.nth ?? 0);
    this.heat = this.ctx.params.heat ?? 0;
    const rnd = mulberry32(8);
    const bw = (X1 - X0) / N;
    for (let i = 0; i < N; i++) {
      const h = 120 + rnd() * rnd() * 420;
      const lights: [number, number][] = [];
      for (let y = 14; y < h - 10; y += 16) for (let x = 8; x < bw - 14; x += 13) if (rnd() < 0.25) lights.push([x, y]);
      this.bldg.push({ h, w: bw - 10, lights });
      // the index: exponential with a little noise (a hockey stick)
      this.data.push(60 + 640 * Math.pow(i / (N - 1), 2.6) + (rnd() - 0.5) * 40);
    }
    this.topsTex = new THREE.DataTexture(this.tops, 1920, 1, THREE.RGFormat, THREE.FloatType);
    this.topsTex.minFilter = this.topsTex.magFilter = THREE.LinearFilter;
    this.pass = new FSPass(FRAG, { tLayer: { value: this.layer.texture }, tTops: { value: this.topsTex }, t: { value: 0 }, kick: { value: 0 }, fireH: { value: 0 }, glow: { value: 0 } });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t, c = this.layer.ctx;
    const ws = this.line.words;
    const w = (re: RegExp) => ws.find((x) => re.test(x.w))!;
    const industry = w(/industry/i), fire = w(/fire/i);
    const morph = ease.inOutCubic(prog(t, industry.start - 0.6, industry.start + 0.9));
    const burn = prog(t, fire.start - 0.05, fire.start + 0.5, ease.outCubic);
    // camera: slow push toward the tallest (last) bar in the last second
    const push = ease.inCubic(prog(t, this.ctx.end - 1.1, this.ctx.end));
    const zoom = 1 + push * 1.6;
    const zc = { x: X1 - 30, y: GROUND - 520 };
    const T = (x: number, y: number) => ({ x: zc.x + (x - zc.x) * zoom, y: zc.y + (y - zc.y) * zoom });

    this.layer.clear();
    const bw = (X1 - X0) / N;
    this.tops.fill(0);
    // the skyline to the left of the chart stays a city (it's where we came from)
    const rnd = mulberry32(3);
    c.fillStyle = col('ink2');
    for (let x = -20; x < X0 - 20;) {
      const ww = 60 + rnd() * 120, hh = 140 + rnd() * rnd() * 380;
      const a = T(x, GROUND - hh), b = T(x + ww, GROUND + 200);
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      x += ww + 8;
    }
    // bars: building heights -> data, staggered left to right, landing on the beat
    const pts: { x: number; y: number }[] = [];
    for (let i = 0; i < N; i++) {
      const k = clamp(morph * 1.6 - (i / N) * 0.6);
      const e = ease.outBack(k);
      const b = this.bldg[i]!;
      const hh = b.h + (this.data[i]! - b.h) * e;
      const x = X0 + i * bw;
      const a = T(x, GROUND - hh), z = T(x + b.w, GROUND);
      c.fillStyle = col('ink2');
      c.fillRect(a.x, a.y, z.x - a.x, z.y - a.y + 400);
      // windows go out as it becomes a chart
      if (k < 1) for (const [lx, ly] of b.lights) {
        if (hash(i, lx * 7 + ly) < k) continue;
        const p = T(x + lx, GROUND - b.h + ly);
        c.fillStyle = col('ember', 0.5 * (1 - k));
        c.fillRect(p.x, p.y, 6 * zoom, 8 * zoom);
      }
      // a thin bone cap on each bar once it's data
      if (k > 0.5) { c.fillStyle = col('bone', 0.85 * (k - 0.5) * 2); c.fillRect(a.x, a.y - 2, z.x - a.x, 3); }
      pts.push({ x: (a.x + z.x) / 2, y: a.y });
      for (let px = Math.max(0, Math.floor(a.x)); px < Math.min(1920, Math.ceil(z.x)); px++) { this.tops[px * 2] = a.y / 1080; this.tops[px * 2 + 1] = (px - a.x) / Math.max(1, z.x - a.x); }
    }
    // baseline hairline, bar ticks and a deadpan mono readout (right, clear of the type)
    const ax = T(X0 - 30, GROUND);
    c.strokeStyle = col('steel', 0.7 * morph);
    c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(ax.x, ax.y); c.lineTo(ax.x + (T(X1 + 10, 0).x - ax.x) * morph, ax.y); c.stroke();
    c.font = TYPE.ai(14, 500);
    c.fillStyle = col('steel', 0.8 * morph);
    c.textAlign = 'left';
    const lbl = T(X1 - 360, 96);
    c.fillText('INDUSTRY INDEX · YTD', lbl.x, lbl.y);
    c.fillStyle = col('signal', 0.9 * burn);
    c.fillText(this.heat ? '▲ +9,001%  STATUS: STILL ON FIRE' : '▲ +4,200%  STATUS: ON FIRE', lbl.x, lbl.y + 22);
    const yl = T(X1 - 160, GROUND + 38);
    c.fillStyle = col('steel', 0.7 * morph);
    c.fillText('SOURCE: VIBES', yl.x, yl.y);
    // the index line through the rooftops (amber once it's burning)
    if (morph > 0.3) {
      c.strokeStyle = col(burn > 0 ? 'signal' : 'bone', clamp((morph - 0.3) * 2) * 0.9);
      c.lineWidth = 3;
      c.lineJoin = 'round';
      c.beginPath();
      pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y - 14) : c.moveTo(p.x, p.y - 14)));
      c.stroke();
      const last = pts[pts.length - 1]!;
      c.fillStyle = col(burn > 0 ? 'ember' : 'bone');
      c.beginPath(); c.arc(last.x, last.y - 14, 7, 0, Math.PI * 2); c.fill();
    }
    // the lyric (top left, Swiss): STILL I KNOW / THE INDUSTRY'S / ON FIRE
    const a1 = 1 - push;
    c.globalAlpha = a1;
    wordRow(c, ws.slice(0, 3), t, 132, 250, 64);
    wordRow(c, ws.slice(3, 5), t, 126, 430, 160, { width: 75, weight: 900, gap: 0.2 });
    wordRow(c, ws.slice(5), t, 126, 600, 160, { width: 75, weight: 900, gap: 0.2, color: (x) => (/fire/i.test(x.w) ? 'signal' : 'bone') });
    c.globalAlpha = 1;

    this.layer.upload();
    this.topsTex.needsUpdate = true;
    const u = this.pass.u;
    u.t!.value = t; u.kick!.value = f.a.kick;
    u.fireH!.value = burn * (60 + 25 * f.a.kick) * (1 + this.heat * 0.9) * zoom;
    u.glow!.value = 0.3 + burn * (0.7 + this.heat * 0.4);
    this.pass.render(this.ctx.renderer, out);
    void wordState; void W; void H;
    return { bloom: 0.55, bloomThreshold: 1.05, vignette: 0.42, grain: 0.055, zoom: 1 + f.a.kick * 0.006 };
  }
}
