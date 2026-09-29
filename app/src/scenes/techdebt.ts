// Intro chorus, "The tech debt's looking dire": a Jenga tower on a dark stage, lit by
// the two lights of the film: FIRE from below (the Human's world, flickering on the kick) and the
// AI's COBALT from above. Toon-banded lighting, no outlines. Old-debt blocks show mono labels on
// their ends; each sung word is a block whose face lights up and slides out along its long axis
// (the Jenga move), top to bottom in reading order. The camera orbits low; the tower sways more
// with every pull; fire burns behind and in front of its foot.
import * as THREE from 'three';
import { Scene, type Frame } from '../engine/scene';
import { FSPass, W, H, PW, PH, makeRT, clearRT } from '../engine/gl';
import { HEX } from '../engine/palette';
import { clamp, ease, mulberry32, noise1, prog, springStep } from '../engine/util';
import { font, F } from '../engine/type';
import type { Line, Word } from '../engine/lyrics';
import { FIRE_GLSL, wordState } from './_look';

const DEBT = ['TODO', 'HACK', 'v2_final_FINAL', 'FIXME', 'legacy/', '// don’t touch', 'deprecated', 'temp_fix', 'XXX', 'utils2.js', 'TODO(2019)', 'any', 'quick patch', 'wontfix'];
const L = 3, BW = 1, BH = 0.62; // block length, width, height
const SS = 2;

const BG = /* glsl */ `
uniform float t, kick, fireH;
${FIRE_GLSL}
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  float yf = p.y / 1080.0;
  // ink stage: cobalt haze from above, fire glow from below
  vec3 col = C_INK + C_COBALT_DEEP * 0.12 * smoothstep(0.75, 0.0, yf) + C_BLOOD * 0.3 * smoothstep(0.5, 1.0, yf) * (0.9 + 0.3 * kick);
  vec4 f = fireAt(p, 985.0, fireH, t, kick, 4.0);
  col = mix(col, f.rgb, f.a * 0.9);
  fragColor = vec4(col, 1.0);
}`;

const COMP = /* glsl */ `
uniform sampler2D tBg, tScene;
uniform vec2 texel;
uniform float t, kick, fireH;
${FIRE_GLSL}
void main() {
  vec2 p = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec3 col = texture(tBg, vUv).rgb;
  // the 3D pass, 2x2 supersampled (premultiplied alpha)
  vec4 s = vec4(0.0);
  for (int i = 0; i < 4; i++) s += texture(tScene, vUv + (vec2(float(i % 2), float(i / 2)) - 0.5) * texel);
  s *= 0.25;
  col = col * (1.0 - s.a) + s.rgb;
  // foreground flames licking the foot of the tower
  float span = smoothstep(560.0, 160.0, abs(p.x - 960.0));
  vec4 f = fireAt(p, 1100.0, fireH * 0.42 * span, t * 1.2, kick, 9.0);
  col = mix(col, f.rgb, f.a);
  // embers
  for (int i = 0; i < 50; i++) {
    float fi = float(i);
    float life = fract(hash11(fi * 1.3) + t * (0.06 + 0.1 * hash11(fi * 3.7)));
    vec2 e = vec2(560.0 + hash11(fi * 7.1) * 800.0 + sin(t + fi) * 30.0, 1000.0 - life * 900.0);
    float r = 1.3 + 2.0 * hash11(fi * 9.9);
    float d = length(p - e);
    col += C_EMBER * 3.0 * (1.0 - life) * smoothstep(0.0, 0.1, life) * exp(-d * d / (r * r));
  }
  fragColor = vec4(col, 1.0);
}`;

let RAMP: THREE.DataTexture | null = null;
function ramp() {
  if (!RAMP) {
    RAMP = new THREE.DataTexture(new Uint8Array([20, 20, 20, 255, 90, 90, 90, 255, 170, 170, 170, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
    RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
    RAMP.generateMipmaps = false;
    RAMP.needsUpdate = true;
  }
  return RAMP;
}

function faceTex(text: string, o: { w: number; h: number; fnt: string; color: string; align?: CanvasTextAlign }) {
  const cv = document.createElement('canvas');
  cv.width = o.w; cv.height = o.h;
  const c = cv.getContext('2d')!;
  c.fillStyle = '#000';
  c.fillRect(0, 0, o.w, o.h);
  c.font = o.fnt;
  c.fillStyle = o.color;
  c.textAlign = o.align ?? 'center';
  c.textBaseline = 'middle';
  c.fillText(text, o.align === 'left' ? o.h * 0.35 : o.w / 2, o.h / 2 + o.h * 0.04);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

type WordBlock = { mesh: THREE.Mesh; mat: THREE.ShaderMaterial; word: Word; dir: number };

/**
 * The block material: near-black, banded by two opposing lights. FIRE comes from below-left
 * (stronger near the floor, flickering), COBALT from above-right-behind. Faces facing neither stay
 * ink, so the tower reads as a silhouette with lit planes. An optional emissive map carries type.
 */
function blockMat(map: THREE.Texture | null, emissive: number) {
  return new THREE.ShaderMaterial({
    uniforms: {
      map: { value: map }, useMap: { value: map ? 1 : 0 }, emissive: { value: emissive },
      fire: { value: 1 }, cInk: { value: new THREE.Color(HEX.ink2) }, cFire: { value: new THREE.Color(HEX.signal) },
      cEmber: { value: new THREE.Color(HEX.ember) }, cAi: { value: new THREE.Color(HEX.cobalt) }, cType: { value: new THREE.Color(HEX.bone) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() { vUv = uv; vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D map; uniform int useMap; uniform float emissive, fire;
      uniform vec3 cInk, cFire, cEmber, cAi, cType;
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN);
        float low = clamp(1.0 - vW.y / 7.5, 0.0, 1.0);             // fire is stronger near the floor
        vec3 c = cInk * 0.45;
        // planes: tops catch the AI's cobalt, undersides the fire, the far side a cobalt shadow;
        // faces toward the camera stay near-black with a warm glow rising from the floor
        c += cAi * 0.55 * step(0.7, n.y);
        c += (cFire * 0.9 + cEmber * 0.2) * step(0.7, -n.y) * fire;
        c += cAi * 0.05 * step(0.7, n.x);
        c += cFire * 0.18 * low * low * fire * step(0.7, n.z);
        // edge light: a 2-3 px line along each face edge, fire on the lower/left edges, cobalt on
        // the upper/right ones (the two lights raking across the silhouette)
        vec2 px = vec2(min(vUv.x, 1.0 - vUv.x) / fwidth(vUv.x), min(vUv.y, 1.0 - vUv.y) / fwidth(vUv.y));
        float edge = 1.0 - smoothstep(0.8, 2.2, min(px.x, px.y));
        bool warmEdge = (px.y < px.x ? vUv.y < 0.5 : vUv.x < 0.5);
        vec3 ec = warmEdge ? cFire * (0.5 + 1.0 * low) * fire : cAi * 0.9;
        c = mix(c, ec, edge * 0.75);
        if (useMap == 1) { float m = texture(map, vUv).r; c = mix(c, cType * 1.1, m * emissive); }
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
}

export default class TechDebt extends Scene {
  bg!: FSPass;
  comp2!: FSPass;
  rtBg!: THREE.WebGLRenderTarget;
  rtScene!: THREE.WebGLRenderTarget;
  scene = new THREE.Scene();
  cam = new THREE.PerspectiveCamera(36, W / H, 0.1, 100);
  tower = new THREE.Group();
  fireLight = new THREE.PointLight(new THREE.Color(HEX.signal), 60, 30, 1.6);
  words: WordBlock[] = [];
  mats: THREE.ShaderMaterial[] = [];
  line!: Line;

  override init() {
    this.line = this.ctx.lyrics.get('The tech debt', this.ctx.params.nth ?? 0);
    this.rtBg = makeRT();
    this.rtScene = new THREE.WebGLRenderTarget(PW * SS, PH * SS, { type: THREE.HalfFloatType, format: THREE.RGBAFormat, depthBuffer: true });
    const fireU = { t: { value: 0 }, kick: { value: 0 }, fireH: { value: 0 } };
    this.bg = new FSPass(BG, fireU);
    this.comp2 = new FSPass(COMP, { ...fireU, tBg: { value: this.rtBg.texture }, tScene: { value: this.rtScene.texture }, texel: { value: new THREE.Vector2(1 / (PW * SS), 1 / (PH * SS)) } });

    const S = this.scene;
    S.add(new THREE.AmbientLight(new THREE.Color(HEX.ink2), 0.35));
    S.fog = new THREE.Fog(new THREE.Color(HEX.ink), 18, 34);
    const top = new THREE.DirectionalLight(new THREE.Color(HEX.cobalt), 5.0); // the AI's light: from above and behind (tops, far sides)
    top.position.set(5, 14, -8);
    const front = new THREE.DirectionalLight(new THREE.Color(HEX.signal), 2.2); // the fire's light: low, from the front
    front.position.set(-4, 0.5, 10);
    S.add(front);
    S.add(top);
    this.fireLight.position.set(-0.5, 0.2, 3.2); // the fire's light, from below-front
    S.add(this.fireLight);
    const fill = new THREE.PointLight(new THREE.Color(HEX.ember), 12, 12, 1.8);
    fill.position.set(3, 0.2, 2);
    S.add(fill);
    S.add(this.tower);

    const rnd = mulberry32(11);
    let deck: string[] = [];
    const pick = () => { if (!deck.length) deck = [...DEBT].sort(() => rnd() - 0.5); return deck.pop()!; };
    const geoA = new THREE.BoxGeometry(L, BH * 0.97, BW * 0.97); // long axis x (long face to camera)
    const geoB = new THREE.BoxGeometry(BW * 0.97, BH * 0.97, L); // long axis z (end to camera)
    const labelMat = (label: string) => { const m = blockMat(faceTex(label, { w: 256, h: 160, fnt: font(F.mono(500), 30), color: '#fff' }), 0.32); this.mats.push(m); return m; };
    const plain = blockMat(null, 0);
    this.mats.push(plain);
    let y = BH / 2;
    const layerB = () => {
      for (let k = -1; k <= 1; k++) {
        if (y > 1 && rnd() < 0.18) continue; // a missing block
        // the end facing the camera (+z) carries a label; BoxGeometry face order: +x,-x,+y,-y,+z,-z
        const m = new THREE.Mesh(geoB, [plain, plain, plain, plain, labelMat(pick()), plain]);
        m.position.set(k * BW, y, 0);
        this.tower.add(m);
      }
      y += BH;
    };
    const layerA = (w?: Word, idx = 0) => {
      for (let k = -1; k <= 1; k++) {
        let mat: THREE.Material | THREE.Material[] = plain;
        let wb: WordBlock | null = null;
        if (w && k === 1) {
          const m = blockMat(faceTex(w.w.toUpperCase(), { w: 1024, h: 212, fnt: font(F.archivo(112, 900), 150), color: '#fff' }), 0);
          this.mats.push(m);
          mat = [plain, plain, plain, plain, m, plain];
          wb = { mesh: null as unknown as THREE.Mesh, mat: m, word: w, dir: idx % 2 === 0 ? -1 : 1 };
        }
        const mesh = new THREE.Mesh(geoA, mat);
        mesh.position.set(0, y, k * BW);
        this.tower.add(mesh);
        if (wb) { wb.mesh = mesh; this.words.push(wb); }
      }
      y += BH;
    };
    layerB(); layerB();
    const ws = [...this.line.words].reverse();
    ws.forEach((w, i) => { layerA(w, ws.length - 1 - i); layerB(); });
    layerA();

    // floor
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color(HEX.ink) }));
    floor.rotation.x = -Math.PI / 2;
    S.add(floor);
  }

  override render(f: Frame, out: THREE.WebGLRenderTarget) {
    const { renderer } = this.ctx;
    const t = f.t, kick = f.a.kick;
    const words = this.line.words;
    const danger = words.filter((w) => t >= w.start).length / words.length;

    // word blocks: face lights on the word, block slides out along its long axis
    for (const wb of this.words) {
      const st = wordState(wb.word, t);
      wb.mat.uniforms.emissive!.value = 0.1 * st.pre + 0.9 * st.on;
      const pull = st.sung ? springStep(t - wb.word.start + 0.03, 2.2, 0.55) : 0;
      wb.mesh.position.x = wb.dir * pull * L * 0.55;
    }
    // sway, pivoting at the foot; after the line it leans for real
    const sway = (Math.sin(f.beat * Math.PI) * 0.01 + noise1(t * 0.9, 3) * 0.008) * (0.35 + danger * 1.5)
      + prog(t, this.line.end, this.line.end + 1.4, ease.inQuad) * ((this.ctx.params.heat ?? 0) ? 0.5 : 0.06); // chorus 2: it goes over
    this.tower.rotation.z = sway;
    // camera: low orbit, slow push-in
    const k = prog(t, this.ctx.start, this.ctx.end);
    const th = 0.55 - k * 0.3, r = 17.5 - k * 1.5;
    this.cam.position.set(Math.sin(th) * r, 1.2 + k * 0.4, Math.cos(th) * r);
    this.cam.lookAt(0, 3.9, 0);
    // the fire's light flickers
    this.fireLight.intensity = 40 * (0.85 + 0.25 * noise1(t * 6, 2) + 0.3 * kick) * (0.7 + danger * 0.5);

    const u = this.bg.u;
    u.t!.value = t; u.kick!.value = kick; u.fireH!.value = (300 + danger * 220) * (1 + (this.ctx.params.heat ?? 0) * 0.35);
    for (const m of this.mats) m.uniforms.fire!.value = 0.85 + 0.25 * noise1(t * 6, 2) + 0.3 * kick;
    this.bg.render(renderer, this.rtBg);
    clearRT(renderer, this.rtScene, [0, 0, 0], 0);
    renderer.setRenderTarget(this.rtScene);
    renderer.render(this.scene, this.cam);
    this.comp2.render(renderer, out);
    return { bloom: 0.6, bloomThreshold: 1.0, halation: 0.12, vignette: 0.45, grain: 0.055 };
  }
}

void clamp;
