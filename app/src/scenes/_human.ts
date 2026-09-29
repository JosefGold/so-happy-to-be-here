// The Human, in silhouette: a seated software engineer in profile, mug in hand.
// Built from an anatomical skeleton in real centimetres (seat 47 cm, femur 44, tibia 45, seated
// shoulder height 104, head 23) as tapered capsules blended with smooth unions, plus a detailed
// profile polygon for the head. Rendered as a signed distance field in its own pass, so edges are
// crisp at any scale and the rim lights are exact: a cold rim on the edges facing the monitor
// (in front of him) and a warm rim on the edges facing the fire (behind / above).
// Local frame: x forward (the way he faces), y up, 0 = the floor under the hip. On screen he
// faces left: screen = origin + (-x, -y) * scale.
import * as THREE from 'three';
import { FSPass, makeRT, clearRT } from '../engine/gl';

export interface Pose {
  nod: number; // head rotation (rad), + = chin down
  lift: number; // mug arm: 0 = mug at chest height, 1 = at the lips
}
export interface HumanLook {
  ink: [number, number, number];
  rimCold: [number, number, number] | null;
  rimWarm: [number, number, number] | null;
  rimPx: number; // rim width in px
}

type V = [number, number];
const MAX_RC = 32, MAX_POLY = 128;

// ---- the head's profile (facing +x), relative to the base of the neck; smoothed at load
const HEAD_PTS: V[] = [
  [-3.6, 0], [-3.9, 5], [-5.6, 9], [-7.5, 13], [-8.1, 17], [-7.4, 21.4], [-5.2, 24.6], [-1.5, 26.1], [2.6, 26.1],
  [6.2, 25.2], [8.2, 23.4], [7.9, 22.2], [7.9, 21.2], [8.6, 18.6], [8.9, 16.7], [8.4, 15.6], [9.3, 14.5], [11.3, 11.7], [11.1, 10.9],
  [9.7, 10.6], [9.4, 10.1], [9.9, 9.4], [9.3, 8.9], [9.5, 8.3], [8.8, 7.6], [9.2, 6.4], [8.4, 5.2],
  [6.6, 4.5], [4.9, 3.6], [4.3, 0],
];
/** Catmull-Rom resampling of a closed polygon (smooth, keeps the features). */
function smooth(pts: V[], per = 3): V[] {
  const out: V[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n]!, p1 = pts[i]!, p2 = pts[(i + 1) % n]!, p3 = pts[(i + 2) % n]!;
    for (let k = 0; k < per; k++) {
      const t = k / per, t2 = t * t, t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  return out;
}
const HEAD = smooth(HEAD_PTS, 4);
const NECK_BASE: V = [0.5, 105];

const FRAG = /* glsl */ `
uniform vec4 rcA[${MAX_RC}];   // round cone: a.xy, b.xy (cm)
uniform vec3 rcR[${MAX_RC}];   // ra, rb, group (0 body: smooth union; 1 hard round cone; 2 hard rounded box: a = centre, b = half size, ra = corner)
uniform int nRC;
uniform vec2 poly[${MAX_POLY}];
uniform int nPoly;
uniform vec2 origin;           // screen px of the local origin
uniform float scale;           // px per cm
uniform vec4 bbox;             // local xmin, ymin, xmax, ymax
uniform vec3 ink, rimCold, rimWarm;
uniform float useCold, useWarm, rimPx;

float cro(vec2 a, vec2 b) { return a.x * b.y - a.y * b.x; }
float sdRC(vec2 p, vec2 pa, vec2 pb, float ra, float rb) {
  p -= pa; pb -= pa;
  float h = dot(pb, pb);
  if (h < 1e-6) return length(p) - ra;
  vec2 q = vec2(dot(p, vec2(pb.y, -pb.x)), dot(p, pb)) / h;
  q.x = abs(q.x);
  float b = ra - rb;
  vec2 c = vec2(sqrt(max(h - b * b, 1e-6)), b);
  float k = cro(c, q), m = dot(c, q), n = dot(q, q);
  if (k < 0.0) return sqrt(h * n) - ra;
  if (k > c.x) return sqrt(h * (n + 1.0 - 2.0 * q.y)) - rb;
  return m - ra;
}
float sdPoly(vec2 p) {
  float d = dot(p - poly[0], p - poly[0]);
  float s = 1.0;
  for (int i = 0; i < ${MAX_POLY}; i++) {
    if (i >= nPoly) break;
    int jj = i == 0 ? nPoly - 1 : i - 1;
    vec2 vi = poly[i], vj = poly[jj];
    vec2 e = vj - vi, w = p - vi;
    vec2 b = w - e * clamp(dot(w, e) / dot(e, e), 0.0, 1.0);
    d = min(d, dot(b, b));
    bvec3 c = bvec3(p.y >= vi.y, p.y < vj.y, e.x * w.y > e.y * w.x);
    if (all(c) || all(not(c))) s = -s;
  }
  return s * sqrt(d);
}
float sdf(vec2 p) {
  float body = 1e5, hard = 1e5;
  for (int i = 0; i < ${MAX_RC}; i++) {
    if (i >= nRC) break;
    if (rcR[i].z > 1.5) {
      vec2 q = abs(p - rcA[i].xy) - rcA[i].zw + rcR[i].x;
      hard = min(hard, length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - rcR[i].x);
      continue;
    }
    float d = sdRC(p, rcA[i].xy, rcA[i].zw, rcR[i].x, rcR[i].y);
    if (rcR[i].z < 0.5) body = smin(body, d, 2.2); else hard = min(hard, d);
  }
  body = smin(body, sdPoly(p), 1.6);
  body = max(body, -p.y); // flat soles
  return min(body, hard);
}
void main() {
  vec2 px = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec2 p = vec2(origin.x - px.x, origin.y - px.y) / scale;
  if (p.x < bbox.x || p.y < bbox.y || p.x > bbox.z || p.y > bbox.w) { fragColor = vec4(0.0); return; }
  float d = sdf(p);
  float dpx = d * scale;
  float a = clamp(0.5 - dpx, 0.0, 1.0);
  if (a <= 0.0) { fragColor = vec4(0.0); return; }
  vec3 c = ink;
  float band = 1.0 - smoothstep(rimPx * 0.6, rimPx, -dpx);
  if (band > 0.0) {
    float e = 0.25;
    vec2 n = normalize(vec2(sdf(p + vec2(e, 0.0)) - sdf(p - vec2(e, 0.0)), sdf(p + vec2(0.0, e)) - sdf(p - vec2(0.0, e))));
    float cold = smoothstep(0.1, 0.6, n.x) * useCold;                                 // facing forward (the monitor)
    float warm = smoothstep(0.1, 0.6, max(-n.x, n.y * 0.7)) * useWarm * (1.0 - cold); // facing back / up (the fire)
    c = mix(c, rimCold, band * cold);
    c = mix(c, rimWarm, band * warm);
  }
  fragColor = vec4(c, a);
}`;

export class Human {
  pass: FSPass;
  rt: THREE.WebGLRenderTarget;
  mugTop: { x: number; y: number } = { x: 0, y: 0 };

  constructor() {
    this.rt = makeRT();
    this.pass = new FSPass(FRAG, {
      rcA: { value: Array.from({ length: MAX_RC }, () => new THREE.Vector4()) },
      rcR: { value: Array.from({ length: MAX_RC }, () => new THREE.Vector3()) },
      nRC: { value: 0 },
      poly: { value: Array.from({ length: MAX_POLY }, () => new THREE.Vector2()) },
      nPoly: { value: 0 },
      origin: { value: new THREE.Vector2() }, scale: { value: 4.5 },
      bbox: { value: new THREE.Vector4(-40, -2, 95, 140) },
      ink: { value: new THREE.Vector3() }, rimCold: { value: new THREE.Vector3() }, rimWarm: { value: new THREE.Vector3() },
      useCold: { value: 0 }, useWarm: { value: 0 }, rimPx: { value: 3 },
    });
  }

  /** Render the figure into this.rt (screen space, straight alpha) with its floor point at (x, y). */
  render(renderer: THREE.WebGLRenderer, x: number, y: number, scale: number, pose: Pose, look: HumanLook) {
    const rc: [V, V, number, number, number][] = [];
    const cone = (a: V, b: V, ra: number, rb: number, hard = 0) => rc.push([a, b, ra, rb, hard]);
    // ---- torso (slightly reclined), buttocks on the seat at 47 cm
    cone([-6, 56], [5, 59], 11.5, 11.5); // pelvis / seat
    cone([-8.5, 63], [-8.5, 90], 7.5, 8.5); // lower back -> shoulder blades
    cone([4.5, 70], [4.5, 70], 11, 11); // belly
    cone([1.5, 83], [-0.5, 96], 12.5, 11); // chest
    cone([-2.5, 100], [-2.5, 100], 7.2, 7.2); // shoulder (deltoid)
    cone([0, 99], [1.5, 106], 5.6, 5.2); // neck into the head
    // ---- legs: near leg forward, far leg tucked a little back
    cone([2, 53], [43, 54.5], 10.5, 6.3); // near thigh
    cone([43, 53], [44.5, 30], 6.0, 5.4); // knee -> calf
    cone([44.5, 30], [47, 8], 5.4, 3.3); // calf -> ankle
    cone([45, 4.4], [60, 3.2], 4.4, 2.9); // shoe (heel -> toe, ~27 cm)
    cone([0, 53], [40, 55.5], 10, 6); // far thigh
    cone([40, 54.5], [38.5, 30], 5.8, 5.1);
    cone([38.5, 30], [37, 8], 5.1, 3.2);
    cone([35, 4.2], [49, 3.0], 4.1, 2.7); // far shoe
    // ---- far arm, resting on the thigh
    cone([-3.5, 99], [3, 76], 5.4, 4.2);
    cone([3, 76], [27, 62], 4.0, 3.1);
    cone([29, 62], [33, 61.5], 3.8, 3.4);
    // ---- near arm with the mug
    const k = Math.max(0, Math.min(1, pose.lift));
    const elbow: V = [6.5 + k * 2, 77 + k * 4];
    const ang = (32 + k * 40) * (Math.PI / 180);
    const wrist: V = [elbow[0] + Math.cos(ang) * 25, elbow[1] + Math.sin(ang) * 25];
    const fist: V = [wrist[0] + Math.cos(ang) * 3.5, wrist[1] + Math.sin(ang) * 3.5];
    cone([-2.5, 100], elbow, 5.9, 4.4); // upper arm
    cone(elbow, wrist, 4.2, 3.0); // forearm
    cone(fist, fist, 4.3, 4.3); // fist
    // the mug: a straight-sided cylinder just ahead of the fist, hard-edged (horizontal slabs)
    const mc: V = [fist[0] + 10.5, fist[1] + 1];
    cone(mc, [4.4, 5.2], 0.9, 0, 2); // the mug body: 8.8 x 10.4 cm
    // handle: a small loop between the mug and the fist
    cone([mc[0] - 4.4, mc[1] + 3], [mc[0] - 6.8, mc[1] + 1.5], 0.9, 0.9, 1);
    cone([mc[0] - 6.8, mc[1] + 1.5], [mc[0] - 6.8, mc[1] - 1.8], 0.9, 0.9, 1);
    cone([mc[0] - 6.8, mc[1] - 1.8], [mc[0] - 4.4, mc[1] - 3.2], 0.9, 0.9, 1);
    this.mugTop = { x: x - mc[0] * scale, y: y - (mc[1] + 5.2) * scale };

    const u = this.pass.u;
    (u.rcA!.value as THREE.Vector4[]).forEach((v, i) => { const r = rc[i]; if (r) v.set(r[0][0], r[0][1], r[1][0], r[1][1]); });
    (u.rcR!.value as THREE.Vector3[]).forEach((v, i) => { const r = rc[i]; if (r) v.set(r[2], r[3], r[4]); });
    u.nRC!.value = Math.min(rc.length, MAX_RC);
    const cs = Math.cos(-pose.nod), sn = Math.sin(-pose.nod);
    const polyU = u.poly!.value as THREE.Vector2[];
    HEAD.forEach(([hx, hy], i) => { if (i < MAX_POLY) polyU[i]!.set(NECK_BASE[0] + hx * cs - hy * sn, NECK_BASE[1] + hx * sn + hy * cs); });
    u.nPoly!.value = Math.min(HEAD.length, MAX_POLY);
    (u.origin!.value as THREE.Vector2).set(x, y);
    u.scale!.value = scale;
    (u.ink!.value as THREE.Vector3).set(...look.ink);
    (u.rimCold!.value as THREE.Vector3).set(...(look.rimCold ?? look.ink));
    (u.rimWarm!.value as THREE.Vector3).set(...(look.rimWarm ?? look.ink));
    u.useCold!.value = look.rimCold ? 1 : 0;
    u.useWarm!.value = look.rimWarm ? 1 : 0;
    u.rimPx!.value = look.rimPx;
    clearRT(renderer, this.rt, [0, 0, 0], 0);
    this.pass.render(renderer, this.rt);
    return this.rt.texture;
  }
}

/** The task chair, in the same frame (cm, x forward / y up), drawn as flat ink on a 2D canvas. */
export function drawChair(c: CanvasRenderingContext2D, x: number, y: number, scale: number, ink: string) {
  c.save();
  c.translate(x, y);
  c.scale(-scale, -scale);
  c.fillStyle = ink;
  const rr = (x0: number, y0: number, w: number, h: number, r: number) => { c.beginPath(); c.roundRect(x0, y0, w, h, r); c.fill(); };
  rr(-24, 40, 46, 6.5, 3); // seat cushion
  rr(-5, 34, 10, 6, 1.5); // mechanism
  rr(-1.6, 11, 3.2, 24, 1); // gas lift
  c.save(); // backrest: a reclined panel on a curved support
  c.translate(-19, 62);
  c.rotate(-0.12);
  rr(-3.5, 0, 7, 50, 3.5);
  c.restore();
  c.beginPath();
  c.moveTo(-20, 62); c.quadraticCurveTo(-22, 44, -12, 42); c.lineTo(-10, 45); c.quadraticCurveTo(-17, 48, -16.5, 62); c.closePath(); c.fill();
  c.beginPath(); // base: three visible legs and casters
  c.moveTo(-1.8, 12); c.lineTo(1.8, 12); c.lineTo(31, 6.5); c.lineTo(31, 4.8); c.lineTo(0, 9); c.lineTo(-31, 4.8); c.lineTo(-31, 6.5); c.closePath(); c.fill();
  c.beginPath(); c.moveTo(-1, 10); c.lineTo(1.5, 11); c.lineTo(11, 4); c.lineTo(9.4, 3.2); c.closePath(); c.fill();
  for (const [cx, r] of [[-30, 3.2], [30, 3.2], [10, 2.8]] as const) { c.beginPath(); c.arc(cx, r, r, 0, Math.PI * 2); c.fill(); }
  c.restore();
}
