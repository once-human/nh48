// Every pose the game builds on a body (a crouch, the lean into a drag, the head falling back, hands on the grips,
// feet on the kerb) goes on top of where the clip put the bones this frame. That only holds while the clip puts every
// bone back every frame, and it doesn't: a clip that leaves some bones out (the legs-only walk under an upper-body
// action, a wave that's only the arm) never resets them, and people further off are only animated every second or
// fourth frame. On those bones and frames the turn went on top of last frame's turn, and again, and the neck, the
// hips, the spine wound round and round. Now each mixer remembers the pose its clips last made, puts the bones back to
// it before every step (so a bone no clip moves is where it was, not where the last turn left it), and can put them
// back on a frame it doesn't step at all (people/crowd.js, patched in tools/build-beta.mjs): whatever's built on top
// is built on the clip's pose, every frame, and never on itself.
import * as THREE from 'three';

function bonesOf(m) {
  if (m._bones) return m._bones;
  const out = [], root = m.getRoot && m.getRoot();
  if (root && root.traverse) root.traverse(o => { if (o.isBone) out.push(o); });
  m._bones = out; m._sq = new Float32Array(out.length*4); m._sp = new Float32Array(out.length*3);
  return out;
}
function save(m) {
  const B = bonesOf(m), q = m._sq, p = m._sp;
  for (let i = 0; i < B.length; i++) { const b = B[i]; q[i*4] = b.quaternion.x; q[i*4 + 1] = b.quaternion.y; q[i*4 + 2] = b.quaternion.z; q[i*4 + 3] = b.quaternion.w; p[i*3] = b.position.x; p[i*3 + 1] = b.position.y; p[i*3 + 2] = b.position.z; }
  m._saved = true;
}
function rest(m) {
  if (!m._saved) return;
  const B = m._bones, q = m._sq, p = m._sp;
  for (let i = 0; i < B.length; i++) { const b = B[i]; b.quaternion.set(q[i*4], q[i*4 + 1], q[i*4 + 2], q[i*4 + 3]); b.position.set(p[i*3], p[i*3 + 1], p[i*3 + 2]); }
}
const step = THREE.AnimationMixer.prototype.update;
THREE.AnimationMixer.prototype.update = function (dt) {
  // (only a skeleton's: an animal or a door has its own way)
  if (this._bones === undefined) bonesOf(this);
  if (!this._bones.length) return step.call(this, dt);
  rest(this);
  const r = step.call(this, dt);
  save(this);
  return r;
};
// back to the clip's last pose without stepping it (a frame this body isn't animated)
THREE.AnimationMixer.prototype.rest = function () { if (this._bones && this._bones.length) rest(this); };
