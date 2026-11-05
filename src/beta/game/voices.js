// Background voices sit back. People talking among themselves (the ones standing round in a group) are at 80% of what
// they were, and someone muttering to themselves as they pass at 60%: you overhear them, they're not talking to you.
// Anyone speaking to you (a greeting, a reaction, the police, a conversation you're in) is as loud as before.
import { People } from '@orig/people/peds.js';
import { Audio } from '@orig/game/audio.js';

const QUIET = { mutter: 0.6, chat: 0.8 };
// (and everyone a touch lower again, 5%; the sirens too)
const ALL = 0.95;
let mul = 1;
const speakAs = People.prototype.speakAs;
People.prototype.speakAs = function (scenario, ...a) {
  const was = mul; mul = QUIET[scenario] ?? 1;
  try { return speakAs.call(this, scenario, ...a); } finally { mul = was; }
};
const voice = Audio.prototype.voice;
Audio.prototype.voice = function (id, vol = 1, ...a) { return voice.call(this, id, vol*mul*ALL, ...a); };
const siren = Audio.prototype.siren;
Audio.prototype.siren = function (level, ...a) { return siren.call(this, level*ALL, ...a); };
const amb = Audio.prototype.ambSiren;
if (amb) Audio.prototype.ambSiren = function (level, ...a) { return amb.call(this, typeof level === 'number' ? level*ALL : level, ...a); };
