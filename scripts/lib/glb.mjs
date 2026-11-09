// Escritor de GLB (glTF 2.0 binário) sem dependências.
// Agrupa as peças por material: cada material vira uma primitiva (um draw call).

import { merge } from './geom.mjs';

const srgbToLinear = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));

export function hexToLinear(hex) {
  const h = hex.replace('#', '');
  return [0, 2, 4].map((i) => srgbToLinear(parseInt(h.slice(i, i + 2), 16) / 255));
}

function toGltfMaterial(name, m) {
  const [r, g, b] = hexToLinear(m.c);
  const a = m.a ?? 1;
  const out = {
    name,
    pbrMetallicRoughness: {
      baseColorFactor: [r, g, b, a],
      metallicFactor: m.m ?? 0,
      roughnessFactor: m.r ?? 0.6,
    },
    doubleSided: !!m.d,
  };
  if (a < 1) out.alphaMode = 'BLEND';
  return out;
}

export function buildGLB({ name, parts, materials, copyright }) {
  const groups = new Map();
  for (const p of parts) {
    if (!materials[p.mat]) throw new Error(`Material desconhecido: ${p.mat}`);
    if (!groups.has(p.mat)) groups.set(p.mat, []);
    groups.get(p.mat).push(p.geo);
  }
  const matNames = [...groups.keys()];

  const chunks = [];
  let offset = 0;
  const bufferViews = [];
  const accessors = [];
  const primitives = [];

  const pushView = (buf, target) => {
    const pad = (4 - (offset % 4)) % 4;
    if (pad) {
      chunks.push(Buffer.alloc(pad));
      offset += pad;
    }
    bufferViews.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target });
    chunks.push(buf);
    offset += buf.length;
    return bufferViews.length - 1;
  };

  matNames.forEach((mat, mi) => {
    const geo = merge(groups.get(mat));
    const vcount = geo.pos.length / 3;
    const pos = new Float32Array(geo.pos);
    const nrm = new Float32Array(geo.nrm);
    const big = vcount > 65535;
    const idx = big ? new Uint32Array(geo.idx) : new Uint16Array(geo.idx);

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < pos.length; i += 3) {
      for (let c = 0; c < 3; c++) {
        min[c] = Math.min(min[c], pos[i + c]);
        max[c] = Math.max(max[c], pos[i + c]);
      }
    }

    const vPos = pushView(Buffer.from(pos.buffer, pos.byteOffset, pos.byteLength), 34962);
    const vNrm = pushView(Buffer.from(nrm.buffer, nrm.byteOffset, nrm.byteLength), 34962);
    const vIdx = pushView(Buffer.from(idx.buffer, idx.byteOffset, idx.byteLength), 34963);

    accessors.push({ bufferView: vPos, componentType: 5126, count: vcount, type: 'VEC3', min, max });
    const aPos = accessors.length - 1;
    accessors.push({ bufferView: vNrm, componentType: 5126, count: vcount, type: 'VEC3' });
    const aNrm = accessors.length - 1;
    accessors.push({ bufferView: vIdx, componentType: big ? 5125 : 5123, count: idx.length, type: 'SCALAR' });
    const aIdx = accessors.length - 1;

    primitives.push({ attributes: { POSITION: aPos, NORMAL: aNrm }, indices: aIdx, material: mi, mode: 4 });
  });

  const json = {
    asset: { version: '2.0', generator: 'cardapio-ar/generate-models', copyright },
    scene: 0,
    scenes: [{ name, nodes: [0] }],
    nodes: [{ name, mesh: 0 }],
    meshes: [{ name, primitives }],
    materials: matNames.map((k) => toGltfMaterial(k, materials[k])),
    accessors,
    bufferViews,
    buffers: [{ byteLength: offset }],
  };

  let jsonBuf = Buffer.from(JSON.stringify(json), 'utf8');
  const jPad = (4 - (jsonBuf.length % 4)) % 4;
  if (jPad) jsonBuf = Buffer.concat([jsonBuf, Buffer.alloc(jPad, 0x20)]);

  let bin = Buffer.concat(chunks);
  const bPad = (4 - (bin.length % 4)) % 4;
  if (bPad) bin = Buffer.concat([bin, Buffer.alloc(bPad)]);

  const total = 12 + 8 + jsonBuf.length + 8 + bin.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(total, 8);

  const jh = Buffer.alloc(8);
  jh.writeUInt32LE(jsonBuf.length, 0);
  jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8);
  bh.writeUInt32LE(bin.length, 0);
  bh.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jh, jsonBuf, bh, bin]);
}
