// ez-tree ships its own bark/leaf images; NH48 supplies its own textures, so the library's
// texture module is replaced with this stub at build time (see tools/build.mjs).
export function getBarkTexture() { return null; }
export function getLeafTexture() { return null; }
