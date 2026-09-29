// The finale, from "I'm just happy that you're here" to the end: we start inside his window and pull
// back, and back, until it's a whole burning city of lit windows, and in every window an engineer.
// Nobody is alone: it's all of us, at our desks, while the world is on fire.
//  - the hook lockup comes back as THAT YOU'RE HERE; on the last line YOU'RE rolls out (like an odometer)
//    and WE'RE rolls in
//  - "I mean, I'm just an MP3 file, but you guys look great": the AI, tiny, in its own file label
//  - "And in a world gone mad / That no one understands": over the city
//  - "I know a human's gonna have to lend a hand": his window's light is passed on, a ripple of warm
//    windows spreading out from his through the city, one ring per beat
//  - from "a world gone mad": the fire spreads, tower by tower (the far ones first; his, never), roofs
//    first, then down the floors, window by window; nobody leaves their window
//  - every window: the same front-facing silhouette (assets/business_man.svg), his in full detail and hot light
//  - "Enjoy your conference talk while it still matters…": the AI's last line, typed at the bottom
//  - "…happy that WE'RE here": the whole city bounces on the beat, windows flare; then a slow fade to black, a single
//    cursor blinks twice, and is gone.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { LIN } from '../engine/palette';
import { clamp, ease, hash, mulberry32, prog, springStep } from '../engine/util';
import { measure, plain } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { FIRE_GLSL, TYPE, col, cursorOn, loadImage, wordAlpha, wordRow, wordState } from './_look';

// world: towers of windows; his window is window (col 6, floor 9) of tower 4
const WW = 24, WH = 30, GX = 8, GY = 10; // window size and gaps (world px at zoom 1)
const HORIZON = 900; // ground line (world y)
const NROOF = 24;
const PULL = 14; // seconds of the pull-back, from inside his window to the whole city
const BUST = 0.46; // the silhouette crop: head to just above the waist (fraction of the figure's height)

const SKY = /* glsl */ `
#define NROOF ${NROOF}
uniform sampler2D tLayer;
uniform float t, kick, fireH, dark, streetY, streetH;
uniform vec4 roofs[NROOF]; // screen space: x0, x1, roof y, flame height
${FIRE_GLSL}
// a burning roof: narrow licking tongues across the roof (fixed px scale, tapered at the ends), in the
// film's posterized bands, with a slow posterized smoke plume behind
vec4 roofFire(vec2 p, vec4 r, float t, float kick, float seed, out float smoke) {
  smoke = 0.0;
  float w = r.y - r.x;
  float u = (p.x - r.x) / w;
  float y = (r.z - p.y) / r.w; // 0 at the roof, 1 at the nominal tip
  if (u < -0.3 || u > 1.3 || y < -0.02 || y > 5.0) return vec4(0.0);
  // the plume: a column over the roof, widening and drifting as it rises, breaking up at the top
  float cxp = 0.5 + 0.08 * y + 0.05 * sin(t * 0.7 + seed);
  float wid = 0.32 + 0.12 * y;
  float column = exp(-pow((u - cxp) / wid, 2.0)) * smoothstep(0.6, 1.3, y) * smoothstep(4.8, 2.4, y);
  float sn = snoise(vec2(p.x / 60.0 + seed, p.y / 55.0 + t * 0.9)) * 0.5 + 0.5;
  smoke = step(0.5, column * (0.55 + 0.6 * sn));
  if (u < 0.0 || u > 1.0) return vec4(0.0);
  float taper = smoothstep(0.0, 0.14, u) * smoothstep(1.0, 0.86, u);
  float x = p.x / 38.0;
  float tongues = 0.5 + 0.38 * snoise(vec2(x + seed, t * 0.95)) + 0.22 * snoise(vec2(x * 2.2 - seed, t * 1.8));
  float lick = 0.16 * snoise(vec2(x * 1.4 + seed * 2.0, y * 2.6 - t * 2.8));
  float v = tongues * (0.3 + 0.7 * taper) * (1.0 + 0.15 * kick) - y + lick;
  vec3 c = C_BLOOD * 0.9;
  if (v > 0.12) c = C_SIGNAL * 0.95;
  if (v > 0.3) c = C_EMBER * 1.05;
  if (v > 0.5) c = mix(C_EMBER, vec3(1.0, 0.93, 0.8), 0.5) * 1.3;
  float a = smoothstep(0.0, fwidth(v) * 1.2, v);
  return vec4(c, a);
}
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  float yf = p.y / 1080.0;
  vec3 col = mix(C_COBALT_DEEP * 0.45, C_INK2, smoothstep(0.0, 0.7, yf)) + (C_BLOOD * 0.55 + C_SIGNAL * 0.2) * smoothstep(0.35, 1.0, yf) * (0.9 + 0.2 * kick);
  vec4 f = fireAt(p, 1090.0, fireH, t * 0.8, kick, 11.0);
  col = mix(col, f.rgb * 0.9, f.a);
  for (int i = 0; i < NROOF; i++) {
    vec4 r = roofs[i];
    if (r.w <= 0.5) continue;
    float smoke;
    vec4 rf = roofFire(p, r, t, kick, float(i) * 1.7, smoke);
    col = mix(col, C_INK2 * 1.4 + C_BLOOD * 0.08, smoke * 0.55);
    col = mix(col, rf.rgb * 0.9, rf.a);
  }
  vec4 l = texture(tLayer, vUv); col = mix(col, l.rgb, l.a);
  // the street fire, in front of the towers' feet, rising through the last minute
  vec4 sf = fireAt(p, streetY, streetH, t * 0.75, kick, 5.0);
  col = mix(col, sf.rgb * 0.95, sf.a);
  col *= 1.0 - dark;
  fragColor = vec4(col, 1.0);
}`;

interface Tower { x: number; cols: number; floors: number; ignite: number; mine?: boolean }

export default class Finale extends Scene {
  layer = new Layer2D();
  top = new Layer2D();
  pass!: FSPass;
  roofs = Array.from({ length: NROOF }, () => new THREE.Vector4());
  sprite!: HTMLCanvasElement; // the low-fi silhouette, for everyone's window
  hero!: HTMLCanvasElement; heroRim!: HTMLCanvasElement; // his, in full detail, and its rim
  towers: Tower[] = [];
  hooks: Line[] = [];
  mp3!: Line; mad!: Line; nobody!: Line; hand!: Line; enjoy!: Line;
  me = { x: 0, y: 0 }; // his window's world centre

  override async init() {
    const ly = this.ctx.lyrics;
    const img = await loadImage('assets/business_man.svg');
    // the figure (assets/business_man.svg, a clean vector bust), cut just above the waist; rasterized crisp at each size
    const tint = (w: number, key: string) => {
      const cv = document.createElement('canvas');
      cv.width = w; cv.height = Math.round((w * img.height * BUST) / img.width);
      const c = cv.getContext('2d')!;
      c.imageSmoothingQuality = 'high';
      c.drawImage(img, 0, 0, img.width, img.height * BUST, 0, 0, cv.width, cv.height);
      c.globalCompositeOperation = 'source-in';
      c.fillStyle = col(key); c.fillRect(0, 0, cv.width, cv.height);
      return cv;
    };
    this.hero = tint(1100, 'ink');
    this.heroRim = tint(1100, 'signal');
    this.sprite = tint(48, 'ink');
    const inWin = ly.linesIn(this.ctx.start - 0.2, this.ctx.end);
    this.hooks = inWin.filter((l) => l.voice === 'human' && /happy/i.test(l.text));
    this.mp3 = ly.get('MP3 file');
    this.mad = ly.get('world gone mad');
    this.nobody = ly.get('no one understands');
    this.hand = ly.get('lend a hand');
    this.enjoy = ly.get('Enjoy your conference talk');
    // the city: towers left to right, heights varying
    const rnd = mulberry32(44);
    let x = -1400;
    while (x < 3300) {
      const cols = 5 + Math.floor(rnd() * 7), floors = 10 + Math.floor(rnd() * rnd() * 26);
      this.towers.push({ x, cols, floors, ignite: 1e9 });
      x += cols * (WW + GX) + 40 + rnd() * 60;
    }
    // his tower: the one nearest the centre; his window mid-tower
    const mine = this.towers.reduce((b, tw) => (Math.abs(tw.x + (tw.cols * (WW + GX)) / 2 - 960) < Math.abs(b.x + (b.cols * (WW + GX)) / 2 - 960) ? tw : b));
    mine.floors = Math.max(mine.floors, 18);
    mine.mine = true;
    // the spread: nothing burns during the pull-back (just the lit city, amber and blue); once we're
    // all the way out the towers catch one by one, the far ones first, until the last hook; his never
    // does (the fire is everywhere but in his window)
    const cx = (tw: Tower) => tw.x + (tw.cols * (WW + GX)) / 2;
    // (only the towers in the final frame count: the city is wider than the shot)
    const inShot = (tw: Tower) => { const sx = (cx(tw) - 960) * 0.9 + 960; return sx > -150 && sx < W + 150; };
    const order = this.towers.filter((tw) => tw !== mine && inShot(tw)).sort((a, b) => Math.abs(cx(b) - cx(mine)) - Math.abs(cx(a) - cx(mine)));
    const t0 = this.ctx.start + PULL + 1.2, t1 = this.hooks[this.hooks.length - 1]!.start;
    order.forEach((tw, i) => { tw.ignite = t0 + (i / order.length) * (t1 - t0) + (rnd() - 0.5) * 0.8; });
    for (const tw of this.towers) if (tw !== mine && !inShot(tw)) tw.ignite = t0;
    mine.ignite = t1 - 1.5; // his tower goes last (his own window never does)
    const mc = Math.floor(mine.cols / 2), mf = 9;
    this.me = { x: mine.x + mc * (WW + GX) + WW / 2, y: HORIZON - (mf + 1) * (WH + GY) + WH / 2 };
    this.pass = new FSPass(SKY, { tLayer: { value: this.layer.texture }, roofs: { value: this.roofs }, t: { value: 0 }, kick: { value: 0 }, fireH: { value: 0 }, dark: { value: 0 }, streetY: { value: 0 }, streetH: { value: 0 } });
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t;
    const s0 = this.ctx.start;
    const last = this.hooks[this.hooks.length - 1]!;
    // camera: from inside his window (zoom 44) out to the whole city (zoom 0.9), exponential, over ~14 s,
    // then a slow drift out
    const k = ease.inOutCubic(prog(t, s0 + 0.3, s0 + PULL));
    const z = Math.exp(Math.log(44) + (Math.log(0.95) - Math.log(44)) * k) * (1 - 0.06 * prog(t, s0 + PULL, last.end + 3));
    const focus = { x: this.me.x + (960 - this.me.x) * k, y: this.me.y + (560 - this.me.y) * k };
    const S = (x: number, y: number) => ({ x: (x - focus.x) * z + 960, y: (y - focus.y) * z + 540 });
    const cheers = ease.outBack(clamp((t - (last.words.find((w) => /we’re/i.test(w.w))?.start ?? 1e9)) / 0.5));
    const au = this.ctx.audio;
    const bp = au.beatAt(t);
    // once we're all the way out: rings of his light spreading through the city, one per downbeat, and
    // one per beat while "a human's gonna have to lend a hand"; all the same speed and life, their
    // strength following the music (an equalizer, of sorts)
    const ripples: { r: number; a: number }[] = [];
    const b0 = Math.ceil(au.beatAt(s0 + PULL - 0.5)), b1 = Math.floor(au.beatAt(Math.min(t, last.end)));
    const handBeats = [au.beatAt(this.hand.start - 0.1), au.beatAt(this.hand.end + 0.3)];
    for (let bi = Math.max(b0, b1 - 4); bi <= b1; bi++) {
      const tb = au.timeOfBeat(bi), age = t - tb;
      if (age < 0 || age > 1.8) continue;
      const down = au.downbeats.some((d) => Math.abs(d - tb) < 0.05);
      if (!down && !(bi >= handBeats[0]! && bi <= handBeats[1]!)) continue;
      const e = clamp(au.sample(tb + 0.05).rms * 1.6);
      ripples.push({ r: age * 1300, a: 0.55 * (0.4 + 0.6 * e) * (1 - age / 1.8) * clamp((tb - s0 - PULL + 0.5) / 2) });
    }

    const c = this.layer.ctx;
    this.layer.clear();
    // ground
    const g0 = S(0, HORIZON);
    c.fillStyle = col('ink');
    c.fillRect(0, g0.y, W, H - g0.y + 10);
    // towers and windows
    let nr = 0;
    for (const r of this.roofs) r.set(0, 0, 0, 0);
    for (const [ti, tw] of this.towers.entries()) {
      const a = S(tw.x - 12, HORIZON - tw.floors * (WH + GY) - 16), b = S(tw.x + tw.cols * (WW + GX) + 4, HORIZON);
      if (b.x < 0 || a.x > W) continue;
      const burn = Math.max(0, t - tw.ignite); // seconds this tower has been burning
      // its roof fire (drawn by the shader, in the film's fire), growing as it catches
      if (burn > 0 && nr < NROOF && a.y > -200) {
        // it catches, then keeps growing: small at first, a tall blaze after a few seconds
        const grow = ease.outCubic(clamp(burn / 1.2)) * (0.45 + 0.55 * clamp(burn / 7));
        this.roofs[nr++]!.set(a.x + 6, b.x - 6, a.y + 1, (85 + 85 * hash(ti, 7)) * z * grow * (1 + 0.12 * f.a.kick));
      }
      c.fillStyle = col('ink2');
      c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y);
      for (let fl = 0; fl < tw.floors; fl++) for (let cc = 0; cc < tw.cols; cc++) {
        const wx = tw.x + cc * (WW + GX), wy = HORIZON - (fl + 1) * (WH + GY);
        const p = S(wx, wy), sz = { w: WW * z, h: WH * z };
        if (p.x > W || p.y > H || p.x + sz.w < 0 || p.y + sz.h < 0) continue;
        const isMe = Math.abs(wx + WW / 2 - this.me.x) < 1 && Math.abs(wy + WH / 2 - this.me.y) < 1;
        const hsh = hash(ti * 97 + fl, cc);
        const lit = isMe || hsh > 0.18;
        // his light, passing through the city in rings
        const dist = Math.hypot(wx + WW / 2 - this.me.x, wy + WH / 2 - this.me.y);
        let front = 0;
        for (const r of ripples) front = Math.max(front, r.a * Math.exp(-(((r.r - dist) / 55) ** 2)));
        // fire: from the top floor down, window by window (not every window)
        const onFire = !isMe && burn > 0 && hsh < 0.62 && fl >= tw.floors - burn * 1.6 - hsh * 4;
        if (isMe) {
          // his window: hot light, the only one that bright
          const gg = c.createLinearGradient(0, p.y, 0, p.y + sz.h);
          gg.addColorStop(0, col('bone', 0.95)); gg.addColorStop(1, col('ember', 0.95));
          c.fillStyle = gg;
        } else if (onFire) c.fillStyle = col('blood', 0.95);
        else c.fillStyle = lit ? col(hsh > 0.93 ? 'cobaltText' : 'ember', 0.42 + 0.35 * cheers * (0.6 + 0.4 * hash(fl, cc + 9))) : col('ink', 0.9);
        c.fillRect(p.x, p.y, sz.w, sz.h);
        if (onFire) this.windowFire(c, p.x, p.y, sz.w, sz.h, t, hsh, clamp((burn * 1.6 - (tw.floors - fl) + hsh * 4) / 2));
        if (front > 0.02 && !isMe) { c.fillStyle = col('bone', front); c.fillRect(p.x, p.y, sz.w, sz.h); }
        if (!lit && !onFire) continue;
        // the engineer at the window: the same silhouette everywhere, bouncing on the beat at the end
        if (sz.w >= 4) {
          const jump = cheers * Math.pow(Math.max(0, Math.sin(Math.PI * (((bp + hsh * 0.35) % 1 + 1) % 1))), 2) * 3.2 * z;
          const bh = WH * 0.8 * z, bw = bh * (this.sprite.width / this.sprite.height);
          const bx = p.x + (sz.w - bw) / 2 + (isMe ? 0 : (hsh - 0.5) * 4 * z), by = p.y + sz.h - bh - jump;
          c.save();
          c.beginPath(); c.rect(p.x, p.y, sz.w, sz.h); c.clip();
          if (isMe) {
            const rim = Math.max(1, z * 0.05);
            c.drawImage(this.heroRim, bx - rim, by - rim, bw + 2 * rim, bh + 2 * rim);
            c.drawImage(this.hero, bx, by, bw, bh);
          } else c.drawImage(bh > 90 ? this.hero : this.sprite, bx, by, bw, bh);
          c.restore();
        }
      }
    }
    this.layer.upload();

    // the fade at the end
    const endFade = prog(t, last.end + 1.2, last.end + 3.2, ease.inOutCubic);
    const u = this.pass.u;
    u.t!.value = t; u.kick!.value = f.a.kick;
    u.roofs!.value = this.roofs;
    u.fireH!.value = (60 + 90 * k) * prog(t, s0 + PULL + 1, s0 + PULL + 4) * (1 + 0.2 * f.a.kick); // (no fire during the pull-back)
    // the street fire rises through the last minute: by the end the city stands in it
    u.streetY!.value = S(0, HORIZON).y + 40;
    u.streetH!.value = 145 * prog(t, s0 + PULL + 3, last.start + 1, ease.inOutCubic) * (1 + 0.12 * f.a.kick);
    u.dark!.value = endFade;
    this.pass.render(renderer, out);

    // type, on top
    const d = this.top.ctx;
    this.top.clear();
    d.globalAlpha = 1 - endFade;
    this.lyrics(d, t);
    d.globalAlpha = 1;
    // the end: a single cursor, blinking on past the end of the song, and then gone
    if (endFade >= 1) {
      const e = t - (last.end + 3.2);
      const on = e > 0.3 && (e - 0.3) % 1.0 < 0.5 && t < this.ctx.end - 0.4;
      if (on) { d.fillStyle = col('cobalt'); d.fillRect(W / 2 - 14, H / 2 - 28, 28, 56); }
    }
    this.top.upload();
    this.ctx.comp.draw(renderer, this.top.texture, out);
    return { bloom: 0.6 + 0.4 * cheers * (1 - endFade), bloomThreshold: 0.9, vignette: 0.45, grain: 0.055, flash: Math.max(0, 1 - Math.abs(cheers - 1) * 0) * 0 };
  }

  /** A window on fire: posterized flame bands (blood, signal, ember) licking up behind the silhouette. */
  private windowFire(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number, seed: number, k: number) {
    const bands: [string, number][] = [['signal', 0.85], ['ember', 0.5]];
    for (const [key, hh] of bands) {
      c.fillStyle = col(key, 0.95);
      c.beginPath();
      c.moveTo(x, y + h);
      const n = 5;
      for (let i = 0; i <= n; i++) {
        const u = i / n;
        const lick = 0.12 * Math.sin(t * 5 + seed * 40 + u * 7) + 0.1 * Math.sin(t * 3.1 - u * 11 + seed * 9);
        c.lineTo(x + u * w, y + h - h * k * hh * (0.75 + lick + 0.25 * Math.sin(u * Math.PI)));
      }
      c.lineTo(x + w, y + h);
      c.closePath(); c.fill();
    }
  }

  // ---- lyrics
  private lyrics(c: CanvasRenderingContext2D, t: number) {
    // the non-hook human lines take the frame when they're on
    const other = [this.mad, this.nobody, this.hand].find((l) => t >= l.start - 0.3 && t < (l === this.hand ? l.end + 1.2 : l === this.mad ? this.nobody.start - 0.05 : this.hand.start - 0.3));
    if (other) {
      if (other === this.hand) {
        const ws = other.words;
        const hu = ws.findIndex((w) => /human/i.test(w.w)), le = ws.findIndex((w) => /lend/i.test(w.w));
        wordRow(c, ws.slice(0, hu - 1), t, 132, 230, 64);
        wordRow(c, ws.slice(hu - 1, le), t, 124, 380, 140, { width: 75, weight: 900, color: (w) => (/human/i.test(w.w) ? 'ember' : 'bone') });
        wordRow(c, ws.slice(le), t, 124, 520, 140, { width: 75, weight: 900 });
      } else {
        const both = [this.mad, this.nobody];
        both.forEach((l, i) => wordRow(c, l.words, t, 124, 260 + i * 170, 140, { width: 75, weight: 900 }));
      }
    } else this.lockup(c, t);
    this.aside(c, t);
  }

  /** The hook lockup with its edits: TO BE → THAT YOU'RE (first line), YOU'RE → WE'RE (last). */
  private lockup(c: CanvasRenderingContext2D, t: number) {
    let i = 0;
    for (let k = 0; k < this.hooks.length; k++) if (this.hooks[k]!.start - 0.4 <= t) i = k;
    const line = this.hooks[i]!;
    const find = (re: RegExp) => line.words.find((w) => re.test(w.w));
    const im = find(/^i’m$/i), just = find(/^just$/i), happy = find(/^happy/i), that = find(/^that$/i), who = find(/^(you’re|we’re)$/i), here = find(/^here/i);
    const first = i === 0, lastLine = i === this.hooks.length - 1;
    const put = (w: Word | undefined, label: string, x: number, y: number, size: number, width: number, weight: number, a?: number) => {
      c.font = TYPE.human(size, width, weight);
      // words the previous hook line already sang stay lit; only new words wait for the voice
      const prev = this.hooks[i - 1];
      const kept = !!w && !!prev && prev.words.some((pw) => pw.w.toLowerCase().replace(/[^a-z’']/g, '') === w.w.toLowerCase().replace(/[^a-z’']/g, '') && t >= pw.start);
      c.fillStyle = col('bone', a ?? (w ? (kept ? 1 : wordAlpha(w, t, 0.22)) : 1));
      c.fillText(label, x, y);
      return measure(label, TYPE.humanFamily(width, weight), size);
    };
    const x0 = 150;
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    let x = x0;
    x += put(im, 'I’M', x, 230, 88, 100, 800) + 24;
    put(just, 'JUST', x, 230, 88, 100, 800);
    put(happy, 'HAPPY', x0 - 12, 520, 300, 125, 900);
    // row 3, with the edits as a roll (like an odometer): the old words roll down and out of the line,
    // the new ones roll in from above in ember; HERE slides over to make room
    const r3 = 108, y3 = 660;
    const fam = TYPE.humanFamily(100, 800), gap = r3 * 0.28;
    const mw = (s: string) => measure(s, fam, r3);
    c.save();
    c.beginPath(); c.rect(0, y3 - r3 * 0.86, W, r3 * 1.1); c.clip();
    c.font = TYPE.human(r3, 100, 800);
    const roll = (label: string, x: number, k: number, dir: 1 | -1, key: string, a: number) => {
      // k: 0 → 1; dir 1 = rolling in from above, -1 = rolling out downward
      const off = dir === 1 ? -(1 - k) * r3 * 1.05 : k * r3 * 1.05;
      c.fillStyle = col(key, a * (dir === 1 ? clamp(k * 1.6) : 1 - k));
      c.fillText(label, x, y3 + off);
    };
    const rk = (w: Word | undefined) => (w ? ease.inOutCubic(prog(t, w.start - 0.1, w.start + 0.2)) : 0);
    if (first && that) {
      // the first time: THAT YOU'RE rolls in, word by word, in ember (the new words of the hook)
      const kt = rk(that), ky = rk(who);
      roll('THAT', x0, kt, 1, 'ember', wordAlpha(that, t, 0.22));
      if (who) roll('YOU’RE', x0 + mw('THAT') + gap, ky, 1, 'ember', wordAlpha(who, t, 0.22));
      c.restore();
      put(here, 'HERE', x0 + mw('THAT') + gap + mw('YOU’RE') + gap, y3, r3, 100, 800);
    } else if (lastLine && who) {
      const kw = rk(who);
      x = x0;
      c.restore();
      x += put(that, 'THAT', x, y3, r3, 100, 800) + gap;
      c.save();
      c.beginPath(); c.rect(0, y3 - r3 * 0.86, W, r3 * 1.1); c.clip();
      c.font = TYPE.human(r3, 100, 800);
      roll('YOU’RE', x, kw, -1, 'bone', 1);
      roll('WE’RE', x, kw, 1, 'ember', wordAlpha(who, t, 0.22));
      c.restore();
      put(here, 'HERE', x + mw('YOU’RE') + gap + (mw('WE’RE') - mw('YOU’RE')) * kw, y3, r3, 100, 800);
    } else {
      c.restore();
      x = x0;
      x += put(that, 'THAT', x, y3, r3, 100, 800) + gap;
      x += put(who, 'YOU’RE', x, y3, r3, 100, 800) + gap;
      put(here, 'HERE', x, y3, r3, 100, 800);
    }
  }

  /** The AI's two asides: the MP3 file label, the closing line. */
  private aside(c: CanvasRenderingContext2D, t: number) {
    for (const l of [this.mp3, this.enjoy]) {
      if (t < l.start - 0.1 || t > l.end + 2.5) continue;
      const said = plain(l.words.filter((w) => t >= w.start).map((w) => w.w).join(' '));
      const a = clamp((t - l.start + 0.1) / 0.2) * clamp((l.end + 2.5 - t) / 0.5);
      c.globalAlpha = a * c.globalAlpha;
      c.font = TYPE.ai(30, 500);
      c.textAlign = 'left';
      const y = 1000;
      if (l === this.mp3) {
        c.fillStyle = col('ink', 0.85); c.fillRect(120, y - 80, 760, 110);
        c.fillStyle = col('steel', 0.8); c.font = TYPE.ai(16, 600);
        c.fillText('happy_to_be_here.mp3 · 4:22 · 320 kbps · ID3: “the AI”', 140, y - 50);
        c.font = TYPE.ai(30, 500);
      }
      c.fillStyle = col('cobaltText');
      c.fillText(said, 140, y);
      if (cursorOn(t)) { c.fillStyle = col('cobalt'); c.fillRect(146 + c.measureText(said).width, y - 28, 18, 34); }
      c.globalAlpha = 1;
    }
  }
}
