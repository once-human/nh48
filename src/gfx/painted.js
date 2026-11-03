// Experimental graphics: Pune, painted. The city is drawn as always, then turned into a painting in two steps.
// In every material's lighting, the sun lands in two tones with a brushed edge between them, and so do its shadows.
// After the frame, two passes over the picture add:
//  - ink lines from the depth, drawn twice like a quick sketch
//  - contact shadows
//  - dry-brush streaks and pencil hatching, worked out on the surfaces in world space so they stay put when you move
//  - watercolour pooling where two colours meet, and a softer far distance
//  - the paper it's painted on, torn at the edges
// None of it exists until you pick it from the title. Then the light code is patched and every material rebuilds
// on the spot, and it all goes again when you leave.
import * as THREE from 'three';

const S = { on: false, epoch: 0 };

// A material only rebuilds its program when its version changes, and only gets a new one when its program key does.
// Both carry the look, so every material follows it, even those that aren't in the scene when the look changes
// (interiors, pooled vehicles). This module is imported before anything makes a material.
{
  const P = THREE.Material.prototype, base = P.customProgramCacheKey;
  Object.defineProperty(P, 'customProgramCacheKey', {
    configurable: true,
    get() { const f = this.__ck || base, m = this; return () => f.call(m) + (S.on ? '|painted' : ''); },
    set(f) { this.__ck = f; },
  });
  Object.defineProperty(P, 'version', {
    configurable: true,
    get() { return (this.__v || 0) + S.epoch; },
    set(v) { this.__v = v - S.epoch; },
  });
}

// ---- the light, in two tones
const FNS = `
float paintH(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float paintN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(paintH(i),paintH(i+vec2(1,0)),f.x),mix(paintH(i+vec2(0,1)),paintH(i+vec2(1,1)),f.x),f.y); }
// where the light ends, a brush wobbles along the surface (in world space: it stays put when you move)
float paintEdge(vec3 vp){ vec3 w=(vec4(vp-viewMatrix[3].xyz,0.)*viewMatrix).xyz; return paintN(w.xz*1.7+w.y*1.1)*.6+paintN(w.xz*6.3-w.y*4.7)*.4-.5; }
float paintLight(float d, vec3 vp){ return smoothstep(.02,.14,d+paintEdge(vp)*.16)*(.8+.2*d); }
float paintShade(float s, vec3 vp){ return smoothstep(.3,.7,s+paintEdge(vp)*.3); }
`;
const NL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const SHADOW = /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? (getShadow\( directionalShadowMap\[ i \][^;]*?) : 1\.0;/;
const PATCHED = ['lights_pars_begin', 'lights_physical_pars_fragment', 'lights_lambert_pars_fragment', 'lights_phong_pars_fragment', 'lights_toon_pars_fragment', 'lights_fragment_begin'];
let ORIG = null;
function patchChunks(on) {
  const C = THREE.ShaderChunk;
  if (!ORIG) { ORIG = {}; for (const k of PATCHED) ORIG[k] = C[k]; }
  for (const k of PATCHED) C[k] = ORIG[k];
  if (!on) return;
  C.lights_pars_begin = ORIG.lights_pars_begin + FNS;
  for (const k of ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment', 'lights_phong_pars_fragment', 'lights_toon_pars_fragment'])
    C[k] = ORIG[k].split(NL).join('float dotNL = paintLight( saturate( dot( geometryNormal, directLight.direction ) ), geometryPosition );');
  C.lights_fragment_begin = ORIG.lights_fragment_begin.replace(SHADOW, 'directLight.color *= paintShade( ( directLight.visible && receiveShadow ) ? $1 : 1.0, geometryPosition );');
}

// ---- after the frame
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }';
const NOISE = `
float h12(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float vn(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(h12(i),h12(i+vec2(1,0)),f.x),mix(h12(i+vec2(0,1)),h12(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=.5,s=0.; for(int i=0;i<4;i++){ s+=a*vn(p); p=p*2.03+vec2(7.1,3.3); a*=.5; } return s; }
float lum(vec3 c){ return dot(c,vec3(.3,.59,.11)); }`;

// pass 1: the painting. Reads the frame (tone-mapped, linear) and its depth. Writes display colour, and in alpha how
// soft that pixel should go (far away)
const PAINT_FS = `varying vec2 vUv;
uniform sampler2D tCol, tDep; uniform vec2 res; uniform float dpr, pScale; uniform mat4 projInv; uniform mat3 camRot; uniform vec3 camOff;
${NOISE}
vec3 vpos(vec2 uv){ float d=texture2D(tDep,uv).x; vec4 v=projInv*vec4(uv*2.-1.,d*2.-1.,1.); return v.xyz/v.w; }
vec3 col(vec2 uv){ return sqrt(max(texture2D(tCol,uv).rgb,0.)); }
vec2 rot(vec2 p,float a){ float c=cos(a),s=sin(a); return vec2(c*p.x+s*p.y,-s*p.x+c*p.y); }
// how much the surface bends at uv: the second difference of 1/z, which is flat on flat things whatever the angle
float crease(vec2 uv,float r){ vec2 px=r/res; float z=-vpos(uv).z, l=-vpos(uv-vec2(px.x,0.)).z, rr=-vpos(uv+vec2(px.x,0.)).z, u=-vpos(uv+vec2(0.,px.y)).z, d=-vpos(uv-vec2(0.,px.y)).z;
  float iz=1./max(z,.01); float e=(abs(1./max(l,.01)+1./max(rr,.01)-2.*iz)+abs(1./max(u,.01)+1./max(d,.01)-2.*iz))*z; return smoothstep(.012,.03,e); }
// a dry brush stroke, k times its near size
float streak(vec2 q,float k){ return vn(q/(vec2(.5,.03)*k))*.6+vn(q/(vec2(.18,.016)*k)+3.)*.4; }
// pencil: wavering parallel lines that break off
float hatch(vec2 q,float sp){ float d=q.x/sp+(vn(q*(1.6/sp)*.05)-.5)*.8; float l=abs(fract(d)-.5)*2.; float keep=step(.38,vn(vec2(floor(d)*3.1,q.y/sp*.045))); return (1.-smoothstep(.1,.34,l))*keep; }
void marks(vec2 q,float k0,float k1,float fr,float sh,out float T,out float sk,out float h){
  T=mix(streak(q,k0),streak(q,k1),fr);
  sk=mix(vn(q/(vec2(.2,.012)*k0)+40.),vn(q/(vec2(.2,.012)*k1)+40.),fr);
  vec2 a=rot(q,.78), b=rot(q,-.62)+17.;
  float h0=hatch(a,.045*k0)*step(.5,sh)+hatch(b,.05*k0)*step(1.15,sh), h1=hatch(a,.045*k1)*step(.5,sh)+hatch(b,.05*k1)*step(1.15,sh);
  h=mix(h0,h1,fr);
}
void main(){
  vec2 uv=vUv, px=1./res, fp=gl_FragCoord.xy/dpr;
  float dep=texture2D(tDep,uv).x; bool sky=dep>.99999;
  vec2 wob=(vec2(vn(fp*.09),vn(fp*.09+9.))-.5)*px*2.4*dpr;
  vec3 c=col(uv+wob);
  if(sky){ float T=vn(rot(fp,.3)/vec2(16.,1.7)); c*=1.+(T-.5)*.1; gl_FragColor=vec4(c,1.); return; }
  // the surface: where it is, which way it faces (from the depth)
  vec3 P=vpos(uv), L=vpos(uv-vec2(px.x,0.)), R=vpos(uv+vec2(px.x,0.)), D=vpos(uv-vec2(0.,px.y)), U=vpos(uv+vec2(0.,px.y));
  vec3 hx=abs(P.z-L.z)<abs(R.z-P.z)?P-L:R-P, hy=abs(P.z-D.z)<abs(U.z-P.z)?P-D:U-P;
  vec3 n=normalize(cross(hx,hy)); float z=-P.z;
  vec3 W=camRot*P+camOff, Nw=camRot*n;
  // contact shadow: where things meet, the light can't get in
  float ao=0.; { float rr=clamp(.45*pScale/max(z,.5),2.*dpr,26.*dpr); float j=vn(fp*.7)*6.28;
    for(int i=0;i<8;i++){ float a=float(i)*2.39996+j; vec2 o=vec2(cos(a),sin(a))*rr*(.3+.7*fract(float(i)*.618))*px; vec3 v=vpos(uv+o)-P; float d=length(v); ao+=max(dot(v,n)/max(d,1e-3)-.25,0.)*(1.-smoothstep(.7,1.8,d)); }
    ao=clamp(ao/8.*2.,0.,1.); }
  // the marks are sized for the screen: on far surfaces the same strokes are drawn bigger (like a mipmap, two sizes
  // blended), so they never shrink into noise and never slide over the surface
  float lv=log2(max(z/pScale*3.*dpr/.016,1e-3)), i0=floor(lv), fr=fract(lv), k0=exp2(i0), k1=k0*2.;
  float far=1.-smoothstep(150.,400.,z);
  // the paint: the frame's own colours, a touch warmer in the light
  float l0=lum(c);
  c=mix(c,c*vec3(1.03,1.,.95),smoothstep(.35,.8,l0));
  // paint is never black: deep shade lifts towards the sky's cool, and keeps some colour
  float lift=1.-smoothstep(.0,.45,l0); c=c+lift*(.13*vec3(.82,.88,1.)+c*.35); c=mix(vec3(lum(c)),c,1.+lift*.25);
  c*=1.-ao*.45;
  // marks on each surface from the world axis it faces (walls stroked up and down, the ground across), blended on
  // the diagonals. Pencil where it's dark: one way in shade, crossed in the darkest places
  float sh=(1.-smoothstep(.2,.42,l0))*.9+ao*1.6;
  vec3 bw=pow(abs(Nw),vec3(4.)); bw/=bw.x+bw.y+bw.z;
  float Tm=0., sk=0., h=0., t1, t2, t3;
  if(bw.x>.02){ marks(vec2(W.y,W.z),k0,k1,fr,sh,t1,t2,t3); Tm+=bw.x*t1; sk+=bw.x*t2; h+=bw.x*t3; }
  if(bw.y>.02){ marks(rot(W.xz,.35),k0,k1,fr,sh,t1,t2,t3); Tm+=bw.y*t1; sk+=bw.y*t2; h+=bw.y*t3; }
  if(bw.z>.02){ marks(vec2(W.y,W.x)+31.,k0,k1,fr,sh,t1,t2,t3); Tm+=bw.z*t1; sk+=bw.z*t2; h+=bw.z*t3; }
  Tm=mix(.5,Tm,far);
  c*=1.+(Tm-.5)*.2;
  c=mix(c,c*1.08+vec3(.06,.055,.045),smoothstep(.66,.72,sk)*.4*far);
  h=clamp(h,0.,1.)*(1.-smoothstep(90.,220.,z));
  c=mix(c,c*vec3(.58,.58,.66),h*.45);
  // ink: the line, and a lighter second try beside it
  float e=crease(uv+wob*.6,1.*dpr);
  vec2 w2=(vec2(vn(fp*.035+20.),vn(fp*.035+31.))-.5)*px*5.*dpr; float e2=crease(uv+w2,.8*dpr);
  vec3 cl=col(uv-vec2(px.x,0.)*dpr), cr=col(uv+vec2(px.x,0.)*dpr), cu=col(uv+vec2(0.,px.y)*dpr), cd=col(uv-vec2(0.,px.y)*dpr);
  float ec=smoothstep(.14,.3,abs(lum(cl)-lum(cr))+abs(lum(cu)-lum(cd)))*.5;
  float brk=smoothstep(.2,.45,vn(fp*.05+2.)); vec3 ink=mix(c*.4,vec3(.14,.11,.12),.6);
  float fade=1.-smoothstep(30.,110.,z);
  c=mix(c,ink,max(e,ec)*(.5+.4*brk)*fade); c=mix(c,ink,e2*.28*step(.5,vn(fp*.04+8.))*fade);
  float speck=step(.994,h12(floor(fp/1.6)+5.)); c=mix(c,c*.78,speck*.5);
  gl_FragColor=vec4(c,smoothstep(70.,260.,z));
}`;

// pass 2: watercolour pooling, the far distance going soft, and the paper
const PAPER_FS = `varying vec2 vUv;
uniform sampler2D t; uniform vec2 res; uniform float dpr;
${NOISE}
void main(){
  vec2 uv=vUv, px=1./res, gp=gl_FragCoord.xy/dpr;
  vec4 c0=texture2D(t,uv); vec3 c=c0.rgb;
  float r=c0.a*3.*dpr;
  if(r>.4){ vec3 s=c; float w=1.; for(int i=0;i<12;i++){ float a=float(i)*2.39996; vec2 o=vec2(cos(a),sin(a))*r*sqrt((float(i)+.5)/12.)*px; vec4 k=texture2D(t,uv+o); float wt=smoothstep(.0,.3,k.a); s+=k.rgb*wt; w+=wt; } c=s/w; }
  vec3 b=vec3(0.); for(int i=0;i<8;i++){ float a=float(i)*.785; b+=texture2D(t,uv+vec2(cos(a),sin(a))*2.*dpr*px).rgb; } b/=8.;
  float g=length(c-b); c*=1.-clamp(g*1.4,0.,.22)*(.5+vn(gp*.06));
  float pap=fbm(gp*.35)*.8+h12(floor(gp/1.5))*.2; c*=.96+pap*.07;
  vec2 v=uv-.5; c*=1.-dot(v,v)*.3;
  // the painting stops short of the paper's edge, raggedly
  float asp=res.x/res.y, d=min(min(uv.x,1.-uv.x)*asp,min(uv.y,1.-uv.y)); float rn=fbm(gp*.012)*.7+vn(gp*.08)*.3;
  float m=smoothstep(0.,.006,d-.014-(rn-.5)*.03);
  vec3 paper=vec3(.95,.925,.86)*(.97+pap*.05);
  gl_FragColor=vec4(mix(paper,c,m),1.);
}`;

export class Painted {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.on = false; this.size = new THREE.Vector2(); this._v = new THREE.Vector2();
  }
  // turn the look on or off; resolves when the city's shaders are rebuilt for it
  async set(on, progress) {
    if (on === this.on) return;
    const R = this.renderer, scene = this.scene, cam = this.camera;
    progress && progress(on ? 'Mixing the paints' : 'Back to the city', 0.15);
    patchChunks(on);
    S.on = on; S.epoch++;
    this.on = on;
    if (on) this.targets();
    else this.free();
    // build what's in view now, into the picture it'll be drawn into, so nothing stalls once you're moving
    progress && progress(on ? 'Painting Pune' : 'Putting the paints away', 0.35);
    await new Promise(r => requestAnimationFrame(r));
    const prev = R.getRenderTarget();
    let job;
    try { if (on) R.setRenderTarget(this.rt); job = R.compileAsync(scene, cam); } finally { R.setRenderTarget(prev); }
    try { await job; } catch (e) { /* the rest compiles on first sight */ }
    progress && progress('Ready', 1);
  }
  targets() {
    const R = this.renderer, v = R.getDrawingBufferSize(this._v);
    if (this.rt && v.equals(this.size)) return;
    this.free(); this.size.copy(v);
    const rt = this.rt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true });
    rt.depthTexture = new THREE.DepthTexture(v.x, v.y, THREE.FloatType);
    rt.isXRRenderTarget = true;                      // tone-mapped exactly as on the screen (see Post.target)
    rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
    this.pt = new THREE.WebGLRenderTarget(v.x, v.y, { type: THREE.UnsignedByteType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false });
    if (!this.quad) {
      const res = new THREE.Vector2(), dpr = { value: 1 };
      this.U = { tCol: { value: null }, tDep: { value: null }, res: { value: res }, dpr, pScale: { value: 1 }, projInv: { value: new THREE.Matrix4() }, camRot: { value: new THREE.Matrix3() }, camOff: { value: new THREE.Vector3() } };
      this.U2 = { t: { value: null }, res: { value: res }, dpr };
      const mk = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false, toneMapped: false });
      this.m1 = mk(PAINT_FS, this.U); this.m2 = mk(PAPER_FS, this.U2);
      this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.m1); this.quad.frustumCulled = false;
      this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    }
    this.U.res.value.set(v.x, v.y);
    this.U.dpr.value = Math.max(1, v.y / 900);        // the marks keep their size on paper whatever the resolution
    this.U.tCol.value = rt.texture; this.U.tDep.value = rt.depthTexture; this.U2.t.value = this.pt.texture;
  }
  free() {
    if (this.rt) { this.rt.depthTexture.dispose(); this.rt.dispose(); this.rt = null; }
    if (this.pt) { this.pt.dispose(); this.pt = null; }
  }
  setSize() { if (this.on) this.targets(); }
  render() {
    const R = this.renderer, cam = this.camera, U = this.U;
    this.targets();
    R.setRenderTarget(this.rt); R.render(this.scene, cam);
    U.projInv.value.copy(cam.projectionMatrixInverse);
    U.camRot.value.setFromMatrix4(cam.matrixWorld);
    // world position for the marks, kept small (they repeat every 4 km, nowhere you'd notice)
    const p = cam.position;
    U.camOff.value.set(((p.x % 4096) + 4096) % 4096, p.y, ((p.z % 4096) + 4096) % 4096);
    U.pScale.value = this.size.y / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2));
    this.quad.material = this.m1; R.setRenderTarget(this.pt); R.render(this.qs, this.qc);
    this.quad.material = this.m2; R.setRenderTarget(null); R.render(this.qs, this.qc);
  }
}
