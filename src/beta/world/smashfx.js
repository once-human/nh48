// The sound of something giving way, made the way that thing makes it, and from where it is. A steel post folding is
// a deep groan with the base tearing, then the long hollow clang as it lands; a concrete pole cracks like a shot and
// comes down in a crunch of grit; wood splinters in a run of small sharp cracks with a knock under them; a tin roof
// sheet crashes and rings; glass is a burst and then a tinkle of bits; fruit is soft thumps. Landing, each piece makes its
// own knock, by what it is and how hard it came down. Never twice the same.
const R = Math.random, J = (a, b) => a + (b - a)*R();
let NB = null;
function nbuf(ctx) { if (NB && NB.ctx === ctx) return NB.b; const n = ctx.sampleRate*2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = R()*2 - 1; NB = { ctx, b }; return b; }
const AU = () => window.__nhAskG && window.__nhAskG.audio;

// where it is: everything for one sound goes through one panner there
function place(A, x, y, z) {
  const g = A.ctx.createGain(); g.gain.value = 1;
  try { g.connect(A.panner({ x, y, z }, 7)).connect(A.bus ? A.bus('fx') : A.ctx.destination); } catch (e) { g.connect(A.ctx.destination); }
  return g;
}
function hiss(A, o, t, len, f, q, vol, type = 'bandpass', f1) {
  const ctx = A.ctx, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
  s.buffer = nbuf(ctx); fl.type = type; fl.frequency.setValueAtTime(f, t); if (f1) fl.frequency.exponentialRampToValueAtTime(f1, t + len); fl.Q.value = q;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.004, len*0.2)); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  s.connect(fl); fl.connect(g); g.connect(o); s.start(t, R()*1.5); s.stop(t + len + 0.02);
}
function ring(A, o, t, f, len, vol, parts = [1, 2.76, 5.4]) {
  const ctx = A.ctx;
  parts.forEach((m, k) => {
    const os = ctx.createOscillator(), g = ctx.createGain(); os.type = 'sine'; os.frequency.value = f*m*J(0.99, 1.01);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol/(1 + k*0.8), t + 0.003); g.gain.exponentialRampToValueAtTime(0.0004, t + len/(1 + k*0.5));
    os.connect(g); g.connect(o); os.start(t); os.stop(t + len + 0.02);
  });
}
function tone(A, o, t, f, len, vol, type = 'sine', f1) {
  const ctx = A.ctx, os = ctx.createOscillator(), g = ctx.createGain(); os.type = type;
  os.frequency.setValueAtTime(f, t); if (f1) os.frequency.exponentialRampToValueAtTime(f1, t + len);
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + len);
  os.connect(g); g.connect(o); os.start(t); os.stop(t + len + 0.02);
}
// a run of small cracks, spread over len seconds
function crackle(A, o, t, n, len, f0, f1, vol) { for (let k = 0; k < n; k++) { const c = t + len*Math.pow(R(), 1.6); hiss(A, o, c, J(0.006, 0.025), J(f0, f1), J(1.2, 3), vol*J(0.4, 1)); } }

const SOUND = {
  // a steel post bending over at its foot: the groan of it going, the base plate's bolts letting go
  steelFold: (A, o, t, k) => {
    tone(A, o, t, J(70, 95), 0.9, 0.16*k, 'sawtooth', J(38, 50)); tone(A, o, t + 0.02, J(140, 170), 0.6, 0.05*k, 'sawtooth', 70);
    hiss(A, o, t, 0.5, 900, 0.8, 0.12*k, 'bandpass', 300); ring(A, o, t, J(310, 380), 1.1, 0.12*k, [1, 2.41, 3.9, 5.8]);
    crackle(A, o, t + 0.05, 5, 0.3, 1800, 3500, 0.12*k);
  },
  // a concrete pole snapping: the crack, the grit coming off, the reinforcing bars twanging
  rccSnap: (A, o, t, k) => {
    hiss(A, o, t, 0.06, 2600, 0.5, 0.75*k, 'highpass'); hiss(A, o, t, 0.4, 260, 0.6, 0.45*k, 'lowpass', 90);
    crackle(A, o, t + 0.03, 22, 0.7, 700, 3200, 0.16*k); ring(A, o, t + 0.05, J(520, 700), 0.5, 0.05*k, [1, 1.9, 3.3]);
  },
  // wood: a run of splintering, and the knock of the planks
  wood: (A, o, t, k) => { crackle(A, o, t, 26, 0.45, 900, 4200, 0.2*k); tone(A, o, t, J(170, 230), 0.16, 0.22*k, 'triangle', 90); hiss(A, o, t, 0.3, 500, 0.7, 0.18*k, 'lowpass', 160); },
  // a tin sheet: the crash and its wobbling ring
  tin: (A, o, t, k) => { hiss(A, o, t, 0.5, 2200, 0.6, 0.25*k, 'bandpass', 900); ring(A, o, t, J(420, 560), 0.9, 0.08*k, [1, 1.37, 2.13, 2.9, 4.4]); },
  glass: (A, o, t, k) => {
    hiss(A, o, t, 0.12, 5200, 0.6, 0.35*k, 'highpass');
    let c = t + 0.03; for (let i = 0; i < 9; i++) { ring(A, o, c, J(3200, 7800), J(0.06, 0.2), 0.05*k*J(0.4, 1), [1, 1.61, 2.5]); c += J(0.02, 0.11); }
  },
  plastic: (A, o, t, k) => { hiss(A, o, t, 0.08, J(900, 1500), 2.2, 0.3*k); tone(A, o, t, J(260, 360), 0.09, 0.12*k, 'triangle', 180); crackle(A, o, t + 0.02, 6, 0.15, 1500, 3000, 0.1*k); },
  fruit: (A, o, t, k) => { let c = t; for (let i = 0; i < 7; i++) { tone(A, o, c, J(90, 160), 0.08, 0.1*k*J(0.5, 1), 'sine', 60); hiss(A, o, c, 0.04, 600, 0.8, 0.05*k, 'lowpass'); c += J(0.04, 0.16); } },
  bamboo: (A, o, t, k) => { tone(A, o, t, J(380, 520), 0.12, 0.2*k, 'triangle', 250); crackle(A, o, t, 10, 0.25, 1200, 3600, 0.15*k); },
  cloth: (A, o, t, k) => hiss(A, o, t, 0.35, 700, 0.5, 0.08*k, 'lowpass', 250),
};
// a piece landing, by what it is and how hard (v, m/s) and how heavy (kg)
function land(A, o, t, mat, v, m) {
  const k = Math.min(1.2, v/6)*Math.min(1.3, 0.35 + Math.log10(1 + m)*0.35);
  switch (mat) {
    case 'steel': ring(A, o, t, J(160, 260)/Math.max(1, Math.log10(m)), 1.4, 0.2*k, [1, 2.32, 3.7, 5.9, 8.1]); hiss(A, o, t, 0.15, 1400, 0.8, 0.2*k); tone(A, o, t, 55, 0.3, 0.2*k, 'sine', 40); break;
    case 'rcc': tone(A, o, t, J(45, 60), 0.35, 0.35*k, 'sine', 32); hiss(A, o, t, 0.5, 400, 0.6, 0.3*k, 'lowpass', 120); crackle(A, o, t, 12, 0.5, 600, 2400, 0.1*k); break;
    case 'wood': case 'bamboo': tone(A, o, t, J(150, 260), 0.12, 0.2*k, 'triangle', 90); hiss(A, o, t, 0.08, 900, 1, 0.12*k); break;
    case 'tin': ring(A, o, t, J(380, 520), 0.6, 0.07*k, [1, 1.37, 2.13, 2.9]); hiss(A, o, t, 0.2, 2000, 0.7, 0.12*k); break;
    case 'glass': ring(A, o, t, J(3500, 7000), 0.12, 0.04*k, [1, 1.6]); break;
    case 'fruit': tone(A, o, t, J(80, 140), 0.07, 0.12*k, 'sine', 55); break;
    case 'cloth': hiss(A, o, t, 0.12, 500, 0.6, 0.05*k, 'lowpass'); break;
    default: tone(A, o, t, J(200, 320), 0.08, 0.14*k, 'triangle', 150); hiss(A, o, t, 0.06, 1500, 1.2, 0.1*k);
  }
}
// a blow that doesn't break it: a kick or a bumper or a round on steel, concrete, wood
function knock(A, o, t, mat, k) {
  switch (mat) {
    case 'steel': ring(A, o, t, J(420, 560), 0.9, 0.1*k, [1, 2.71, 4.4, 6.3]); hiss(A, o, t, 0.02, 2500, 2, 0.12*k); break;
    case 'rcc': tone(A, o, t, 80, 0.12, 0.2*k, 'sine', 50); hiss(A, o, t, 0.1, 1200, 0.8, 0.15*k); break;
    default: tone(A, o, t, J(160, 240), 0.1, 0.2*k, 'triangle', 100); hiss(A, o, t, 0.04, 1200, 1.2, 0.1*k);
  }
}
// a round striking it: a ricochet off steel, a chip of concrete flying, a thock into wood
function hit(A, o, t, mat) {
  switch (mat) {
    case 'steel': hiss(A, o, t, 0.012, 4200, 3, 0.4); ring(A, o, t, J(1800, 2600), 0.3, 0.06, [1, 2.3, 3.1]); tone(A, o, t + 0.01, J(2600, 3400), 0.35, 0.03, 'sine', J(900, 1300)); break;
    case 'rcc': hiss(A, o, t, 0.03, 2800, 1, 0.4); crackle(A, o, t + 0.01, 6, 0.12, 1500, 4000, 0.1); break;
    case 'glass': SOUND.glass(A, o, t, 0.8); break;
    default: hiss(A, o, t, 0.02, 1800, 1.5, 0.35); tone(A, o, t, 180, 0.06, 0.12, 'triangle', 110);
  }
}

const go = (x, y, z, fn) => { const A = AU(); if (!A || !A.ctx) return; try { const o = place(A, x, y, z); fn(A, o, A.ctx.currentTime + 0.005); } catch (e) { /* silent */ } };
export const FX = {
  brk: (name, x, y, z, k = 1) => go(x, y, z, (A, o, t) => (SOUND[name] || SOUND.wood)(A, o, t, k)),
  land: (mat, x, y, z, v, m) => go(x, y, z, (A, o, t) => land(A, o, t, mat, v, m)),
  knock: (mat, x, y, z, k = 1) => go(x, y, z, (A, o, t) => knock(A, o, t, mat, k)),
  hit: (mat, x, y, z) => go(x, y, z, (A, o, t) => hit(A, o, t, mat)),
};
