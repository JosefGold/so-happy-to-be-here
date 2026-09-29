// The office, the hook scene: the anchor we return to on every "happy to be here".
// A silhouette plate: the Human (flat ink, rim-lit by the monitor's cobalt and the fire's amber) at
// his desk in front of a floor-to-ceiling window onto a night city. The HOOK LOCKUP
// ("I'M SO / HAPPY / TO BE HERE") is set in screen space across the frame, lightly singed by the
// fire, inverting to ink where flames rise behind it. Each visit is one timeline entry:
//   params.fire    0..5  city + lockup fire level
//   params.room    px    the room's fire height (defaults to the level's)
//   params.ai      0..1  the AI's colour (steel -> cobalt)
//   params.zoom    [a,b] slow push-in on the interior
//   params.pullOut       on the second hook line, pull back through the window to the tower outside
//   params.exterior      the whole visit is the exterior shot
//   params.freeze        hook 2: he freezes mid-sip under a spinner; cut to a close-up on line 2
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { clamp, ease, hash, mulberry32, prog, springStep } from '../engine/util';
import { measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { FIRE_GLSL, TYPE, callout, col, cursorOn, wordAlpha, wordState } from './_look';
import { Human, drawChair } from './_human';
import { LIN } from '../engine/palette';

const FLOOR = 930;
const HORIZON = 720;
const WIN = { x0: 120, x1: 1800, y0: 70, y1: 905 };
const FIRE_H = [0, 70, 140, 220, 320, 430];
const X = 1400, S = 0.92; // the figure's floor point (under the chair) and the desk's scale
const HS = 4.6; // the Human's scale, px per cm
const Q = { x: 1235, y: 560 }; // where the office window sits in the exterior shot
const S_EXT = 0.14; // the office's scale in the exterior shot

const FRAG = /* glsl */ `
uniform sampler2D tBack, tFig, tExt, tLock, tHum;
uniform float t, kick, fireH, level, zoom, flick, ext;
uniform vec2 zc;
uniform vec4 roofs[10];
${FIRE_GLSL}
vec4 tex(sampler2D s, vec2 q) { return texture(s, vec2(q.x / 1920.0, 1.0 - q.y / 1080.0)); }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.5, 0.2)); }

// the city's fires: along the horizon, and on some rooftops (level-dependent)
vec3 cityFires(vec3 col, vec2 p, float L) {
  vec4 hf = fireAt(p, ${HORIZON.toFixed(1)} + 20.0, 20.0 + 60.0 * L * L, t * 0.7, kick, 3.0);
  col = mix(col, hf.rgb * 0.85, hf.a * step(0.15, L));
  for (int i = 0; i < 10; i++) {
    vec4 r = roofs[i];
    if (r.w <= 0.0) continue;
    float span = smoothstep(r.x, r.x + 14.0, p.x) * smoothstep(r.y, r.y - 14.0, p.x);
    if (span <= 0.0) continue;
    vec4 f = fireAt(p, r.z + 4.0, r.w * span, t * 0.9, kick, float(i) * 1.7);
    col = mix(col, f.rgb * 0.9, f.a);
  }
  return col;
}

// the interior at interior-space point p (the room, the window, the figure); 'inside' swaps the
// city behind him for the lit back wall (the view from outside, looking in)
vec3 interior(vec2 p, vec2 p0, float L, float inside) {
  float yf = p.y / ${HORIZON.toFixed(1)};
  vec3 sky = mix(C_COBALT_DEEP * 0.55, C_INK2, smoothstep(0.0, 0.8, yf));
  sky += (C_BLOOD * 0.6 + C_SIGNAL * 0.25) * L * smoothstep(0.35, 1.0, yf) * flick;
  vec3 col = cityFires(sky, p, L);
  vec4 b = tex(tBack, p);
  col = mix(col, b.rgb, b.a);
  vec3 wall = C_INK2 * 1.6 + C_COBALT * 0.05 + C_BLOOD * 0.25 * L;
  col = mix(col, wall, inside);
  vec4 rf = fireAt(p, ${FLOOR.toFixed(1)} + 8.0, fireH, t, kick, 0.0);
  col = mix(col, rf.rgb, rf.a);
  if (p.y > ${FLOOR.toFixed(1)}) col = C_INK + C_BLOOD * 0.35 * L * exp(-(p.y - ${FLOOR.toFixed(1)}) / 60.0) * flick;
  vec4 g = tex(tFig, p);
  col = mix(col, g.rgb, g.a);
  vec4 h = tex(tHum, p0);
  col = mix(col, h.rgb, h.a);
  return col;
}

void main() {
  vec2 p0 = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  float L = level / 5.0;
  // camera: the interior is pushed in by 'zoom' around zc; the pull-out shrinks it into the
  // tower's window at Q while the exterior (drawn for the final framing) grows in around it
  float e = ext;
  float s = mix(1.0, ${S_EXT.toFixed(3)}, e);
  vec2 q = mix(vec2(960.0, 540.0), vec2(${Q.x.toFixed(1)}, ${Q.y.toFixed(1)}), e);
  vec2 pi = (p0 - q) / s + vec2(960.0, 540.0);
  pi = (pi - zc) / mix(zoom, 1.0, e) + zc;
  bool inRoom = pi.x >= 0.0 && pi.x <= 1920.0 && pi.y >= 0.0 && pi.y <= 1080.0;
  vec3 col;
  if (e < 0.001) col = interior(pi, p0, L, 0.0);
  else if (inRoom) col = interior(pi, p0, L, smoothstep(0.2, 0.7, e));
  else {
    vec2 pe = vec2(${Q.x.toFixed(1)}, ${Q.y.toFixed(1)}) + (p0 - q) * (${S_EXT.toFixed(3)} / s);  // exterior space
    float yf = pe.y / 1080.0;
    vec3 sky = mix(C_COBALT_DEEP * 0.7, C_INK2, smoothstep(0.0, 0.7, yf)) + (C_BLOOD * 0.5 + C_SIGNAL * 0.2) * L * smoothstep(0.4, 1.0, yf) * flick;
    col = cityFires(sky, pe - vec2(0.0, 180.0), L);
    vec4 xl = tex(tExt, pe);
    col = mix(col, xl.rgb, xl.a);
  }
  // the lockup, in screen space (it holds still while the camera moves): bone over dark, ink where
  // flames or bright light sit behind it, lightly singed from each row's foot
  vec4 lk = tex(tLock, p0);
  col = mix(col, lk.rgb, lk.a); // the lyric is always solid bone: no effects on the type
  // his silhouette cuts in front of the type (interior only; outside he is tiny in the window)
  if (inRoom && e < 0.5) { vec4 g2 = tex(tFig, pi); col = mix(col, g2.rgb, g2.a * (1.0 - e * 2.0)); vec4 h2 = tex(tHum, p0); col = mix(col, h2.rgb, h2.a * (1.0 - e * 2.0)); }
  for (int i = 0; i < 50; i++) {
    float fi = float(i);
    float life = fract(hash11(fi * 1.3) + t * (0.05 + 0.09 * hash11(fi * 3.7)));
    vec2 em = vec2(hash11(fi * 7.1) * 1920.0 + sin(t * (0.6 + hash11(fi)) + fi) * 40.0, 1000.0 - life * (fireH * 2.0 + 300.0));
    float r = 1.2 + 2.0 * hash11(fi * 9.9);
    float d = length(p0 - em);
    col += C_EMBER * 2.6 * (1.0 - life) * step(0.3, L) * smoothstep(0.0, 0.1, life) * exp(-d * d / (r * r));
  }
  fragColor = vec4(col, 1.0);
}`;

export default class Office extends Scene {
  pass!: FSPass;
  back = new Layer2D();
  fig = new Layer2D();
  ext = new Layer2D();
  lock = new Layer2D();
  human = new Human();
  mugInterior = { x: 0, y: 0 };
  fire = 0;
  ai = 0;
  hooks: Line[] = [];
  asides: Line[] = [];
  buildings: { x: number; w: number; h: number; lights: [number, number][] }[] = [];

  override init() {
    const p = this.ctx.params;
    this.fire = clamp(p.fire ?? 0, 0, 5);
    this.ai = clamp(p.ai ?? 0, 0, 1);
    const inWin = this.ctx.lyrics.linesIn(this.ctx.start - 0.2, this.ctx.end);
    this.hooks = inWin.filter((l) => l.voice === 'human' && /happy/i.test(l.text));
    this.asides = inWin.filter((l) => l.voice === 'ai');
    const rnd = mulberry32(21);
    for (let x = WIN.x0 - 40; x < WIN.x1 + 40;) {
      const w = 60 + rnd() * 130, h = 120 + rnd() * rnd() * 420;
      const lights: [number, number][] = [];
      for (let yy = HORIZON - h + 14; yy < HORIZON - 10; yy += 16) for (let lx = x + 8; lx < x + w - 8; lx += 13) if (rnd() < 0.22) lights.push([lx, yy]);
      this.buildings.push({ x, w, h, lights });
      x += w + rnd() * 12;
    }
    // rooftop fires on some of the taller buildings, more at higher levels
    const tall = this.buildings.filter((b) => b.x > 1020).sort((a, c) => c.h - a.h); // never behind the lockup
    const nRoofs = [0, 0, 1, 2, 4, 6][this.fire]!;
    const roofs: THREE.Vector4[] = [];
    for (let k = 0; k < 10; k++) {
      const b = tall[k];
      roofs.push(k < nRoofs && b ? new THREE.Vector4(b.x + 6, b.x + b.w - 6, HORIZON - b.h, 34 + hash(k, 3) * 40) : new THREE.Vector4(0, 0, 0, 0));
    }
    this.pass = new FSPass(FRAG, {
      tBack: { value: this.back.texture }, tFig: { value: this.fig.texture }, tExt: { value: this.ext.texture }, tLock: { value: this.lock.texture }, tHum: { value: this.human.rt.texture },
      t: { value: 0 }, kick: { value: 0 }, fireH: { value: 0 }, level: { value: this.fire }, zoom: { value: 1 }, flick: { value: 1 }, ext: { value: 0 },
      zc: { value: new THREE.Vector2(820, 520) }, roofs: { value: roofs },
    });
  }

  /** Pull-out progress (0 interior .. 1 exterior). */
  private extAt(t: number) {
    const p = this.ctx.params;
    if (p.exterior) return 1;
    if (!p.pullOut || this.hooks.length < 2) return 0;
    const s = this.hooks[1]!.start;
    return ease.inOutCubic(prog(t, s - 0.3, s + 1.0));
  }

  /** The last beat at/before t (cuts land on the grid). */
  private cutTime(t: number) {
    const au = this.ctx.audio;
    return au.timeOfBeat(Math.floor(au.beatAt(t + 0.02)));
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const t = f.t;
    const ext = this.extAt(t);
    const frozen = this.frozen(t);
    // camera: push-in 'zoom' around zc (interior space), then the pull-out (s, q) to the exterior
    let z = (this.ctx.params.zoom as [number, number] | undefined) ?? [1, 1.06];
    const close = !!this.ctx.params.freeze && this.hooks.length > 1 && t >= this.cutTime(this.hooks[1]!.start);
    const zc = close ? { x: 1000, y: 470 } : { x: 820, y: 520 };
    if (close) z = [1.7, 1.76];
    const zoom = z[0] + (z[1] - z[0]) * ease.inOutCubic(f.p);
    const zm = zoom + (1 - zoom) * ext;
    const sc = 1 + (S_EXT - 1) * ext;
    const q = { x: 960 + (Q.x - 960) * ext, y: 540 + (Q.y - 540) * ext };
    const toScreen = (x: number, y: number) => {
      const ix = zc.x + (x - zc.x) * zm, iy = zc.y + (y - zc.y) * zm;
      return { x: q.x + (ix - 960) * sc, y: q.y + (iy - 540) * sc };
    };
    // the Human, rendered straight in screen space (crisp at any zoom)
    const aiLin = this.ai > 0.5 ? LIN.cobalt : LIN.steel;
    const pose = frozen ? { nod: 0.05, lift: 0.85 } : { nod: Math.sin(f.beat * Math.PI) * 0.035 + f.a.kick * 0.015, lift: 0.05 + 0.06 * Math.sin(f.beat * Math.PI * 0.5) };
    const o = toScreen(X, FLOOR);
    this.human.render(this.ctx.renderer, o.x, o.y, HS * zm * sc, pose, { ink: LIN.ink, rimCold: aiLin, rimWarm: this.fire >= 2 ? LIN.ember : null, rimPx: Math.max(1, 2.6 * Math.min(1, zm * sc * 1.2)) });
    // steam wants the mug in interior space
    const m = this.human.mugTop;
    this.mugInterior = { x: zc.x + ((q.x + (m.x - q.x) / sc - 960 + 960) - zc.x) / zm, y: zc.y + ((q.y + (m.y - q.y) / sc - 540 + 540) - zc.y) / zm };
    this.drawBack(t);
    this.drawFigure(t, f);
    if (ext > 0) { this.drawExterior(); this.ext.upload(); }
    this.drawLockup(t);
    this.back.upload(); this.fig.upload(); this.lock.upload();
    const u = this.pass.u;
    (u.zc!.value as THREE.Vector2).set(zc.x, zc.y);
    const room = (this.ctx.params.room as number | undefined) ?? FIRE_H[this.fire]!;
    u.t!.value = t;
    u.kick!.value = f.a.kick;
    u.fireH!.value = room * (1 + 0.04 * Math.sin(t * 2.3));
    u.zoom!.value = zoom;
    u.flick!.value = 0.85 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.25 * f.a.kick;
    u.ext!.value = ext;
    this.pass.render(this.ctx.renderer, out);
    return { bloom: 0.55, bloomThreshold: 1.1, halation: 0.06, vignette: 0.42, grain: 0.055 };
  }

  // ------------------------------------------------------------------ skyline, window, wall (interior space)
  private drawBack(t: number) {
    const c = this.back.ctx;
    this.back.clear();
    c.fillStyle = col('ink2');
    for (const b of this.buildings) c.fillRect(b.x, HORIZON - b.h, b.w, b.h + 400);
    const outage = this.fire / 5;
    for (const [bi, b] of this.buildings.entries()) for (const [k, [lx, ly]] of b.lights.entries()) {
      const hsh = hash(bi, k);
      if (hsh < outage * 0.5) continue;
      const on = hsh > 0.93 ? (Math.sin(t * 9 + k) > 0 ? 1 : 0.3) : 1;
      c.fillStyle = col(hsh > 0.96 ? 'cobaltText' : 'ember', 0.5 * on);
      c.fillRect(lx, ly, 6, 8);
    }
    c.fillStyle = col('ink');
    c.fillRect(0, 0, W, WIN.y0);
    c.fillRect(0, 0, WIN.x0, 1080);
    c.fillRect(WIN.x1, 0, W - WIN.x1, 1080);
    c.fillRect(0, WIN.y1, W, 1080 - WIN.y1);
    c.fillStyle = col('ink2');
    c.fillRect(WIN.x0 - 20, WIN.y1, WIN.x1 - WIN.x0 + 40, 14);
    for (const mx of [0.25, 0.5, 0.75]) c.fillRect(WIN.x0 + (WIN.x1 - WIN.x0) * mx - 6, WIN.y0, 12, WIN.y1 - WIN.y0);
    c.fillRect(WIN.x0, WIN.y0 + (WIN.y1 - WIN.y0) * 0.42 - 5, WIN.x1 - WIN.x0, 10);
  }

  // ------------------------------------------------------------------ the tower, seen from outside (exterior space)
  private drawExterior() {
    const c = this.ext.ctx;
    this.ext.clear();
    const ww = W * S_EXT, wh = H * S_EXT;
    const ox = Q.x - ww / 2, oy = Q.y - wh / 2;
    const tx0 = ox - ww * 1.5, tx1 = ox + ww * 2.5;
    // the distant city, the same skyline as through the window, 180 px lower (horizon at 900)
    c.fillStyle = col('ink2');
    for (const b of this.buildings) c.fillRect(b.x, HORIZON + 180 - b.h, b.w, b.h + 400);
    const outage = this.fire / 5;
    for (const [bi, b] of this.buildings.entries()) for (const [k, [lx, ly]] of b.lights.entries()) {
      const hsh = hash(bi, k);
      if (hsh < outage * 0.5) continue;
      c.fillStyle = col(hsh > 0.96 ? 'cobaltText' : 'ember', 0.45);
      c.fillRect(lx, ly + 180, 6, 8);
    }
    const fh = wh * 1.08, bw = ww / 2;
    c.fillStyle = col('ink');
    c.fillRect(tx0 - 6, -40, tx1 - tx0 + 12, 1200);
    const rnd = mulberry32(5);
    for (let fy = oy - fh * 9; fy < 1100; fy += fh) {
      for (let fx = tx0; fx < tx1 - 1; fx += bw) {
        const isOffice = Math.abs(fy - oy) < 1 && fx >= ox - 1 && fx < ox + ww - 1;
        const r = rnd();
        if (isOffice) continue;
        const lit = r > 0.84 ? 'ember' : r > 0.8 ? 'cobaltText' : null;
        c.fillStyle = lit ? col(lit, 0.26) : col('ink2', 0.95);
        c.fillRect(fx + 3, fy + 5, bw - 6, fh - 10);
        if (this.fire >= 3 && r < 0.035 * this.fire) { c.fillStyle = col('signal', 0.55); c.fillRect(fx + 3, fy + fh * 0.55, bw - 6, fh * 0.45 - 5); }
      }
    }
    c.clearRect(ox, oy, ww, wh); // the office: the shader shows the room here
    c.fillStyle = col('graphite', 0.55);
    for (let fx = tx0; fx <= tx1 + 1; fx += bw) c.fillRect(fx - 1, -40, 2, 1200);
  }

  // ------------------------------------------------------------------ the hook lockup (screen space)
  private current(t: number): { line: Line; prev: Line | null } | null {
    if (!this.hooks.length) return null;
    let i = 0;
    for (let k = 0; k < this.hooks.length; k++) if (this.hooks[k]!.start - 0.4 <= t) i = k;
    return { line: this.hooks[i]!, prev: i > 0 ? this.hooks[i - 1]! : null };
  }

  private drawLockup(t: number) {
    const c = this.lock.ctx;
    this.lock.clear();
    const cur = this.current(t);
    if (!cur) return;
    const { line, prev } = cur;
    const find = (re: RegExp, l: Line = line) => l.words.find((w) => re.test(w.w));
    const im = find(/^i[’']m$/i), mid = find(/^(so|just)$/i), happy = find(/^happy/i);
    const to = find(/^to$/i), be = find(/^be$/i), here = find(/^here/i);
    const x0 = 150;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    const keep = (w: Word | undefined) => {
      if (!w || !prev) return 0;
      const key = w.w.toLowerCase().replace(/[^a-z]/g, '');
      const pw = prev.words.find((x) => x.w.toLowerCase().replace(/[^a-z]/g, '') === key);
      return pw && t >= pw.start ? 1 : 0;
    };
    const put = (w: Word | undefined, label: string, xx: number, y: number, size: number, width: number, weight: number, a = w ? Math.max(wordAlpha(w, t, 0.22), keep(w)) : 1) => {
      c.font = TYPE.human(size, width, weight);
      c.fillStyle = col('bone', a);
      c.fillText(label, xx, y);
      return measure(label, TYPE.humanFamily(width, weight), size);
    };
    const r1 = 96, y1 = 250, fam1 = TYPE.humanFamily(100, 800);
    let x = x0;
    x += put(im, 'I’M', x, y1, r1, 100, 800) + r1 * 0.28;
    const prevMid = prev ? prev.words.find((w) => /^(so|just)$/i.test(w.w)) : undefined;
    if (mid && prevMid && prevMid.w.toLowerCase() !== mid.w.toLowerCase()) {
      const k = prog(t, mid.start - 0.05, mid.start + 0.12);
      const ow = measure(prevMid.w.toUpperCase(), fam1, r1);
      c.font = TYPE.human(r1, 100, 800);
      c.fillStyle = col('bone', 1 - 0.7 * k);
      c.fillText(prevMid.w.toUpperCase(), x, y1);
      c.fillStyle = col('bone', 0.9);
      c.fillRect(x - 6, y1 - r1 * 0.34, (ow + 12) * k, 7);
      if (t >= mid.start - 0.02) {
        const drop = springStep(t - mid.start + 0.02, 3, 0.5);
        put(mid, mid.w.toUpperCase(), x + ow * 0.1, y1 - r1 * 0.95 - (1 - drop) * 30, r1 * 0.8, 100, 800, wordState(mid, t).on);
        c.font = TYPE.human(r1 * 0.9, 100, 500);
        c.fillStyle = col('bone', wordState(mid, t).on * 0.9);
      }
    } else if (mid) {
      put(mid, mid.w.toUpperCase(), x, y1, r1, 100, 800);
    }
    if (happy) put(happy, 'HAPPY', x0 - 14, 560, 330, 125, 900);
    x = x0;
    const r3 = 118;
    for (const [w, label] of [[to, 'TO'], [be, 'BE'], [here, 'HERE']] as const) {
      if (!w) continue;
      x += put(w, label, x, 700, r3, 100, 800) + r3 * 0.28;
    }
  }

  // ------------------------------------------------------------------ figure, desk, the AI (interior space)
  private drawFigure(t: number, f: Frame) {
    const c = this.fig.ctx;
    this.fig.clear();
    const aiCol = this.ai > 0.5 ? 'cobalt' : 'steel';
    // the monitor's light: the AI's cold glow reaching across to his face
    const mx = X - 542 * S, my = FLOOR - 515 * S;
    const g = c.createRadialGradient(mx, my, 10, mx + 150, my + 20, 420);
    g.addColorStop(0, col(aiCol, 0.16 + 0.12 * this.ai));
    g.addColorStop(1, col(aiCol, 0));
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(mx, my - 90); c.lineTo(mx + 520, my - 230); c.lineTo(mx + 520, my + 260); c.lineTo(mx, my + 90);
    c.fill();
    // desk and monitor (side on, facing him)
    c.save();
    c.translate(X, FLOOR);
    c.scale(S, S);
    c.fillStyle = col('ink');
    c.fillRect(-620, -338, 440, 16);
    c.fillRect(-552, -322, 14, 322);
    c.fillRect(-214, -322, 14, 322);
    c.fillRect(-552, -130, 352, 8);
    c.fillRect(-586, -348, 80, 10);
    c.fillRect(-554, -452, 12, 104);
    c.save();
    c.translate(-548, -520);
    c.rotate(-0.08);
    c.beginPath(); c.roundRect(-11, -95, 22, 190, 6); c.fill();
    c.restore();
    c.restore();
    drawChair(c, X, FLOOR, HS, col('ink'));
    const frozen = this.frozen(t);
    if (!frozen) this.steam(c, this.mugInterior.x, this.mugInterior.y, t);
    else this.spinner(c, t);
    for (const a of this.asides) this.aside(c, t, a);
    void f;
  }

  private frozen(t: number) {
    if (!this.ctx.params.freeze || this.hooks.length < 2) return false;
    return t >= this.hooks[this.hooks.length - 1]!.start + 0.6;
  }

  private steam(c: CanvasRenderingContext2D, x0: number, y0: number, t: number) {
    c.save();
    c.lineWidth = 1.6;
    c.strokeStyle = col('bone', 0.4);
    for (let k = 0; k < 2; k++) {
      c.beginPath();
      for (let s = 0; s <= 30; s++) {
        const u = s / 30;
        const x = x0 - 8 + k * 14 + Math.sin(u * 7 + t * 2.4 + k * 2) * 9 * u;
        const y = y0 - 6 - u * 100;
        if (s === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();
  }

  private spinner(c: CanvasRenderingContext2D, t: number) {
    const hx = X - 6 * HS, hy = FLOOR - 150 * HS;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const k = (((i - Math.floor(t * 14)) % 12) + 12) % 12 / 12;
      c.fillStyle = col('cobaltText', 0.15 + 0.85 * k);
      c.beginPath(); c.arc(hx + Math.cos(a) * 30, hy + Math.sin(a) * 30, 4.5, 0, Math.PI * 2); c.fill();
    }
  }

  /** An AI aside from the monitor: a hairline callout, the words typed as they are sung. */
  private aside(c: CanvasRenderingContext2D, t: number, a: Line) {
    if (t < a.start - 0.1) return;
    const colT = this.ai > 0.5 ? 'cobaltText' : 'steel';
    const colL = this.ai > 0.5 ? 'cobalt' : 'steel';
    const mx = X - 542 * S, my = FLOOR - 612 * S;
    const size = 30, fam = TYPE.aiFamily(400);
    const lx = mx + 220, maxW = W - lx - 90;
    const rows = this.rowsOf(a, maxW, size);
    const lbl = callout(c, mx, my, mx + 130, 150 + rows * size * 1.35, lx, prog(t, a.start - 0.1, a.start + 0.3), col(colL, 0.9));
    c.font = TYPE.ai(size, 400);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    let x = lbl.x, y = lbl.y - 18 - size * 1.35 * (rows - 1);
    let head = { x, y };
    for (const w of a.words) {
      const ww = measure(w.w, fam, size);
      if (x + ww > lbl.x + maxW) { x = lbl.x; y += size * 1.35; }
      if (t >= w.start) {
        c.fillStyle = col(colT, 0.95);
        c.fillText(w.w, x, y);
        head = { x: x + ww, y };
      }
      x += ww + measure(' ', fam, size);
    }
    if (t < a.end + 1.2 && cursorOn(t)) {
      c.fillStyle = col(colL);
      c.fillRect(head.x + 5, head.y - size * 0.8, size * 0.55, size * 0.95);
    }
  }

  private rowsOf(a: Line, maxW: number, size: number) {
    const fam = TYPE.aiFamily(400);
    let x = 0, rows = 1;
    for (const w of a.words) { const ww = measure(w.w, fam, size); if (x + ww > maxW) { rows++; x = 0; } x += ww + measure(' ', fam, size); }
    return rows;
  }
}
