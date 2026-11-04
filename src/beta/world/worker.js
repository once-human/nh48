// The painted city's builder, off the main thread. It gets the areas once, then a chunk at a time (its base drawing,
// or its close-up one), and sends back the finished geometry (compact typed arrays, moved, not copied). Pure drawing:
// nothing the game decides comes from here (doors, shutters, boards and footprints are worked out on the main
// thread, from the map).
import { buildChunk } from './builder.js';
import { AreaField } from './areas.js';

let area = null;
self.onmessage = (e) => {
  const m = e.data;
  if (m.pts) { area = AreaField.fromPts(m.pts); return; }
  let out = null, err = null;
  try { out = buildChunk(m.job, area, m.kind); } catch (x) { err = String(x && x.stack || x); }
  const tr = [];
  if (out) for (const c of out.cells) for (const k in c) { const g = c[k]; if (g) tr.push(g.pos.buffer, g.nor.buffer, g.col.buffer, g.kind.buffer, g.aux.buffer, g.uv.buffer, g.idx.buffer); }
  self.postMessage({ id: m.id, out, err }, tr);
};
