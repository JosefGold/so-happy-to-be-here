// Cel shading for the 3D scenes (the marionette, the aisle): a hard 3-step light ramp for
// MeshToonMaterial, and ink outlines drawn as an inverted hull pushed out a constant number of
// pixels in clip space (so the line weight doesn't change with distance).
import * as THREE from 'three';
import { W, H } from '../engine/gl';
import { HEX } from '../engine/palette';

let RAMP: THREE.DataTexture | null = null;
/** Shadow, mid, lit: three flat bands. */
export function toonRamp() {
  if (!RAMP) {
    RAMP = new THREE.DataTexture(new Uint8Array([40, 40, 40, 255, 150, 150, 150, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
    RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter;
    RAMP.needsUpdate = true;
  }
  return RAMP;
}

export function toon(color: string, o: Partial<THREE.MeshToonMaterialParameters> = {}) {
  return new THREE.MeshToonMaterial({ color: new THREE.Color(color), gradientMap: toonRamp(), ...o });
}

const OUTLINE_VERT = /* glsl */ `
uniform float px;
uniform vec2 res;
uniform float radial;
uniform vec3 centre;
void main() {
  vec3 dir = mix(normal, normalize(position - centre), radial);
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec3 n = normalize(normalMatrix * dir);
  vec2 nd = (projectionMatrix * vec4(n, 0.0)).xy;
  float l = length(nd);
  if (l > 1e-5) clip.xy += nd / l * px * 2.0 / res * clip.w;
  gl_Position = clip;
}`;

/** An ink outline material, `px` wide at 1080p. `centre` (object space) pushes radially instead of along normals (boxes). */
export function outlineMat(px = 2.5, color: string = HEX.ink, centre?: THREE.Vector3) {
  return new THREE.ShaderMaterial({
    uniforms: { px: { value: px }, res: { value: new THREE.Vector2(W, H) }, radial: { value: centre ? 1 : 0 }, centre: { value: centre ?? new THREE.Vector3() }, color: { value: new THREE.Color(color) } },
    vertexShader: OUTLINE_VERT,
    fragmentShader: /* glsl */ `uniform vec3 color; void main() { gl_FragColor = vec4(color, 1.0); }`,
    side: THREE.BackSide,
    fog: false,
  });
}

/** Give a mesh an ink outline (a child hull sharing its geometry). */
export function outline(mesh: THREE.Mesh, px = 2.5, color: string = HEX.ink, radial = false) {
  let centre: THREE.Vector3 | undefined;
  if (radial) { mesh.geometry.computeBoundingBox(); centre = mesh.geometry.boundingBox!.getCenter(new THREE.Vector3()); }
  const hull = new THREE.Mesh(mesh.geometry, outlineMat(px, color, centre));
  hull.castShadow = false;
  hull.receiveShadow = false;
  mesh.add(hull);
  return hull;
}
