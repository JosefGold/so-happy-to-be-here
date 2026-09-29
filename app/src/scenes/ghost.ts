// Verse 2b, "It's getting weird / I'm being steered by a ghost / Trying to let me know it's
// not that bad": the Human as a marionette. A real 3D jointed wooden mannequin (the artist's kind: egg
// head, ball joints, turned-wood limbs), standing on a dark stage under a warm key light, hung from a
// proper marionette control (a cross, with a hand bar) that the AI's giant mouse pointer is dragging.
// Strings to his head, shoulders, wrists and knees. Every beat is a new pose, snapped on with a
// puppet's overshoot (slack, ta-da, weird wobbles, being steered across the stage, the ghost's "boo",
// a shrug, a thumbs-up: it's not that bad). Lyric: IT'S GETTING WEIRD warps; STEERED BY A GHOST hangs
// from strings of its own; the reassurance is typed softly as ghost text.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT, makeRT } from '../engine/gl';
import { HEX, LIN } from '../engine/palette';
import { clamp, ease, prog, springStep } from '../engine/util';
import { layout, measure } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { TYPE, col, cursorOn, wordAlpha, wordRow, wordState } from './_look';
import { outline, toon } from './_toon';

type Pose = Partial<Record<'py' | 'px' | 'pz' | 'pyaw' | 'sx' | 'sz' | 'hx' | 'hz' | 'hy' | 'lsx' | 'lsz' | 'lex' | 'rsx' | 'rsz' | 'rex' | 'lhx' | 'lkx' | 'rhx' | 'rkx', number>>;
const KEYS = ['py', 'px', 'pz', 'pyaw', 'sx', 'sz', 'hx', 'hz', 'hy', 'lsx', 'lsz', 'lex', 'rsx', 'rsz', 'rex', 'lhx', 'lkx', 'rhx', 'rkx'] as const;

// the choreography's vocabulary (radians; l/r are his left/right; s shoulder, e elbow, h hip, k knee)
const POSES: Record<string, Pose> = {
  limp: { py: -0.03, sx: 0.3, hx: 0.6, hz: 0.15, lsz: 0.06, rsz: 0.06, lsx: 0.12, rsx: 0.18, lex: 0.35, rex: 0.25, lhx: 0.12, lkx: 0.3, rhx: 0.08, rkx: 0.25 },
  tada: { py: 0.03, hx: -0.18, lsz: 1.3, rsz: 1.3, lex: 0.12, rex: 0.12 },
  weirdL: { py: 0.03, pz: -0.06, sz: 0.14, hz: 0.45, lsz: 2.7, lex: 0.35, rsz: 0.3, rsx: 0.25, rex: 0.7, rhx: 0.75, rkx: 1.2 },
  weirdR: { py: 0.03, pz: 0.06, sz: -0.14, hz: -0.45, rsz: 2.7, rex: 0.35, lsz: 0.3, lsx: 0.25, lex: 0.7, lhx: 0.75, lkx: 1.2 },
  stepL: { px: 0.2, pyaw: 0.3, sx: 0.06, hy: -0.25, lhx: 0.6, lkx: 0.55, rhx: -0.25, rkx: 0.25, rsx: 0.65, rex: 0.35, lsx: -0.45, lsz: 0.1, rsz: 0.1 },
  stepR: { px: 0.42, pyaw: -0.15, sx: 0.06, hy: 0.2, rhx: 0.6, rkx: 0.55, lhx: -0.25, lkx: 0.25, lsx: 0.65, lex: 0.35, rsx: -0.45, lsz: 0.1, rsz: 0.1 },
  ghost: { px: 0.5, py: 0.05, hx: -0.3, lsx: 2.3, rsx: 2.3, lsz: 0.3, rsz: 0.3, lex: 1.0, rex: 1.0, lkx: 0.3, rkx: 0.3, lhx: 0.15 },
  ghost2: { px: 0.5, py: 0.06, hx: -0.2, hz: 0.35, lsx: 2.6, rsx: 2.1, lsz: 0.4, rsz: 0.2, lex: 1.2, rex: 0.8, rkx: 0.6, rhx: 0.35 },
  trying: { px: 0.45, sx: 0.12, hx: 0.25, hy: 0.3, lsx: 0.9, rsx: 0.9, lex: 1.1, rex: 1.1, lsz: 0.2, rsz: 0.2, lkx: 0.2, rkx: 0.2 },
  shrug: { px: 0.42, py: 0.02, hz: 0.35, sz: 0.05, lsz: 0.4, rsz: 0.4, lsx: 0.25, rsx: 0.25, lex: 1.7, rex: 1.7 },
  thumbs: { px: 0.4, pz: 0.06, hz: -0.22, hx: -0.12, rsx: 1.35, rex: 1.45, rsz: 0.1, lsz: 0.6, lsx: -0.2, lex: 1.9, lhx: 0.12, lkx: 0.18 },
  thumbs2: { px: 0.4, py: 0.03, pz: 0.04, hz: -0.3, hx: -0.2, rsx: 1.6, rex: 1.3, rsz: 0.15, lsz: 0.65, lsx: -0.2, lex: 1.95, rhx: 0.2, rkx: 0.5 },
};

/** A turned-wood limb: a lathe profile from r0 to r1 over length L, rounded ends, hanging down from 0 to -L. */
function limb(L: number, r0: number, r1: number) {
  const pts: THREE.Vector2[] = [];
  const N = 24;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const r = (r0 + (r1 - r0) * u) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(2 * u - 1), 6)));
    pts.push(new THREE.Vector2(Math.max(r, 1e-4), -u * L));
  }
  return new THREE.LatheGeometry(pts.reverse(), 28); // bottom-up: outward-facing (the outline hull is BackSide)
}

export default class Ghost extends Scene {
  back = new Layer2D();
  front = new Layer2D();
  rt!: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(30, W / H, 0.1, 60);
  j: Record<string, THREE.Object3D> = {};
  mk: Record<string, THREE.Object3D> = {}; // string attachment markers on the body
  ctrl = new THREE.Group();
  cp: Record<string, THREE.Object3D> = {}; // string attachment points on the control
  cursor = new THREE.Group();
  strings!: THREE.LineSegments;
  keys: [number, Pose][] = [];
  noOutline: THREE.Material | null = null;
  l1!: Line; l2!: Line; l3!: Line;

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('It’s getting weird');
    this.l2 = ly.get('steered by a ghost');
    this.l3 = ly.get('Trying to let me know');
    this.rt = makeRT(W, H, { samples: 4 });
    const { renderer } = this.ctx;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // the choreography, keyed to the words (a new pose on every beat)
    const au = this.ctx.audio;
    const beat = (t: number) => au.timeOfBeat(Math.round(au.beatAt(t)));
    const w = (l: Line, re: RegExp) => l.words.find((x) => re.test(x.w))!.start;
    const bt = au.timeOfBeat(1) - au.timeOfBeat(0);
    const k1 = w(this.l1, /weird/i);
    this.keys = [
      [this.ctx.start - 1, POSES.limp!],
      [this.l1.words[0]!.start - 0.04, POSES.tada!],
      [k1, POSES.weirdL!],
      [k1 + bt * 0.75, POSES.weirdR!],
      [w(this.l2, /steered/i) - 0.04, POSES.stepL!],
      [w(this.l2, /^by$/i) - 0.04, POSES.stepR!],
      [w(this.l2, /ghost/i) - 0.04, POSES.ghost!],
      [w(this.l2, /ghost/i) + bt, POSES.ghost2!],
      [this.l3.words[0]!.start - 0.04, POSES.trying!],
      [w(this.l3, /know/i) - 0.04, POSES.shrug!],
      [w(this.l3, /^not$/i) - 0.04, POSES.thumbs!],
      [w(this.l3, /bad/i) - 0.04, POSES.thumbs2!],
    ];
    void beat;

    // ---- the stage
    const S = this.scene;
    S.fog = new THREE.Fog(new THREE.Color(HEX.ink), 7, 15);
    S.add(new THREE.HemisphereLight(new THREE.Color(HEX.cobaltDeep), new THREE.Color(HEX.ink), 0.8));
    // cel-shaded: intensity ≈ π puts the lit band at the material's own colour
    const key = new THREE.SpotLight(new THREE.Color('#fff4e6'), 3.4, 0, 0.42, 0.25, 0);
    key.position.set(-2.4, 5.2, 4.2);
    key.target.position.set(0.9, 0.9, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.bias = -0.0004;
    key.shadow.radius = 4;
    S.add(key, key.target);
    const rim = new THREE.DirectionalLight(new THREE.Color(HEX.cobalt), 3.0); // the AI's light, from above and behind
    rim.position.set(2.5, 6, -4);
    S.add(rim);
    const bounce = new THREE.PointLight(new THREE.Color(HEX.signal), 0.0, 6, 1.5);
    bounce.position.set(0.6, 0.2, 1.6);
    S.add(bounce);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), toon(HEX.ink2));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    S.add(floor);

    // ---- the mannequin
    // flat, in the Human's colours: amber limbs, blood-orange joints, ink outlines
    const wood = toon(HEX.signal);
    const dark = toon(HEX.blood);
    const mesh = (g: THREE.BufferGeometry, m: THREE.Material, parent: THREE.Object3D, pos: [number, number, number] = [0, 0, 0], scale: [number, number, number] = [1, 1, 1]) => {
      const o = new THREE.Mesh(g, m);
      o.position.set(...pos); o.scale.set(...scale);
      o.castShadow = true; o.receiveShadow = true;
      parent.add(o);
      if (m !== this.noOutline) outline(o, 2.4);
      return o;
    };
    const group = (name: string, parent: THREE.Object3D, pos: [number, number, number]) => {
      const g = new THREE.Group(); g.position.set(...pos); parent.add(g); this.j[name] = g; return g;
    };
    const marker = (name: string, parent: THREE.Object3D, pos: [number, number, number]) => {
      const o = new THREE.Object3D(); o.position.set(...pos); parent.add(o); this.mk[name] = o;
    };
    const ball = new THREE.SphereGeometry(1, 32, 20);
    const root = group('root', S, [0.9, 0.98, 0]);
    mesh(ball, wood, root, [0, 0.02, 0], [0.155, 0.1, 0.1]); // pelvis
    const waist = group('waist', root, [0, 0.1, 0]);
    mesh(ball, dark, waist, [0, 0, 0], [0.07, 0.07, 0.07]);
    mesh(ball, wood, waist, [0, 0.25, 0], [0.16, 0.225, 0.1]); // chest
    const neck = group('neck', waist, [0, 0.5, 0]);
    mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.09, 20), dark, neck, [0, 0.03, 0]);
    mesh(ball, wood, neck, [0, 0.165, 0.01], [0.1, 0.132, 0.11]); // the egg head
    marker('head', neck, [0, 0.29, 0]);
    for (const [side, sx] of [['l', 1], ['r', -1]] as const) {
      const sh = group(side + 'sh', waist, [0.205 * sx, 0.41, 0]);
      mesh(ball, dark, sh, [0, 0, 0], [0.05, 0.05, 0.05]);
      marker(side + 'sh', sh, [0, 0.04, 0]);
      mesh(limb(0.29, 0.042, 0.033), wood, sh, [0, -0.02, 0]);
      const el = group(side + 'el', sh, [0, -0.3, 0]);
      mesh(ball, dark, el, [0, 0, 0], [0.034, 0.034, 0.034]);
      mesh(limb(0.25, 0.033, 0.026), wood, el, [0, -0.015, 0]);
      const wr = group(side + 'wr', el, [0, -0.27, 0]);
      mesh(ball, dark, wr, [0, 0, 0], [0.024, 0.024, 0.024]);
      mesh(ball, wood, wr, [0, -0.065, 0.005], [0.03, 0.068, 0.045]); // a mitten hand
      marker(side + 'wr', wr, [0, 0, 0]);
      const hip = group(side + 'hip', root, [0.088 * sx, -0.04, 0]);
      mesh(ball, dark, hip, [0, 0, 0], [0.058, 0.058, 0.058]);
      mesh(limb(0.44, 0.062, 0.044), wood, hip, [0, -0.02, 0]);
      const kn = group(side + 'kn', hip, [0, -0.45, 0]);
      mesh(ball, dark, kn, [0, 0, 0], [0.044, 0.044, 0.044]);
      marker(side + 'kn', kn, [0, 0.02, 0.04]);
      mesh(limb(0.42, 0.044, 0.03), wood, kn, [0, -0.015, 0]);
      const an = group(side + 'an', kn, [0, -0.44, 0]);
      mesh(ball, dark, an, [0, 0, 0], [0.028, 0.028, 0.028]);
      mesh(ball, wood, an, [0, -0.03, 0.055], [0.045, 0.03, 0.11]); // foot
    }

    // ---- the control: a cross (main bar, head bar) and a hand bar, dark steel; the AI's pointer on it
    const steel = toon('#27304d', { emissive: new THREE.Color(HEX.cobaltDeep), emissiveIntensity: 0.4 });
    this.noOutline = steel; // boxes: outlined radially (normals split at the corners)
    const box = (sx: number, sy: number, sz: number, pos: [number, number, number]) => outline(mesh(new THREE.BoxGeometry(sx, sy, sz), steel, this.ctrl, pos), 2.4, HEX.ink, true);
    box(0.9, 0.045, 0.06, [0, 0, 0]); // main bar (shoulders)
    box(0.06, 0.045, 0.62, [0, 0.0, 0.05]); // cross bar (head, knees)
    box(0.7, 0.04, 0.05, [0, -0.04, 0.34]); // the hand bar, hung at the front
    const cpt = (name: string, pos: [number, number, number]) => { const o = new THREE.Object3D(); o.position.set(...pos); this.ctrl.add(o); this.cp[name] = o; };
    cpt('head', [0, -0.02, -0.04]);
    cpt('lsh', [0.43, -0.02, 0]); cpt('rsh', [-0.43, -0.02, 0]);
    cpt('lwr', [0.34, -0.06, 0.34]); cpt('rwr', [-0.34, -0.06, 0.34]);
    cpt('lkn', [0.03, -0.02, 0.35]); cpt('rkn', [-0.03, -0.02, 0.35]);
    this.ctrl.position.set(0.9, 2.55, 0);
    S.add(this.ctrl);
    // the pointer: the classic arrow, extruded, cobalt, tip on the control (dragging it)
    const sh = new THREE.Shape();
    const A = [[0, 0], [0, -17], [4, -13], [7, -20], [10, -19], [7, -12], [12, -12]] as const;
    sh.moveTo(A[0][0], A[0][1]);
    for (const [x, y] of A.slice(1)) sh.lineTo(x, y);
    sh.closePath();
    const pg = new THREE.ExtrudeGeometry(sh, { depth: 1.6, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.45, bevelSegments: 3 });
    pg.scale(0.03, 0.03, 0.03);
    const pm = toon(HEX.cobalt, { emissive: new THREE.Color(HEX.cobalt), emissiveIntensity: 0.35 });
    const ptr = new THREE.Mesh(pg, pm);
    ptr.castShadow = true;
    outline(ptr, 3, HEX.ink, true);
    this.cursor.add(ptr);
    S.add(this.cursor);
    // the strings
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(7 * 2 * 3), 3));
    this.strings = new THREE.LineSegments(sg, new THREE.LineBasicMaterial({ color: new THREE.Color(HEX.cobaltText), transparent: true, opacity: 0.85 }));
    S.add(this.strings);
  }

  /** The pose at time t: from key to key, each snapped in with a puppet's overshoot, plus the hang's sway. */
  private pose(t: number) {
    let i = 0;
    while (i < this.keys.length - 1 && t >= this.keys[i + 1]![0]) i++;
    const [ti, cur] = this.keys[i]!;
    const prev = this.keys[Math.max(0, i - 1)]![1];
    const k = i === 0 ? 1 : springStep(t - ti, 2.6, 0.42);
    const out: Record<string, number> = {};
    for (const key of KEYS) out[key] = (prev[key] ?? 0) + ((cur[key] ?? 0) - (prev[key] ?? 0)) * k;
    // the hang: a slow pendulum, a little head bob
    out.pz! += 0.025 * Math.sin(t * 2.2);
    out.hz! += 0.03 * Math.sin(t * 1.7 + 1);
    out.py! += 0.012 * Math.sin(t * 4.1);
    return out as Required<Pose>;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const p = this.pose(t);
    const J = this.j;
    J.root!.position.set(0.9 + p.px, 0.98 + p.py, 0);
    J.root!.rotation.set(0, p.pyaw, p.pz);
    J.waist!.rotation.set(p.sx, 0, p.sz);
    J.neck!.rotation.set(p.hx, p.hy, p.hz);
    J.lsh!.rotation.set(-p.lsx, 0, p.lsz);
    J.rsh!.rotation.set(-p.rsx, 0, -p.rsz);
    J.lel!.rotation.set(-p.lex, 0, 0);
    J.rel!.rotation.set(-p.rex, 0, 0);
    J.lhip!.rotation.set(-p.lhx, 0, 0);
    J.rhip!.rotation.set(-p.rhx, 0, 0);
    J.lkn!.rotation.set(p.lkx, 0, 0);
    J.rkn!.rotation.set(p.rkx, 0, 0);
    J.lan!.rotation.set(-p.lkx * 0.3, 0, 0);
    J.ran!.rotation.set(-p.rkx * 0.3, 0, 0);
    // the control follows him (it's what moves him): tilted by the pose, leading the steps
    this.ctrl.position.set(0.9 + p.px * 1.1, 2.55 + p.py * 1.5 + 0.03 * Math.sin(t * 2.2), 0.02);
    this.ctrl.rotation.set(-p.sx * 0.5 + (p.lsx + p.rsx) * 0.04, p.pyaw * 0.6, (p.rsz - p.lsz) * 0.06 + p.pz * 1.5 + p.hz * 0.2);
    this.scene.updateMatrixWorld(true);
    const tip = new THREE.Vector3(0.02, 0.0, 0.5).applyMatrix4(this.ctrl.matrixWorld); // in front of the bars: it grips the control
    this.cursor.position.copy(tip);
    this.cursor.rotation.set(0, -0.25, 0.08 * Math.sin(t * 1.3));
    // the strings: control → body
    const pos = this.strings.geometry.getAttribute('position') as THREE.BufferAttribute;
    const a = new THREE.Vector3(), b = new THREE.Vector3();
    ['head', 'lsh', 'rsh', 'lwr', 'rwr', 'lkn', 'rkn'].forEach((n, i) => {
      this.cp[n]!.getWorldPosition(a); this.mk[n]!.getWorldPosition(b);
      pos.setXYZ(i * 2, a.x, a.y, a.z); pos.setXYZ(i * 2 + 1, b.x, b.y, b.z);
    });
    pos.needsUpdate = true;
    // the camera: a slow push in and a small orbit (so he reads in 3D)
    const u = prog(t, this.ctx.start, this.ctx.end);
    const yaw = -0.2 + 0.32 * ease.inOutQuad(u), dist = 7.0 - 0.5 * u;
    const look = new THREE.Vector3(0.3, 1.62, 0);
    this.cam.position.set(look.x + Math.sin(yaw) * dist, 1.7 + 0.1 * u, Math.cos(yaw) * dist);
    this.cam.lookAt(look);

    // back: a faint cobalt haze up where the control is
    const c = this.back.ctx;
    this.back.clear(col('ink'));
    const g = c.createRadialGradient(1300, 0, 30, 1300, 200, 900);
    g.addColorStop(0, col('cobalt', 0.16)); g.addColorStop(1, col('cobalt', 0));
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    this.back.upload();
    clearRT(renderer, out, LIN.ink);
    comp.draw(renderer, this.back.texture, out);
    clearRT(renderer, this.rt, [0, 0, 0], 0);
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.cam);
    comp.draw(renderer, this.rt.texture, out, { premult: false });

    // the lyric
    const d = this.front.ctx;
    this.front.clear();
    if (t < this.l2.start - 0.15) this.weird(d, t);
    else if (t < this.l3.start - 0.1) this.steered(d, t);
    else this.reassure(d, t);
    this.front.upload();
    comp.draw(renderer, this.front.texture, out);
    return { bloom: 0.45, bloomThreshold: 1.15, vignette: 0.45, grain: 0.055, zoom: 1 + Math.pow(1 - f.beatPhase, 3) * 0.005 };
  }

  /** IT'S GETTING WEIRD: the letters of WEIRD bend on a wave that grows as it's sung. */
  private weird(c: CanvasRenderingContext2D, t: number) {
    const ws = this.l1.words;
    wordRow(c, ws.slice(0, 2), t, 132, 330, 90);
    const w = ws[2]!;
    const size = 210, fam = TYPE.humanFamily(100, 900), label = 'WEIRD';
    const lay = layout(label, fam, size);
    const k = ease.outCubic(prog(t, w.start, w.end + 0.4));
    c.font = TYPE.human(size, 100, 900);
    lay.glyphs.forEach((g, i) => {
      c.save();
      c.translate(126 + g.x + g.w / 2, 560 + Math.sin(t * 5 + i * 1.1) * 26 * k);
      c.rotate(Math.sin(t * 3.3 + i * 1.7) * 0.2 * k);
      c.transform(1, 0, Math.sin(t * 2 + i) * 0.25 * k, 1, 0, 0);
      c.fillStyle = col('bone', wordAlpha(w, t));
      c.fillText(g.ch, -g.w / 2, 0);
      c.restore();
    });
  }

  /** STEERED BY A GHOST: each word hangs from its own string, down from the rig above the frame. */
  private steered(c: CanvasRenderingContext2D, t: number) {
    const ws = this.l2.words;
    wordRow(c, ws.slice(0, 2), t, 132, 300, 80);
    ws.slice(2).forEach((w: Word, i) => {
      const st = wordState(w, t);
      if (st.pre <= 0) return;
      const drop = ease.outBack(clamp((t - w.start + 0.05) / 0.35));
      const spots: [number, number][] = [[132, 450], [520, 520], [690, 450], [124, 720]];
      const [x0s, y0s] = spots[Math.min(i, spots.length - 1)]!;
      const size = /ghost/i.test(w.w) ? 210 : 96;
      const x = x0s, y = y0s + drop * 40 + Math.sin(t * 2.5 + i) * 8;
      const mid = x + measure(w.w.toUpperCase(), TYPE.humanFamily(75, 900), size) / 2;
      c.strokeStyle = col('cobaltText', 0.6);
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(mid + 30 * Math.sin(t * 1.3 + i), 0); c.lineTo(mid, y - size * 0.75); c.stroke();
      c.font = TYPE.human(size, 75, 900);
      c.fillStyle = col(/ghost/i.test(w.w) ? 'cobaltText' : 'bone', wordAlpha(w, t));
      c.fillText(w.w.toUpperCase(), x, y);
    });
  }

  /** TRYING TO LET ME KNOW / IT'S NOT THAT BAD, typed as soft reassuring ghost text. */
  private reassure(c: CanvasRenderingContext2D, t: number) {
    const ws = this.l3.words;
    const it = ws.findIndex((w) => /it’s/i.test(w.w));
    wordRow(c, ws.slice(0, it), t, 132, 330, 80);
    const soft = ws.slice(it);
    let x = 132;
    c.font = TYPE.ai(64, 400);
    for (const w of soft) {
      const a = wordState(w, t).on;
      c.fillStyle = col('cobaltText', 0.25 + 0.6 * a);
      c.fillText(w.w, x, 470);
      x += measure(w.w + ' ', TYPE.aiFamily(400), 64);
    }
    const last = soft[soft.length - 1]!;
    if (t >= last.start && cursorOn(t)) { c.fillStyle = col('cobalt'); c.fillRect(x, 420, 30, 58); }
    c.font = TYPE.ai(22, 500);
    c.fillStyle = col('steel', 0.6 * clamp((t - last.end) * 3));
    c.fillText('// it’s fine', 132, 530);
  }
}
