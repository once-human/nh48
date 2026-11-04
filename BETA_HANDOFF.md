# /beta handoff

Read this first if you're picking this up in a new session. Update it and push after every change.

## What Onkar wants
Puneri rebuilt at **nh48.vercel.app/beta** with a **new painted renderer** (the look and speed of `/experiment`: pencil, ink, paper, shadows).
- **Keep from main:** game logic (physics, traffic, rides/fares, police, hunger/mood/clock, shops, audio/voices, weather, save), the UI as it is, and data (road layout, footprints, landmark shapes and positions).
- **Never:** main's renderer drawing something with paint on top. Every visible thing gets rebuilt for the new renderer. Drawing must not affect logic.
- **More detail than the main game, not less:** "extreme details" for people, vehicles, trees and more. The look stays painted. He wants it to look realer.
- No auto at the start: start on foot. Story and cutscenes are cut. Nobody randomly changes clothes or hair.
- The main game at `/` must not change: edit only `src/beta/` and `tools/build-beta.mjs`.

## Working rules
- Push after every single change: `git push origin beta && git push origin beta:main` (he asked for this, /beta only appears from main).
- Never cancel a Vercel deployment without asking.
- Talk to him plainly. If something isn't what he asked for, say so before building it.

## Plan, in order
1. [ ] Settings: Graphics and Audio sections. Graphics presets Auto, Lite, Low, Medium, High (Auto default), and each setting has the same options, including resolution and MSAA. Auto: MSAA from PC power only, never from frame drops. On an FPS drop, find what's causing it (GPU or CPU limited) and lower that one setting a step, not everything; raise it back when there's room.
2. [ ] People and player: real bones, all existing animations (umbrella, punch, etc.) baked to a texture so a crowd stays one fast draw; clothes and accessories from the experiment and Jhola purchases; very detailed.
3. [ ] Vehicles: detailed models for every type, instanced, built for the paint.
4. [ ] Trees and grass: better than main's old trees; grass back.
5. [ ] Shadows: new and cheap; only what matters casts.
6. [ ] Ground and roads: main's layout, new meshes for this renderer.
7. [ ] Landmarks, props, sky, far city, parked vehicles, animals: same shapes and positions, rebuilt for this renderer.
8. [ ] Later, from the original plan: shops redesigned by kind and class, accessories in shops, phone redesign, then the new UI.

## How it's built
- `tools/build-beta.mjs` swaps modules at build time (`SWAPS`); `@orig/<path>` reaches the original file. Local build: `NH_LOCAL=1 node tools/build-beta.mjs`, output `dist/beta/index.html`.
- `src/beta/draw/actors.js`: draws people and vehicles from game logic, hides main's. `src/beta/world/trees.js`, `grass.js`: keep main's data, hide its drawing.
- `src/beta/world/`: buildings and footpaths, drawn in a worker. `src/beta/gfx/paint.js`: paint materials (`PU` uniforms). `src/beta/gfx/post.js`: ink and paper pass.

## State
- Live and working, reported 60 FPS at High on Onkar's PC after the old trees, people and traffic stopped drawing (commit 4fcd1497).
- Current look is temporary: blocky vehicles, no bones, simple trees, no grass, resolution capped to 1, MSAA off.
- Black ground pattern: attempted fix in post.js, not confirmed.
