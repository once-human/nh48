// Experimental graphics, part 1: the city's surfaces repainted. In the painted look the ground, walls and roofs
// don't sample the photo texture sets (albedo, normal, AO-roughness, two scales each) at all. Every kind of ground
// and wall gets a painted colour instead, with its marks drawn in: pavers and slab joints, brick courses, basalt
// blocks, Mangalore tile rows, shutter ribs, corrugated tin, planks. On top of that go limewash patches and the
// brush. Building colours are pulled towards Pune's limewash palette, and windows are painted glass instead of
// ray-marched rooms. Everything else in those shaders (windows, shop fronts, kerb paint, wet roads, weathering)
// stays as it is. Lighter on the GPU: no texture fetches for any of it.
import * as THREE from 'three';

// Pune limewash: ochre, peth blue, verdigris teal, terracotta, sage, cream, mustard, whitewash
const PALETTE = [0xe6c27e, 0x7092b8, 0x6fa3a0, 0xd4906a, 0x93ad80, 0xeee2c4, 0xd6a874, 0xf2efe6, 0xa9c6b4, 0xc9c79e, 0xbf6650, 0xe4cf9c];
const pal = PALETTE.map(h => { const c = new THREE.Color(h); return `vec3(${c.r.toFixed(4)},${c.g.toFixed(4)},${c.b.toFixed(4)})`; });

const GLSL = `
float pH(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float pN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(pH(i),pH(i+vec2(1,0)),f.x),mix(pH(i+vec2(0,1)),pH(i+vec2(1,1)),f.x),f.y); }
// 1 on a grid line (lines at whole numbers), w wide
float pGL(float x,float w){ float d=min(fract(x),1.-fract(x)); return 1.-smoothstep(w*.5,w,d); }
// how much of the fine detail to draw: fades out before it gets smaller than a few pixels
float pNear(float a,float b){ return 1.-smoothstep(a,b,length(vViewPosition)); }
// the brush over a surface: long strokes (one way), and patches with a little more or less paint
vec3 pBrush(vec3 c,vec2 u,vec2 dir,float k){ float n=pNear(15.,45.); float s=pN(u*dir)*.6+pN(u*dir*2.3+3.)*.4; c*=1.+(mix(.5,s,n)-.5)*.22*k; c*=.93+.14*pN(u*1.3+7.); return c; }
vec4 pNrm(vec3 p){ return vec4(.5,.5,1.,1.); }
vec4 pArm(vec3 p){ return vec4(1.,.85,0.,1.); }
vec4 pGround(vec3 p){
  float L=floor(p.z+.5); vec2 u=p.xy; float n=pNear(18.,50.);
  vec3 c = L<.5?vec3(.21,.21,.22): L<1.5?vec3(.24,.23,.215): L<2.5?vec3(.5,.41,.37): L<3.5?vec3(.56,.53,.48): L<4.5?vec3(.5,.35,.23):
           L<5.5?vec3(.3,.37,.15): L<6.5?vec3(.42,.4,.24): L<7.5?vec3(.56,.54,.5): L<8.5?vec3(.37,.29,.19): L<9.5?vec3(.3,.29,.27): vec3(.33,.32,.31);
  c=pBrush(c,u,vec2(2.,26.),1.);
  if(L>1.5&&L<2.5){ vec2 g=u*8.; g.x+=step(.5,fract(g.y*.5))*.5; c*=1.-.35*n*max(pGL(g.x,.09),pGL(g.y,.09)); c*=.92+.16*pH(floor(g)); }
  if(L>2.5&&L<3.5){ vec2 g=u*3.6; c*=1.-.3*n*max(pGL(g.x,.05),pGL(g.y,.05)); c*=.94+.12*pH(floor(g)+3.); }
  if(L>6.5&&L<7.5){ vec2 g=u*1.4; c*=1.-.2*n*max(pGL(g.x,.025),pGL(g.y,.025)); }
  if(L>4.5&&L<6.5) c*=.86+.28*mix(.5,pN(u*34.),n);
  if(L>9.5){ vec2 g=u*vec2(4.,5.); g.x+=step(.5,fract(g.y*.5))*.5; c*=(.85+.3*pH(floor(g)))*(1.-.4*n*max(pGL(g.x,.07),pGL(g.y,.07))); }
  return vec4(c,1.);
}
vec4 pWall(vec3 p){
  float L=floor(p.z+.5); vec2 u=p.xy; float n=pNear(15.,45.);
  vec3 c = L<.5?vec3(.8,.78,.74): L<1.5?vec3(.78,.76,.71): L<2.5?vec3(.75,.69,.59): L<3.5?vec3(.6,.59,.56): L<4.5?vec3(.72,.69,.63): L<5.5?vec3(.64,.6,.54):
           L<6.5?vec3(.7,.7,.69): L<7.5?vec3(.76,.73,.69): L<8.5?vec3(.56,.3,.22): L<9.5?vec3(.33,.32,.31): L<10.5?vec3(.72,.6,.45): L<11.5?vec3(.62,.64,.64):
           L<12.5?vec3(.5,.32,.22): L<13.5?vec3(.63,.63,.61): L<14.5?vec3(.17,.17,.18): L<15.5?vec3(.6,.28,.18): L<16.5?vec3(.45,.3,.18): vec3(.62,.6,.56);
  if(L<6.5||L>16.5){                                   // plaster and limewash: repainted patches, vertical brush
    c*=.95+.1*smoothstep(.5,.54,pN(u*1.6+L*3.));
    c=pBrush(c,u,vec2(26.,2.5),1.2);
  } else if(L<7.5){ vec2 g=u*7.; c*=(.95+.1*pH(floor(g)))*(1.-.25*n*max(pGL(g.x,.06),pGL(g.y,.06))); }
  else if(L<8.5){ vec2 g=u*vec2(10.,28.); g.x+=step(.5,fract(g.y*.5))*.5; c*=.84+.32*pH(floor(g)); c=mix(c,vec3(.72,.68,.62),.75*n*max(pGL(g.x,.08),pGL(g.y,.14))); }
  else if(L<9.5){ vec2 g=u*vec2(4.,6.); g.x+=step(.5,fract(g.y*.5))*.5+.15*(pN(u*3.)-.5); c*=.8+.45*pH(floor(g)); c*=1.-.45*n*max(pGL(g.x,.08),pGL(g.y,.1)); }
  else if(L<10.5){ vec2 g=u*vec2(3.,6.); g.x+=step(.5,fract(g.y*.5))*.5; c*=.9+.2*pH(floor(g)); c*=1.-.2*n*max(pGL(g.x,.05),pGL(g.y,.06)); }
  else if(L<12.5){ c*=1.-.3*n*pGL(u.y*26.,.3); c=pBrush(c,u,vec2(2.,30.),.8); }
  else if(L<13.5){ c*=.82+.3*(.5+.5*sin(u.x*90.))*n+.15*(1.-n); }
  else if(L<14.5){ c=pBrush(c,u,vec2(3.,3.),1.); }
  else if(L<15.5){ vec2 g=u*vec2(9.,7.); g.x+=step(.5,fract(g.y*.5))*.5; float row=fract(g.y); c*=.86+.26*pH(floor(g)); c*=mix(1.,.55,n*smoothstep(.75,.98,row)); c*=mix(1.,1.12,n*smoothstep(.3,.0,row)); }
  else { float pl=u.x*6.; c*=.86+.26*pH(vec2(floor(pl),3.)); c*=1.-.4*n*pGL(pl,.06); c=pBrush(c,u,vec2(40.,3.),1.); }
  return vec4(c,1.);
}
// a building's colour, moved halfway to the nearest limewash colour (keeping how light it was)
const vec3 pPal[${pal.length}] = vec3[](${pal.join(',')});
vec3 pTint(vec3 t){
  float lt=dot(t,vec3(.3,.59,.11)); vec3 best=pPal[0]; float bd=1e9;
  for(int i=0;i<${pal.length};i++){ vec3 q=pPal[i]; float lq=dot(q,vec3(.3,.59,.11)); float d=length(t/max(lt,.01)-q/max(lq,.01))+abs(lt-lq)*.6; if(d<bd){ bd=d; best=q; } }
  float lb=dot(best,vec3(.3,.59,.11)); return mix(t,best*lt/max(lb,.01),.55);
}
// painted glass: deep blue-green, with one pale stroke of the sky across it
vec3 pGlass(vec2 w,float s){ float d=fract((w.x*.5+w.y)*.9+s); return mix(vec3(.1,.17,.2),vec3(.42,.55,.58),smoothstep(.05,.1,d)*smoothstep(.32,.26,d)*.8); }
`;

function sub(src, a, b) {
  if (!src.includes(a)) throw new Error('painted surfaces: shader text missing: ' + a.slice(0, 50));
  return src.split(a).join(b);
}

// rewrite an already-patched ground / facade / roof shader (gfx/pbr.js) into its painted version
export function paintSurface(sh, key) {
  let f = sh.fragmentShader;
  f = f.replace('#include <common>', '#include <common>\n' + GLSL);
  if (key === 'nh-ground') {
    f = f.replace(/textureLod\(tGAlb, (vec3\([^;]*?\)), 9\.0\)/g, 'pGround($1)');
    f = sub(f, 'texture(tGAlb, ', 'pGround(');
    f = sub(f, 'texture(tGArm, ', 'pArm(');
    f = sub(f, 'texture(tGNrm, ', 'pNrm(');
  } else {
    f = sub(f, 'texture(tWAlb, ', 'pWall(');
    f = sub(f, 'texture(tWArm, ', 'pArm(');
    f = sub(f, 'texture(tWNrm, ', 'pNrm(');
    if (key === 'nh-facade') {
      f = sub(f, 'vec3 tint = mix(vec3(1.0), vTint, uWTint[li]);', 'vec3 tint = mix(vec3(1.0), pTint(vTint), uWTint[li]);');
      f = sub(f, 'vec3 farRoom = vec3(0.07) * (1.0 - uNight)', 'vec3 farRoom = pGlass(fWinN, winSeed) * (1.0 - uNight)');
      f = sub(f, 'if (fwU < 0.05) {', 'if (false) {');
    }
  }
  sh.fragmentShader = f;
}
