// /beta's grass: the game's tufts, where it scatters them, through a painted shader. W.grass.level (graphics settings)
// sets how far it goes; at 0 there's none.
import * as THREE from 'three';
import { GrassField as GameGrass } from '@orig/world/grass.js';
import { U } from '@orig/gfx/materials.js';
import { PU, LAMP } from '../gfx/paint.js';

const REACH = 64;
const VS = `precision highp sampler2DShadow; attribute float aCell; uniform float uTime, uWind, uR, shadowOn; uniform highp sampler2DShadow shadowTex; uniform mat4 shadowMat; varying vec3 vC, vW; varying vec2 vU; varying float vZ, vH, vS;
void main(){ vec3 iP = (modelMatrix*instanceMatrix*vec4(0., 0., 0., 1.)).xyz; float dC = distance(iP.xz, cameraPosition.xz), fade = smoothstep(uR, uR*.72, dC);
  vec3 p = position*fade; float ph = iP.x*.37 + iP.z*.23, sway = (sin(uTime*1.7 + ph)*.6 + sin(uTime*3.1 + ph*1.9)*.25)*uWind; p.x += sway*.09*uv.y; p.z += sway*.06*uv.y;
  vec4 w = modelMatrix*instanceMatrix*vec4(p, 1.); vW = w.xyz; vC = color*instanceColor; vU = vec2((aCell + uv.x)/3., uv.y); vH = uv.y; vS = 1.; if (shadowOn > .5) { vec4 s = shadowMat*vec4(iP + vec3(0., .5, 0.), 1.); if (s.x > 0. && s.x < 1. && s.y > 0. && s.y < 1.) vS = texture(shadowTex, vec3(s.xy, s.z - .0006)); } vec4 v = viewMatrix*w; vZ = -v.z; gl_Position = projectionMatrix*v; }`;
const FS = `precision highp float; varying vec3 vC, vW; varying vec2 vU; varying float vZ, vH, vS; uniform sampler2D tMap, tNoise; uniform vec3 sunCol, shadeCol, fogCol; uniform float fogDensity, dayK;
${LAMP}
void main(){ vec4 t = texture2D(tMap, vU); if (t.a < .5) discard; float e = texture2D(tNoise, vW.xz*.07).r;
  vec3 b = t.rgb*vC*(.8 + .45*e), c = mix(b*shadeCol*.85, b*sunCol*vec3(1.08, 1.05, .86), smoothstep(.1, .8, vH + (e - .5)*.5)*vS*dayK) + b*lampAt(vW, vec3(0., 1., 0.));
  float f = fogDensity*vZ; gl_FragColor = vec4(mix(c, fogCol, 1. - exp(-f*f)), 1.); }`;

export class GrassField extends GameGrass {
  constructor(W, scene, quality) {
    super(W, scene, quality);
    this.lvl = 1;
    if (!this.on) return;
    const R = this.uR;
    this.mesh.material = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: Object.assign({}, PU, { tMap: { value: this.mesh.material.map }, uTime: U.uTime, uWind: U.uWind, uR: R }), vertexColors: true, side: THREE.DoubleSide });
    this.mesh.receiveShadow = false;
  }
  set level(v) { this.lvl = v; this.lastX = 1e9; if (!this.on) return; this.mesh.visible = v > 0; this.R = this.uR.value = Math.max(1, REACH*v); }
  get level() { return this.lvl; }
  update(cx, cz, force) { if (this.lvl > 0) super.update(cx, cz, force); }
}
