// Prepara um GLB vindo de uma ferramenta de imagem para 3D (ex.: TRELLIS) para uso no cardápio.
// Uso: node scripts/prepare-scan.mjs <arquivo.glb> <id-do-prato> [slug] [--q=3]
//
// O que faz:
//  1. Escala o modelo (uniforme) para o diâmetro/largura real do prato em menu.json,
//     centraliza em X/Z e apoia a base em y=0.
//  2. Recalcula as normais (suaves, soldando as costuras de UV), porque o modelo vem sem elas.
//  3. Ajusta o material para PBR de comida (não metálico, rugosidade média).
//  4. Troca índices para 16 bits e a textura PNG por JPEG (via ffmpeg) para reduzir o peso.
//  5. Guarda o arquivo original em source-models/<slug>/<id>.raw.glb e grava o GLB final em
//     assets/restaurants/<slug>/<item.model>.
// A altura resultante vem da proporção do modelo; se diferir de dimensionsCm, o script avisa.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const flags = Object.fromEntries(process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => a.slice(2).split('=')));
const [input, id, slug = 'smash-lab'] = args;
if (!input || !id) {
  console.error('Uso: node scripts/prepare-scan.mjs <arquivo.glb> <id-do-prato> [slug] [--q=3]');
  process.exit(1);
}
const JPEG_Q = Number(flags.q ?? 3); // ffmpeg -q:v (2 = melhor, 31 = pior)

const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'restaurants', slug, 'menu.json'), 'utf8'));
const item = menu.items.find((i) => i.id === id);
if (!item) throw new Error(`prato "${id}" não existe em menu.json`);
const dim = item.dimensionsCm;
const targetWidthCm = dim.diameter ?? dim.width;

// ---------- leitura do GLB ----------
const raw = fs.readFileSync(input);
if (raw.readUInt32LE(0) !== 0x46546c67) throw new Error('não é um GLB');
let off = 12;
let json;
let bin;
while (off + 8 <= raw.length) {
  const len = raw.readUInt32LE(off);
  const type = raw.readUInt32LE(off + 4);
  const data = raw.subarray(off + 8, off + 8 + len);
  if (type === 0x4e4f534a) json = JSON.parse(data.toString('utf8'));
  else if (type === 0x004e4942) bin = data;
  off += 8 + len;
}
if (!json || !bin) throw new Error('GLB sem JSON ou BIN');
if (json.meshes.length !== 1 || json.meshes[0].primitives.length !== 1) throw new Error('esperado 1 mesh com 1 primitiva');

function view(accIndex, Ctor, comps) {
  const a = json.accessors[accIndex];
  const v = json.bufferViews[a.bufferView];
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const n = a.count * comps;
  const copy = bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + n * Ctor.BYTES_PER_ELEMENT);
  return new Ctor(copy);
}

const prim = json.meshes[0].primitives[0];
const pos = view(prim.attributes.POSITION, Float32Array, 3);
const uv = view(prim.attributes.TEXCOORD_0, Float32Array, 2);
const idxAcc = json.accessors[prim.indices];
const idx = view(prim.indices, idxAcc.componentType === 5125 ? Uint32Array : Uint16Array, 1);
const vcount = pos.length / 3;
if (vcount > 65535) throw new Error('mais de 65535 vértices: precisa de índices de 32 bits');

// ---------- textura: PNG -> JPEG ----------
const imgView = json.bufferViews[json.images[0].bufferView];
let imgBytes = bin.subarray(imgView.byteOffset ?? 0, (imgView.byteOffset ?? 0) + imgView.byteLength);
if (json.images[0].mimeType === 'image/png') {
  // alguns exportadores deixam bytes extras depois do PNG; corta no marcador IEND (+4 bytes de CRC)
  const end = imgBytes.indexOf(Buffer.from('IEND'));
  if (end > 0) imgBytes = imgBytes.subarray(0, end + 8);
}
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'scan-'));
const tmpIn = path.join(tmp, 'tex.' + (json.images[0].mimeType === 'image/jpeg' ? 'jpg' : 'png'));
const tmpOut = path.join(tmp, 'tex-out.jpg');
fs.writeFileSync(tmpIn, imgBytes);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', tmpIn, '-q:v', String(JPEG_Q), '-pix_fmt', 'yuvj420p', tmpOut]);
const jpeg = fs.readFileSync(tmpOut);
fs.rmSync(tmp, { recursive: true, force: true });

// ---------- escala, centro e base ----------
const mn = [Infinity, Infinity, Infinity];
const mx = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) {
  for (let c = 0; c < 3; c++) {
    mn[c] = Math.min(mn[c], pos[i + c]);
    mx[c] = Math.max(mx[c], pos[i + c]);
  }
}
const ext = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
const s = targetWidthCm / 100 / Math.max(ext[0], ext[2]);
const cx = (mn[0] + mx[0]) / 2;
const cz = (mn[2] + mx[2]) / 2;
for (let i = 0; i < pos.length; i += 3) {
  pos[i] = (pos[i] - cx) * s;
  pos[i + 1] = (pos[i + 1] - mn[1]) * s;
  pos[i + 2] = (pos[i + 2] - cz) * s;
}
const outMin = [Infinity, Infinity, Infinity];
const outMax = [-Infinity, -Infinity, -Infinity];
for (let i = 0; i < pos.length; i += 3) {
  for (let c = 0; c < 3; c++) {
    outMin[c] = Math.min(outMin[c], pos[i + c]);
    outMax[c] = Math.max(outMax[c], pos[i + c]);
  }
}

// ---------- orientação das faces ----------
let vol = 0;
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
  vol += (pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
    - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
    + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c])) / 6;
}
let flipped = false;
if (vol < 0) {
  for (let i = 0; i < idx.length; i += 3) {
    const t = idx[i + 1];
    idx[i + 1] = idx[i + 2];
    idx[i + 2] = t;
  }
  flipped = true;
}

// ---------- normais suaves (soldando vértices coincidentes) ----------
const groupOf = new Int32Array(vcount);
const groups = new Map();
for (let v = 0; v < vcount; v++) {
  const key = `${Math.round(pos[v * 3] * 1e6)},${Math.round(pos[v * 3 + 1] * 1e6)},${Math.round(pos[v * 3 + 2] * 1e6)}`;
  let g = groups.get(key);
  if (g === undefined) {
    g = groups.size;
    groups.set(key, g);
  }
  groupOf[v] = g;
}
const acc = new Float64Array(groups.size * 3);
for (let i = 0; i < idx.length; i += 3) {
  const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; // ponderada pela área
  for (const k of [idx[i], idx[i + 1], idx[i + 2]]) {
    const g = groupOf[k] * 3;
    acc[g] += nx;
    acc[g + 1] += ny;
    acc[g + 2] += nz;
  }
}
const nrm = new Float32Array(vcount * 3);
for (let v = 0; v < vcount; v++) {
  const g = groupOf[v] * 3;
  const l = Math.hypot(acc[g], acc[g + 1], acc[g + 2]) || 1;
  nrm[v * 3] = acc[g] / l;
  nrm[v * 3 + 1] = acc[g + 1] / l;
  nrm[v * 3 + 2] = acc[g + 2] / l;
}

// ---------- montagem do GLB ----------
const idx16 = new Uint16Array(idx);
const chunks = [
  { data: Buffer.from(idx16.buffer), target: 34963 },
  { data: Buffer.from(pos.buffer), target: 34962 },
  { data: Buffer.from(nrm.buffer), target: 34962 },
  { data: Buffer.from(uv.buffer), target: 34962 },
  { data: jpeg },
];
const views = [];
let binLen = 0;
for (const c of chunks) {
  views.push({ buffer: 0, byteOffset: binLen, byteLength: c.data.length, ...(c.target ? { target: c.target } : {}) });
  binLen += Math.ceil(c.data.length / 4) * 4;
}
const binOut = Buffer.alloc(binLen);
chunks.forEach((c, i) => c.data.copy(binOut, views[i].byteOffset));

const outJson = {
  asset: { version: '2.0', generator: 'cardapio-ar prepare-scan', copyright: 'Modelo gerado por IA a partir de imagem (cardapio-ar)' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [{ name: id, mesh: 0 }],
  meshes: [{ name: id, primitives: [{ attributes: { POSITION: 1, NORMAL: 2, TEXCOORD_0: 3 }, indices: 0, material: 0, mode: 4 }] }],
  materials: [{ name: id, pbrMetallicRoughness: { baseColorTexture: { index: 0 }, metallicFactor: 0, roughnessFactor: 0.7 }, doubleSided: false }],
  textures: [{ source: 0, sampler: 0 }],
  samplers: [{ magFilter: 9729, minFilter: 9987, wrapS: 33071, wrapT: 33071 }],
  images: [{ bufferView: 4, mimeType: 'image/jpeg' }],
  accessors: [
    { bufferView: 0, componentType: 5123, count: idx16.length, type: 'SCALAR' },
    { bufferView: 1, componentType: 5126, count: vcount, type: 'VEC3', min: outMin, max: outMax },
    { bufferView: 2, componentType: 5126, count: vcount, type: 'VEC3' },
    { bufferView: 3, componentType: 5126, count: vcount, type: 'VEC2' },
  ],
  bufferViews: views,
  buffers: [{ byteLength: binLen }],
};

let jsonStr = JSON.stringify(outJson);
jsonStr += ' '.repeat((4 - (jsonStr.length % 4)) % 4);
const jsonBuf = Buffer.from(jsonStr, 'utf8');
const total = 12 + 8 + jsonBuf.length + 8 + binOut.length;
const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0);
header.writeUInt32LE(2, 4);
header.writeUInt32LE(total, 8);
const jh = Buffer.alloc(8);
jh.writeUInt32LE(jsonBuf.length, 0);
jh.writeUInt32LE(0x4e4f534a, 4);
const bh = Buffer.alloc(8);
bh.writeUInt32LE(binOut.length, 0);
bh.writeUInt32LE(0x004e4942, 4);
const glb = Buffer.concat([header, jh, jsonBuf, bh, binOut]);

// ---------- gravação ----------
const srcDir = path.join(ROOT, 'source-models', slug);
fs.mkdirSync(srcDir, { recursive: true });
const rawCopy = path.join(srcDir, `${id}.raw.glb`);
if (path.resolve(input) !== rawCopy) fs.copyFileSync(input, rawCopy);
const outFile = path.join(ROOT, 'assets', 'restaurants', slug, item.model);
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, glb);

const hCm = (outMax[1] - outMin[1]) * 100;
console.log(`${id}: ${(raw.length / 1024).toFixed(0)} KB -> ${(glb.length / 1024).toFixed(0)} KB (textura JPEG ${(jpeg.length / 1024).toFixed(0)} KB)`);
console.log(`escala ${s.toFixed(4)}  largura ${(ext[0] * s * 100).toFixed(1)} × ${(ext[2] * s * 100).toFixed(1)} cm  altura ${hCm.toFixed(1)} cm  (menu.json: ${JSON.stringify(dim)})`);
console.log(`vértices ${vcount}  triângulos ${idx.length / 3}  faces ${flipped ? 'invertidas (corrigido)' : 'ok'}`);
if (dim.height && Math.abs(hCm - dim.height) / dim.height > 0.05) {
  console.log(`AVISO: altura ${hCm.toFixed(1)} cm difere de dimensionsCm.height (${dim.height} cm); ajuste menu.json para ${hCm.toFixed(1)}.`);
}
console.log(`gravado em ${path.relative(ROOT, outFile)}  (original em ${path.relative(ROOT, rawCopy)})`);
