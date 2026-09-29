// Bridge 2a, "And I could go, to the data center near my death / And just laugh with the
// server cooling fans as I take my last breath": a slow dolly down a real (3D) data-center aisle. The
// racks are built from actual units: 1U and 2U servers with drive caddies and pull tags, switches with
// rows of ports, 4U fan trays whose rotors spin, blanking panels; a perforated cold-aisle floor
// breathing blue; light bars overhead. It evolves: status LEDs blink cobalt, then more and more turn
// error red ("near my death"); the fans speed up ("laugh"), and on "last breath" the lights go out bar
// by bar down the aisle, the LEDs die, the fans spin down, and what's left is what was at the end of
// the aisle all along: a headstone in a single warm spotlight. HERE LIES A HUMAN — he was happy to be
// here. (Someone left him a coffee.)
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { Layer2D, W, H, clearRT, makeRT } from '../engine/gl';
import { HEX, LIN } from '../engine/palette';
import { clamp, ease, hash, mulberry32, prog } from '../engine/util';
import { F, font, layout } from '../engine/type';
import type { Line } from '../engine/lyrics';
import { TYPE, col, wordAlpha, wordRow } from './_look';
import { outline, toon } from './_toon';

const U = 0.0445; // one rack unit (m)
const RACKS = 40, RW = 0.6, AX = 0.62; // racks per side, rack width (along z), the aisle half-width
const Z0 = 1.2; // the first rack's near edge
const STONE_Z = Z0 - RACKS * RW - 0.8; // the headstone, past the end of the aisle
const BARS = 22;
const END = 2.75; // the camera's final distance from the headstone

type Kind = 's1' | 's2' | 'sw' | 'fan' | 'blank';
const KIND_U: Record<Kind, number> = { s1: 1, s2: 2, sw: 1, fan: 4, blank: 1 };

/** A unit's front panel, drawn on a canvas (512 px across the 0.56 m front). */
function front(kind: Kind) {
  const hU = KIND_U[kind];
  const cv = document.createElement('canvas');
  cv.width = 512; cv.height = Math.round(512 * (hU * U) / 0.56);
  const c = cv.getContext('2d')!;
  const w = cv.width, h = cv.height;
  c.fillStyle = '#1b1e24'; c.fillRect(0, 0, w, h);
  // rack ears with screws
  c.fillStyle = '#2b2f37'; c.fillRect(0, 0, 18, h); c.fillRect(w - 18, 0, 18, h);
  c.fillStyle = '#0c0d10';
  for (let y = h / (hU * 2); y < h; y += h / hU) { c.beginPath(); c.arc(9, y, 3, 0, 7); c.fill(); c.beginPath(); c.arc(w - 9, y, 3, 0, 7); c.fill(); }
  // bezel edge
  c.strokeStyle = '#3a3f49'; c.lineWidth = 2; c.strokeRect(20, 1, w - 40, h - 2);
  if (kind === 's1' || kind === 's2') {
    const rows = kind === 's1' ? 1 : 2, n = kind === 's1' ? 8 : 6;
    const bw = kind === 's1' ? 38 : 58, bh = (h - 10) / rows - 4;
    for (let r = 0; r < rows; r++) for (let i = 0; i < n; i++) {
      const x = 34 + i * (bw + 5), y = 5 + r * (bh + 4);
      c.fillStyle = '#262a31'; c.fillRect(x, y, bw, bh);
      c.fillStyle = '#121418'; c.fillRect(x + 3, y + 3, bw - 6, bh * 0.55);
      c.fillStyle = '#4a505b'; c.fillRect(x + 4, y + bh - 6, bw - 8, 2); // the latch
    }
    // vent grille
    const gx = 34 + n * (bw + 5) + 8;
    c.fillStyle = '#0d0f12';
    for (let y = 6; y < h - 4; y += 6) for (let x = gx; x < w - 90; x += 6) c.fillRect(x, y, 3, 3);
    // pull tag and power
    c.fillStyle = '#c9ccd2'; c.fillRect(w - 80, h / 2 - 7, 34, 14);
    c.fillStyle = '#6a707a'; c.fillRect(w - 76, h / 2 - 3, 22, 2); c.fillRect(w - 76, h / 2 + 1, 16, 2);
    c.strokeStyle = '#5b616c'; c.lineWidth = 2; c.beginPath(); c.arc(w - 32, h / 2, 6, 0, 7); c.stroke();
  } else if (kind === 'sw') {
    for (let r = 0; r < 2; r++) for (let i = 0; i < 24; i++) {
      const x = 40 + i * 15 + Math.floor(i / 6) * 6, y = 5 + r * ((h - 8) / 2);
      c.fillStyle = '#3b404a'; c.fillRect(x, y, 12, (h - 14) / 2);
      c.fillStyle = '#07080a'; c.fillRect(x + 2, y + 2, 8, (h - 14) / 2 - 4);
    }
    c.fillStyle = '#c9ccd2'; c.fillRect(w - 110, 8, 60, h - 16);
  } else if (kind === 'fan') {
    for (const cx of [w * 0.3, w * 0.7]) {
      const r = h * 0.43;
      c.fillStyle = '#07080a'; c.beginPath(); c.arc(cx, h / 2, r, 0, 7); c.fill();
      c.strokeStyle = '#353a44'; c.lineWidth = 3;
      for (const k of [1, 0.72, 0.44]) { c.beginPath(); c.arc(cx, h / 2, r * k, 0, 7); c.stroke(); }
    }
    c.fillStyle = '#c9ccd2'; c.fillRect(w / 2 - 20, h - 22, 40, 12);
  } else {
    c.fillStyle = '#15171b';
    for (let y = 5; y < h - 4; y += 7) for (let x = 30; x < w - 30; x += 7) c.fillRect(x, y, 3, 3);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** The headstone's face: engraved type (a light lower lip under each dark cut). */
function epitaph() {
  const cv = document.createElement('canvas');
  cv.width = 620; cv.height = 900;
  const c = cv.getContext('2d')!;
  c.textAlign = 'center';
  const cut = (s: string, y: number, f: string) => {
    c.font = f;
    c.fillStyle = 'rgba(240,232,220,0.55)'; c.fillText(s, 313, y + 3);
    c.fillStyle = 'rgba(16,15,14,0.96)'; c.fillText(s, 310, y);
  };
  cut('HERE LIES', 330, font(F.archivo(100, 700), 64));
  cut('A HUMAN', 440, font(F.archivo(75, 900), 104));
  c.fillStyle = 'rgba(28,26,24,0.7)'; c.fillRect(200, 490, 220, 4);
  cut('he was happy', 590, font(F.serif(600, true), 76));
  cut('to be here', 670, font(F.serif(600, true), 76));
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function tileTex() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 256;
  const c = cv.getContext('2d')!;
  const e = document.createElement('canvas');
  e.width = e.height = 256;
  const ec = e.getContext('2d')!;
  c.fillStyle = '#2a2d33'; c.fillRect(0, 0, 256, 256);
  ec.fillStyle = '#000'; ec.fillRect(0, 0, 256, 256);
  c.strokeStyle = '#15171a'; c.lineWidth = 4; c.strokeRect(0, 0, 256, 256);
  for (let y = 24; y < 240; y += 14) for (let x = 24; x < 240; x += 14) {
    c.fillStyle = '#0b0c0e'; c.beginPath(); c.arc(x, y, 3.5, 0, 7); c.fill();
    ec.fillStyle = '#fff'; ec.beginPath(); ec.arc(x, y, 3.5, 0, 7); ec.fill();
  }
  const map = new THREE.CanvasTexture(cv), em = new THREE.CanvasTexture(e);
  map.colorSpace = THREE.SRGBColorSpace;
  for (const t of [map, em]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(3, 78); t.anisotropy = 8; }
  return { map, em };
}

interface Led { unit: number; side: number; z: number; y: number; rack: number; h: number }

export default class Aisle extends Scene {
  layer = new Layer2D();
  rt!: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(42, W / H, 0.05, 60);
  leds!: THREE.InstancedMesh;
  ledData: Led[] = [];
  rotors!: THREE.InstancedMesh;
  rotorPos: { p: THREE.Vector3; side: number; h: number }[] = [];
  bars: THREE.Mesh[] = [];
  barLights: THREE.PointLight[] = [];
  floorMat!: THREE.MeshToonMaterial;
  spot!: THREE.SpotLight;
  beamMat!: THREE.ShaderMaterial;
  beam!: THREE.Mesh;
  l1!: Line; l2!: Line; lb!: Line['words'][number];
  tmp = new THREE.Object3D();
  col3 = new THREE.Color();

  override init() {
    const ly = this.ctx.lyrics;
    this.l1 = ly.get('data center near my death');
    this.l2 = ly.get('cooling fans');
    this.lb = this.l2.words.find((w) => /^as$/i.test(w.w))!; // the lights go out "as I take my…"
    this.rt = makeRT(W, H, { samples: 4 });
    const { renderer } = this.ctx;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.cam.setViewOffset(W, H, -330, 0, W, H); // the vanishing point right of centre (the type is left)

    const S = this.scene;
    S.fog = new THREE.FogExp2(new THREE.Color(HEX.ink), 0.075);
    S.add(new THREE.HemisphereLight(new THREE.Color('#9fb0d8'), new THREE.Color(HEX.ink), 0.25));
    const rnd = mulberry32(21);

    // floor (perforated tiles, cold air glowing through) and ceiling
    const tt = tileTex();
    this.floorMat = toon('#ffffff', { map: tt.map, emissiveMap: tt.em, emissive: new THREE.Color(HEX.cobalt), emissiveIntensity: 0.3 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(1.8, RACKS * RW + 4), this.floorMat);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, Z0 - (RACKS * RW) / 2);
    floor.receiveShadow = true;
    S.add(floor);
    const dark = toon('#121317');
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), dark);
    ground.rotation.x = -Math.PI / 2; ground.position.y = -0.002; ground.receiveShadow = true;
    S.add(ground);

    // the racks: a dark body each, filled with units bottom to top
    const bodyGeo = new THREE.BoxGeometry(1.0, 2.02, RW - 0.012);
    const bodyMat = toon('#101116');
    const kinds: Kind[] = ['s1', 's2', 'sw', 'fan', 'blank'];
    const place: Record<Kind, THREE.Matrix4[]> = { s1: [], s2: [], sw: [], fan: [], blank: [] };
    let unitId = 0;
    for (const side of [-1, 1]) for (let r = 0; r < RACKS; r++) {
      const zc = Z0 - (r + 0.5) * RW;
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.set(side * (AX + 0.5 + 0.004), 1.01, zc);
      body.receiveShadow = true;
      S.add(body);
      let u = 2;
      const stack: Kind[] = ['sw', 'blank'];
      while (u < 40) {
        const x = rnd();
        const k: Kind = u > 16 && u < 26 && !stack.includes('fan') ? 'fan' : x < 0.42 ? 's1' : x < 0.78 ? 's2' : x < 0.86 ? 'sw' : 'blank';
        if (u + KIND_U[k] > 41) break;
        stack.push(k);
        u += KIND_U[k];
      }
      let y = 2.0 - 0.05; // top of the usable space, stacking down
      for (const k of stack) {
        const hh = KIND_U[k] * U;
        y -= hh;
        const m = new THREE.Matrix4().compose(new THREE.Vector3(side * (AX + 0.45), y + hh / 2, zc), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side > 0 ? Math.PI : 0), new THREE.Vector3(1, 1, 1));
        place[k].push(m);
        // status LEDs on the unit's face (local: z across the front, y up)
        const nL = k === 'blank' ? 0 : k === 'sw' ? 6 : k === 'fan' ? 1 : 3;
        for (let i = 0; i < nL; i++) {
          const lz = k === 'sw' ? -0.2 + i * 0.07 : 0.2 - i * 0.022;
          this.ledData.push({ unit: unitId, side, z: zc + lz * (side > 0 ? 1 : -1) * -1, y: y + hh * (k === 'sw' ? 0.8 : 0.5), rack: r, h: hash(unitId, i + 3) });
        }
        if (k === 'fan') for (const fz of [-0.112, 0.112]) this.rotorPos.push({ p: new THREE.Vector3(side * (AX - 0.002), y + hh / 2, zc + fz), side, h: hash(unitId, 9) });
        unitId++;
      }
    }
    for (const k of kinds) {
      const tex = front(k);
      const faceMat = toon('#ffffff', { map: tex });
      const g = new THREE.BoxGeometry(0.9, KIND_U[k] * U * 0.985, 0.56);
      // front = +x face: the canvas's left edge sits at -z, like looking at it
      const im = new THREE.InstancedMesh(g, [faceMat, bodyMat, bodyMat, bodyMat, bodyMat, bodyMat], place[k].length);
      place[k].forEach((m, i) => im.setMatrixAt(i, m));
      im.receiveShadow = true;
      S.add(im);
    }
    // LEDs: tiny unlit squares, colour per frame
    const ledGeo = new THREE.PlaneGeometry(0.009, 0.006);
    ledGeo.rotateY(Math.PI / 2);
    this.leds = new THREE.InstancedMesh(ledGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), this.ledData.length);
    this.ledData.forEach((l, i) => {
      this.tmp.position.set(l.side * (AX - 0.003), l.y, l.z);
      this.tmp.rotation.set(0, l.side > 0 ? Math.PI : 0, 0);
      this.tmp.updateMatrix();
      this.leds.setMatrixAt(i, this.tmp.matrix);
      this.leds.setColorAt(i, this.col3.setRGB(0, 0, 0));
    });
    S.add(this.leds);
    // fan rotors (7 swept blades), spun per frame
    const blade = new THREE.Shape();
    blade.moveTo(0.012, 0);
    blade.quadraticCurveTo(0.045, 0.04, 0.08, 0.018);
    blade.quadraticCurveTo(0.06, -0.02, 0.012, -0.022);
    const bg = new THREE.ExtrudeGeometry(blade, { depth: 0.004, bevelEnabled: false });
    const parts: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 7; i++) parts.push(bg.clone().rotateZ((i / 7) * Math.PI * 2));
    parts.push(new THREE.CylinderGeometry(0.02, 0.02, 0.01, 20).rotateX(Math.PI / 2));
    const rotorGeo = mergeGeos(parts);
    rotorGeo.rotateY(Math.PI / 2);
    this.rotors = new THREE.InstancedMesh(rotorGeo, toon('#30343c'), this.rotorPos.length);
    S.add(this.rotors);
    // overhead cable trays and the light bars (with a light each)
    const trayMat = toon('#1a1c21');
    for (const side of [-1, 1]) {
      const tray = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.06, RACKS * RW), trayMat);
      tray.position.set(side * 0.95, 2.35, Z0 - (RACKS * RW) / 2);
      S.add(tray);
    }
    for (let i = 0; i < BARS; i++) {
      const z = Z0 - 0.3 - i * ((RACKS * RW - 0.6) / (BARS - 1));
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.025, 0.9), new THREE.MeshBasicMaterial({ color: new THREE.Color(HEX.bone), toneMapped: false }));
      bar.position.set(0, 2.55, z);
      S.add(bar);
      this.bars.push(bar);
      if (i % 2 === 0) {
        const pl = new THREE.PointLight(new THREE.Color('#c8d2ea'), 2.2, 4.5, 1.6);
        pl.position.set(0, 2.4, z);
        S.add(pl);
        this.barLights.push(pl);
      }
    }

    // the headstone, at the end of the aisle, in its own warm light
    const stone = toon('#8d887f');
    const sh = new THREE.Shape();
    const sw = 0.62, shh = 0.92;
    sh.moveTo(-sw / 2, 0); sh.lineTo(sw / 2, 0); sh.lineTo(sw / 2, shh - sw / 2);
    sh.absarc(0, shh - sw / 2, sw / 2, 0, Math.PI, false);
    sh.lineTo(-sw / 2, 0);
    const sg = new THREE.ExtrudeGeometry(sh, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 3, curveSegments: 32 });
    const head = new THREE.Mesh(sg, stone);
    head.position.set(0, 0.12, STONE_Z - 0.06);
    head.castShadow = true; head.receiveShadow = true;
    outline(head, 2.6, HEX.ink, true);
    S.add(head);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * (900 / 620)), toon('#ffffff', { map: epitaph(), transparent: true }));
    face.position.set(0, 0.12 + (sw * (900 / 620)) / 2 - 0.02, STONE_Z + 0.077);
    S.add(face);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.86, 0.12, 0.34), stone);
    base.position.set(0, 0.06, STONE_Z);
    base.castShadow = true; base.receiveShadow = true;
    outline(base, 2.6, HEX.ink, true);
    S.add(base);
    // the coffee
    const mugMat = toon(HEX.bone);
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.036, 0.095, 28), mugMat);
    mug.position.set(0.24, 0.12 + 0.048, STONE_Z + 0.1);
    mug.castShadow = true;
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.007, 10, 20), mugMat);
    handle.position.set(0.24 + 0.045, 0.12 + 0.05, STONE_Z + 0.1);
    handle.castShadow = true;
    outline(mug, 2); outline(handle, 1.5);
    S.add(mug, handle);
    // a single red rose in it
    const rose = new THREE.Group();
    rose.position.set(0.24, 0.19, STONE_Z + 0.1);
    rose.rotation.z = 0.28; rose.rotation.x = 0.12;
    const green = toon('#3f6b40'), red = toon(HEX.error);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.3, 8), green);
    stem.position.y = 0.15; rose.add(stem);
    for (const [y, sgn] of [[0.12, 1], [0.19, -1]] as const) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), green);
      leaf.scale.set(0.028, 0.006, 0.012); leaf.position.set(sgn * 0.022, y, 0); leaf.rotation.z = sgn * 0.5;
      rose.add(leaf); outline(leaf, 1.2);
    }
    const bloom = new THREE.Group(); bloom.position.y = 0.31; rose.add(bloom);
    const bud = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), red);
    bud.scale.set(0.024, 0.03, 0.024); bloom.add(bud); outline(bud, 1.4);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      const petal = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), red);
      petal.scale.set(0.022, 0.026, 0.009);
      petal.position.set(Math.cos(a) * 0.02, -0.006, Math.sin(a) * 0.02);
      petal.rotation.set(0, -a + Math.PI / 2, 0); petal.rotateX(-0.55);
      petal.castShadow = true; bloom.add(petal); outline(petal, 1.2);
    }
    rose.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = true; });
    S.add(rose);
    this.spot = new THREE.SpotLight(new THREE.Color('#ffe6c4'), 0, 0, 0.2, 0.3, 0);
    this.spot.position.set(0.08, 3.6, STONE_Z + 0.75);
    this.spot.target.position.set(0, 0.45, STONE_Z);
    this.spot.castShadow = true;
    this.spot.shadow.mapSize.set(1024, 1024);
    this.spot.shadow.bias = -0.0005;
    S.add(this.spot, this.spot.target);
    const beamGeo = new THREE.ConeGeometry(0.72, 3.5, 48, 1, true);
    beamGeo.translate(0, -1.75, 0);
    // the beam: a cone that fades along its length and toward its silhouette edges (a fake volume)
    this.beamMat = new THREE.ShaderMaterial({
      uniforms: { k: { value: 0 }, color: { value: new THREE.Color('#ffe6c4') } },
      vertexShader: /* glsl */ `varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { vY = uv.y; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */ `uniform float k; uniform vec3 color; varying float vY; varying vec3 vN; varying vec3 vV;
        void main() { float edge = pow(abs(dot(normalize(vN), normalize(vV))), 2.0); float fall = mix(0.2, 1.0, vY);
          gl_FragColor = vec4(color * 0.09 * k * edge * fall, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    this.beam = new THREE.Mesh(beamGeo, this.beamMat);
    this.beam.position.copy(this.spot.position);
    this.beam.lookAt(this.spot.target.position);
    this.beam.rotateX(-Math.PI / 2);
    S.add(this.beam);
  }

  /** Fan rotor angle: integrated speed (base, faster once LAUGH is sung, spinning down on LAST BREATH). */
  private spin(t: number) {
    const laugh = this.l2.words.find((w) => /laugh/i.test(w.w))!.start;
    const speed = (x: number) => (9 + 22 * ease.inOutCubic(prog(x, laugh - 0.2, laugh + 0.6))) * Math.exp(-Math.max(0, x - this.lb.start - 0.3) * 1.6);
    let a = 0;
    for (let x = this.ctx.start; x < t; x += 1 / 120) a += speed(x) / 120;
    return a;
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer, comp } = this.ctx;
    const t = f.t;
    const s0 = this.ctx.start, s1 = this.ctx.end;
    const death = this.l1.words.find((w) => /death/i.test(w.w))!.start;
    const fans0 = this.l2.words.find((w) => /fans/i.test(w.w))!;
    const lb = (fans0.start + fans0.end) / 2 - 0.15; // the lights die just as we stop at the headstone
    // the dolly: already moving on the first frame, accelerating down the (long) aisle, then a hard
    // stop at the headstone mid-"fans", so it holds there through the lights going out, the spotlight
    // and LAST BREATH (and on into the dissolve to the agents)
    const fans = this.l2.words.find((w) => /fans/i.test(w.w))!;
    const arrive = (fans.start + fans.end) / 2;
    const x = prog(t, s0, arrive), K = 0.88, v0 = 0.35;
    const b = (1 - v0 * K - (v0 * (1 - K)) / 2) / (K ** 3 + 1.5 * K * K * (1 - K)), B = (v0 + 3 * b * K * K) / (2 * (1 - K));
    const u = x < K ? v0 * x + b * x ** 3 : 1 - B * (1 - x) ** 2;
    const camZ = Z0 - 0.6 + (STONE_Z + END - (Z0 - 0.6)) * u; // (starts inside the aisle: the rows' end caps stay behind us)
    // the camera tilts down to the headstone as soon as it comes out of the fog, all the way in
    const near = ease.inOutQuad(clamp((13 - (camZ - STONE_Z)) / (13 - END)));
    this.cam.position.set(-0.08 + 0.02 * Math.sin(t * 0.7) * (1 - near), 1.5 - 0.55 * near + 0.006 * f.a.kick * (1 - near), camZ);
    // (the look point moves from down the aisle to the headstone's middle: the whole stone in frame)
    this.cam.lookAt(0, 1.35 + (0.56 - 1.35) * near, camZ - 4 + (STONE_Z - (camZ - 4)) * near);
    // lights out: bar by bar down the aisle from "last breath", each with a flicker
    const offAt = (i: number) => lb + 0.05 + Math.max(0, i - (BARS - 7)) * 0.1; // (the ones behind the camera go at once)
    const alive = (i: number) => {
      const x = t - offAt(i);
      if (x < -0.12) return 1;
      if (x < 0) return hash(i, Math.floor(t * 40)) > 0.5 ? 1 : 0.15;
      return 0;
    };
    this.bars.forEach((b, i) => { const m = b.material as THREE.MeshBasicMaterial; m.color.set(HEX.bone).multiplyScalar(1.05 * alive(i) + 0.02); });
    this.barLights.forEach((l, i) => (l.intensity = 2.2 * alive(i * 2)));
    this.floorMat.emissiveIntensity = 0.3 * (1 - 0.85 * prog(t, lb, lb + 1.0));
    // the headstone's light: faint from the start (it's been there all along), full once the rest is dark
    // the spotlight: in the dark after the lights die, a hard theatre spot from straight above,
    // clunking on at LAST (a two-frame stutter), and staying
    const last = lb + 0.4; // (right after the lights die, as the camera settles)
    const on = t < last - 0.04 ? 0 : t < last + 0.05 ? (hash(Math.floor(t * 60), 3) > 0.4 ? 1 : 0.2) : 1;
    this.spot.intensity = 4.2 * on;
    this.beamMat.uniforms.k!.value = on;
    // the LEDs: blinking cobalt, failing red more and more, dying with the lights
    const fail = 0.08 + 0.8 * prog(t, death - 0.3, lb, ease.inQuad);
    const C = { blue: new THREE.Color(HEX.cobaltText), amber: new THREE.Color(HEX.ember), red: new THREE.Color(HEX.error) };
    this.ledData.forEach((l, i) => {
      const barIdx = clamp(Math.round(((Z0 - 0.3 - l.z) / (RACKS * RW - 0.6)) * (BARS - 1)), 0, BARS - 1);
      const dead = t > offAt(barIdx) + 0.05 + l.h * 0.4;
      let c = this.col3.setRGB(0, 0, 0);
      if (!dead) {
        const red = l.h < fail;
        const rate = red ? 7 : 2 + l.h * 9;
        const on = red ? Math.floor(t * rate + l.h * 10) % 2 === 0 : hash(i, Math.floor(t * rate + l.h * 10)) > 0.35;
        const base = red ? C.red : l.h > 0.9 ? C.amber : C.blue;
        c = this.col3.copy(base).multiplyScalar(on ? 3.2 : 0.12);
      }
      this.leds.setColorAt(i, c);
    });
    this.leds.instanceColor!.needsUpdate = true;
    const ang = this.spin(t);
    this.rotorPos.forEach((r, i) => {
      this.tmp.position.copy(r.p);
      this.tmp.rotation.set(0, 0, 0);
      this.tmp.rotateY(r.side > 0 ? Math.PI : 0);
      this.tmp.rotateX(ang * (1 + r.h * 0.3));
      this.tmp.updateMatrix();
      this.rotors.setMatrixAt(i, this.tmp.matrix);
    });
    this.rotors.instanceMatrix.needsUpdate = true;

    clearRT(renderer, out, LIN.ink);
    clearRT(renderer, this.rt, LIN.ink, 1);
    renderer.setRenderTarget(this.rt);
    renderer.render(this.scene, this.cam);
    comp.draw(renderer, this.rt.texture, out, { premult: false });

    // the type (gone once BREATH is out, so the dissolve into the agents is just the headstone)
    const c = this.layer.ctx;
    this.layer.clear();
    const breathEnd = this.l2.words[this.l2.words.length - 1]!.end;
    c.globalAlpha = 1 - prog(t, breathEnd - 0.05, breathEnd + 0.2);
    const band = (y0: number, y1: number) => { const gg = c.createLinearGradient(0, 0, 1300, 0); gg.addColorStop(0, col('ink', 0.7)); gg.addColorStop(1, col('ink', 0)); c.fillStyle = gg; c.fillRect(0, y0, 1300, y1 - y0); };
    if (t < this.l2.start - 0.15) {
      const ws = this.l1.words;
      const to = ws.findIndex((w) => /^to$/i.test(w.w)), near = ws.findIndex((w) => /near/i.test(w.w));
      band(600, 1060);
      wordRow(c, ws.slice(0, to), t, 132, 720, 72);
      wordRow(c, ws.slice(to, near), t, 132, 830, 84, { width: 100, weight: 800 });
      wordRow(c, ws.slice(near), t, 124, 990, 150, { width: 75, weight: 900, color: () => 'error' });
    } else {
      const ws = this.l2.words;
      const server = ws.findIndex((w) => /server/i.test(w.w)), as = ws.findIndex((w) => /^as$/i.test(w.w)), last = ws.findIndex((w) => /last/i.test(w.w));
      band(560, 1060);
      wordRow(c, ws.slice(0, server), t, 132, 660, 64);
      wordRow(c, ws.slice(server, as), t, 124, 790, 96, { width: 75, weight: 900 });
      wordRow(c, ws.slice(as, last), t, 132, 890, 64);
      this.lastBreath(c, t, ws.slice(last), 124, 1010);
      // the fans laugh: HA puffs on the beat once LAUGH is sung (until the fans die)
      const laugh = ws.find((w) => /laugh/i.test(w.w))!;
      if (t >= laugh.start) {
        for (let k = 0; k < 6; k++) {
          const tb = this.ctx.audio.timeOfBeat(Math.floor(f.beat) - k);
          const age = t - tb;
          if (age < 0 || tb < laugh.start || tb > lb + 0.2) continue;
          const side = (Math.floor(f.beat) - k) % 2 ? -1 : 1;
          const a = clamp(1 - age / 1.2);
          c.font = TYPE.ai(40 + age * 30, 700);
          c.fillStyle = col('steel', a * 0.8);
          c.textAlign = 'center';
          c.fillText('HA', 1190 + side * (300 + age * 320), 380 - age * 40);
          c.textAlign = 'left';
        }
      }
    }
    c.globalAlpha = 1;
    this.layer.upload();
    comp.draw(renderer, this.layer.texture, out);
    void s1;
    return { bloom: 0.45, bloomThreshold: 1.2, halation: 0.12, vignette: 0.5, grain: 0.055 };
  }

  /** LAST BREATH: letter by letter blown out (toward the fans) once it's been sung. */
  private lastBreath(c: CanvasRenderingContext2D, t: number, ws: Line['words'], x: number, y: number) {
    const label = ws.map((w) => w.w.toUpperCase()).join(' ');
    const size = 130, fam = TYPE.humanFamily(75, 900);
    const lay = layout(label, fam, size);
    const breath = ws[ws.length - 1]!.start; // blown away on BREATH (the cut is at its end)
    const a = Math.max(...ws.map((w) => wordAlpha(w, t)));
    c.font = TYPE.human(size, 75, 900);
    lay.glyphs.forEach((g, i) => {
      const k = ease.inCubic(clamp((t - breath - 0.02 - i * 0.018) / 0.3));
      c.save();
      c.translate(x + g.x + k * (900 + i * 60), y - k * (120 + (hash(i, 7) - 0.3) * 200));
      c.rotate(k * (hash(i, 8) - 0.5) * 2);
      c.fillStyle = col('bone', a * (1 - k));
      c.fillText(g.ch, 0, 0);
      c.restore();
    });
  }
}

/** Merge non-indexed-compatible geometries (positions/normals only) into one. */
function mergeGeos(gs: THREE.BufferGeometry[]) {
  const ps: number[] = [], ns: number[] = [];
  for (const g0 of gs) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    g.computeVertexNormals();
    ps.push(...(g.getAttribute('position').array as Float32Array));
    ns.push(...(g.getAttribute('normal').array as Float32Array));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(ps, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(ns, 3));
  return out;
}
