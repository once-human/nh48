// The look for everything /beta still draws with three.js's own materials (trees, cars, people, the boards): the
// same two-tone sun with a brushed edge as the painted city (gfx/paint.js), the same brushed shadow edge, and grey
// pencil in the shade. Patched into three's shader chunks once, before any material exists, so every material is
// built with it (unlit ones, the sky and the screens are left alone).
import * as THREE from 'three';

const C = THREE.ShaderChunk;
const FNS = `
float paintH(vec2 p){ vec3 q=fract(vec3(p.xyx)*.1031); q+=dot(q,q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float paintN(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f); return mix(mix(paintH(i),paintH(i+vec2(1,0)),f.x),mix(paintH(i+vec2(0,1)),paintH(i+vec2(1,1)),f.x),f.y); }
vec3 paintWorld(vec3 vp){ return (vec4(vp-viewMatrix[3].xyz,0.)*viewMatrix).xyz; }
// where the light ends, a brush wobbles along the surface (in world space: it stays put when you move)
float paintEdge(vec3 vp){ vec3 w=paintWorld(vp); return paintN(w.xz*1.7+w.y*1.1)*.6+paintN(w.xz*6.3-w.y*4.7)*.4-.5; }
float paintLight(float d, vec3 vp){ return smoothstep(.0,.1,d+paintEdge(vp)*.14)*(.85+.15*d); }
float paintShade(float s, vec3 vp){ return smoothstep(.3,.7,s+paintEdge(vp)*.3); }
float pLitG = 1.0, pSh = 1.0;
`;
const NL = 'float dotNL = saturate( dot( geometryNormal, directLight.direction ) );';
const SHADOW = /directLight\.color \*= \( directLight\.visible && receiveShadow \) \? (getShadow\( directionalShadowMap\[ i \][^;]*?) : 1\.0;/;

C.lights_pars_begin = C.lights_pars_begin + FNS;
for (const k of ['lights_physical_pars_fragment', 'lights_lambert_pars_fragment', 'lights_phong_pars_fragment', 'lights_toon_pars_fragment']) {
  if (C[k].includes(NL)) C[k] = C[k].split(NL).join('float dotNL = paintLight( saturate( dot( geometryNormal, directLight.direction ) ), geometryPosition );');
}
{
  // the sun's loop: the brushed shadow edge, and how lit this pixel is (for the pencil)
  const src = C.lights_fragment_begin, a = src.indexOf('#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )'), b = src.indexOf('#pragma unroll_loop_end', a);
  if (a >= 0 && b > a) {
    let loop = src.slice(a, b);
    loop = loop.replace('getDirectionalLightInfo( directionalLight, directLight );', 'getDirectionalLightInfo( directionalLight, directLight );\n\t\tpSh = 1.0;');
    loop = loop.replace(SHADOW, 'pSh = paintShade( ( directLight.visible && receiveShadow ) ? $1 : 1.0, geometryPosition ); directLight.color *= pSh;');
    loop = loop.replace(/(\n\s*RE_Direct\( directLight)/, '\n\t\tif ( UNROLLED_LOOP_INDEX == 0 ) pLitG = pSh * smoothstep( .0, .1, dot( geometryNormal, directLight.direction ) + paintEdge( geometryPosition ) * .14 );$1');
    C.lights_fragment_begin = src.slice(0, a) + loop + src.slice(b);
  }
}
// grey pencil in the shade, sized for the screen like the city's (two sizes blended with distance)
C.dithering_fragment = `
#if defined( RE_Direct ) && NUM_DIR_LIGHTS > 0
{
  float pz = length( geometryPosition );
  if ( pLitG < .65 && pz < 200. ) {
    vec3 pw = paintWorld( geometryPosition ), pn = abs( normalize( ( vec4( geometryNormal, 0. ) * viewMatrix ).xyz ) );
    vec2 pq = pn.y > max( pn.x, pn.z ) ? pw.xz : ( pn.x > pn.z ? pw.zy : pw.xy );
    float lv = max( log2( max( pz / 800. * 3. / .016, 1e-3 ) ), 0. ), i0 = floor( lv ), fr = fract( lv ), k0 = exp2( i0 );
    vec2 a = vec2( .7071 * ( pq.x + pq.y ), .7071 * ( pq.y - pq.x ) );
    float hs = 0.;
    for ( int s = 0; s < 2; s ++ ) {
      float sp = .05 * k0 * ( s == 0 ? 1. : 2. );
      float d = a.x / sp + ( paintN( a * ( 1.6 / sp ) * .05 ) - .5 ) * .8;
      float l = abs( fract( d ) - .5 ) * 2.;
      float keep = step( .38, paintN( vec2( floor( d ) * 3.1, a.y / sp * .045 ) ) );
      hs += ( s == 0 ? 1. - fr : fr ) * ( 1. - smoothstep( .1, .34, l ) ) * keep;
    }
    float amt = hs * smoothstep( .65, .3, pLitG ) * ( 1. - smoothstep( 90., 200., pz ) ) * .5;
    gl_FragColor.rgb = mix( gl_FragColor.rgb, gl_FragColor.rgb * .55 + vec3( .105, .11, .14 ) * .25, amt );
  }
}
#endif
#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif
`;
