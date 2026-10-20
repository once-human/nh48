// Asset loading: streamed fetches with byte progress, gzip JSON, texture-array strips, glTF models,
// audio buffers. Everything is fetched relative to the page (published alongside it).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export class Loader {
  constructor(onProgress) {
    this.onProgress = onProgress || (() => {});
    this.total = 0; this.done = 0; this.jobs = new Map();
  }
  // plan: register expected sizes so the progress bar is honest from the start
  expect(url, bytes) { this.jobs.set(url, { size: bytes, got: 0 }); this.total += bytes; }
  _tick(url, got) {
    const j = this.jobs.get(url);
    if (!j) return;
    this.done += got - j.got; j.got = got;
    this.onProgress(this.total ? Math.min(1, this.done / this.total) : 0);
  }
  async bytes(url) {
    // every asset URL carries its content hash, so a new map or model is never served from a stale cache
    let v = null;
    try { v = (Loader.versions || (Loader.versions = JSON.parse(document.getElementById('manifest').textContent).__v || {}))[url]; } catch (e) { Loader.versions = {}; }
    const res = await fetch(v ? url + '?v=' + v : url);
    if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
    const len = +res.headers.get('content-length') || 0;
    if (!this.jobs.has(url)) this.expect(url, len || 1);
    if (!res.body || !res.body.getReader) { const b = new Uint8Array(await res.arrayBuffer()); this._tick(url, this.jobs.get(url).size); return b; }
    const reader = res.body.getReader();
    const parts = []; let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      parts.push(value); got += value.length;
      this._tick(url, Math.min(got, this.jobs.get(url).size));
    }
    this._tick(url, this.jobs.get(url).size);
    const out = new Uint8Array(got);
    let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
    return out;
  }
  async json(url) {
    let b = await this.bytes(url);
    let text;
    if (url.endsWith('.gz.txt')) {
      const bin = atob(new TextDecoder().decode(b).trim());
      b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    }
    if (b[0] === 0x1f && b[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to unpack the map. Please update it.');
      const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
      text = await new Response(stream).text();
    } else text = new TextDecoder().decode(b);
    return JSON.parse(text);
  }
  async bitmap(url) {
    const b = await this.bytes(url);
    const blob = new Blob([b], { type: url.endsWith('.png') ? 'image/png' : 'image/jpeg' });
    return await createImageBitmap(blob, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  }
  // .gz.txt files are gzip wrapped in base64 (the artifact host only serves web types)
  async unwrap(url, b) {
    if (url.endsWith('.txt')) {
      const bin = atob(new TextDecoder().decode(b).trim());
      b = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
    }
    if (b[0] === 0x1f && b[1] === 0x8b) {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser is too old to unpack NH48. Please update it.');
      const stream = new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'));
      b = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    return b;
  }
  async gltf(url) {
    const b = await this.unwrap(url, await this.bytes(url));
    const loader = new GLTFLoader();
    return await new Promise((resolve, reject) => loader.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength), '', resolve, reject));
  }
  async audio(ctx, url) {
    const b = await this.bytes(url);
    return await ctx.decodeAudioData(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
  }
}

// Vertically stacked square layers -> DataArrayTexture (rows flipped per layer so v runs bottom-up
// like a normal texture, which keeps OpenGL-convention normal maps correct).
const _cv = typeof OffscreenCanvas !== 'undefined' ? (w, h) => new OffscreenCanvas(w, h) : (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
export function stripToArray(bmp, { srgb = false, anisotropy = 4, maxSize = 4096 } = {}) {
  const layers = Math.round(bmp.height / bmp.width);
  const size = Math.min(bmp.width, maxSize);
  const cv = _cv(size, size * layers);
  const ctx = cv.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0, bmp.width, bmp.height, 0, 0, size, size * layers);
  const src = ctx.getImageData(0, 0, size, size * layers).data;
  const data = new Uint8Array(src.length);
  const row = size * 4;
  for (let l = 0; l < layers; l++) {
    const base = l * size * row;
    for (let y = 0; y < size; y++) data.set(src.subarray(base + y * row, base + (y + 1) * row), base + (size - 1 - y) * row);
  }
  const tex = new THREE.DataArrayTexture(data, size, size, layers);
  tex.format = THREE.RGBAFormat;
  tex.type = THREE.UnsignedByteType;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = anisotropy;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function bitmapTexture(bmp, { srgb = true, repeat = true } = {}) {
  const tex = new THREE.Texture(bmp);
  tex.flipY = false;
  if (repeat) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}
