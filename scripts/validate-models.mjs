// Valida os GLBs de um restaurante contra o menu.json e mostra um relatório.
// Uso: node scripts/validate-models.mjs [slug]   (padrão: smash-lab)
// Sai com código 1 se algum modelo falhar.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = process.argv[2] ?? 'smash-lab';
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'restaurants', SLUG, 'menu.json'), 'utf8'));
const modelsRoot = path.join(ROOT, 'assets', 'restaurants', SLUG);

const WARN_BYTES = 1 * 1024 * 1024;
const MAX_BYTES = 5 * 1024 * 1024;
const TOL_HEIGHT = 0.05;
const TOL_WIDTH = 0.12;
const CM = 100;

const COMP = { 5120: [1, Int8Array], 5121: [1, Uint8Array], 5122: [2, Int16Array], 5123: [2, Uint16Array], 5125: [4, Uint32Array], 5126: [4, Float32Array] };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function readGLB(file) {
  const buf = fs.readFileSync(file);
  const errors = [];
  const warns = [];
  if (buf.length < 20) return { errors: ['arquivo muito pequeno'], warns, size: buf.length };
  if (buf.readUInt32LE(0) !== 0x46546c67) errors.push('cabeçalho inválido (magic != glTF)');
  if (buf.readUInt32LE(4) !== 2) errors.push('versão != 2');
  if (buf.readUInt32LE(8) !== buf.length) errors.push(`tamanho no cabeçalho (${buf.readUInt32LE(8)}) difere do arquivo (${buf.length})`);
  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 0x4e4f534a) {
      try {
        json = JSON.parse(data.toString('utf8'));
      } catch {
        errors.push('JSON inválido');
      }
    } else if (type === 0x004e4942) {
      bin = data;
    }
    off += 8 + len; // os chunks já vêm com o tamanho alinhado a 4 bytes
  }
  if (!json) errors.push('chunk JSON ausente');
  if (!bin) errors.push('chunk BIN ausente');
  return { buf, json, bin, errors, warns, size: buf.length };
}

function readAccessor(json, bin, i) {
  const a = json.accessors[i];
  const v = json.bufferViews[a.bufferView];
  const [bytes, Ctor] = COMP[a.componentType];
  const n = NCOMP[a.type];
  const start = (v.byteOffset ?? 0) + (a.byteOffset ?? 0);
  const need = a.count * n * bytes;
  if (start + need > bin.length || (a.byteOffset ?? 0) + need > v.byteLength) {
    throw new Error(`accessor ${i} excede o bufferView/BIN`);
  }
  if (start % bytes !== 0) throw new Error(`accessor ${i} desalinhado`);
  const ab = bin.buffer.slice(bin.byteOffset + start, bin.byteOffset + start + need);
  return { data: new Ctor(ab), n, a };
}

function validate(item) {
  const file = path.join(modelsRoot, item.model);
  const res = { id: item.id, file, errors: [], warns: [], info: {} };
  if (!fs.existsSync(file)) {
    res.errors.push('arquivo não encontrado');
    return res;
  }
  const g = readGLB(file);
  res.errors.push(...g.errors);
  res.info.size = g.size;
  if (g.size > MAX_BYTES) res.errors.push(`pesado demais: ${(g.size / 1048576).toFixed(2)} MB (máx. 5 MB)`);
  else if (g.size > WARN_BYTES) res.warns.push(`acima de 1 MB (${(g.size / 1048576).toFixed(2)} MB)`);
  if (!g.json || !g.bin) return res;
  const { json, bin } = g;

  if (json.asset?.version !== '2.0') res.errors.push('asset.version != 2.0');
  if (json.buffers?.[0]?.byteLength > bin.length) res.errors.push('buffer declarado maior que o BIN');

  let minB = [Infinity, Infinity, Infinity];
  let maxB = [-Infinity, -Infinity, -Infinity];
  let verts = 0;
  let tris = 0;
  try {
    for (const mesh of json.meshes ?? []) {
      for (const prim of mesh.primitives) {
        const mat = json.materials?.[prim.material];
        const pos = readAccessor(json, bin, prim.attributes.POSITION);
        const nrm = readAccessor(json, bin, prim.attributes.NORMAL);
        const idx = readAccessor(json, bin, prim.indices);
        const count = pos.a.count;
        verts += count;
        tris += idx.a.count / 3;
        if (nrm.a.count !== count) res.errors.push(`${mat?.name}: normais != posições`);
        let mn = [Infinity, Infinity, Infinity];
        let mx = [-Infinity, -Infinity, -Infinity];
        for (let i = 0; i < pos.data.length; i += 3) {
          for (let c = 0; c < 3; c++) {
            const v = pos.data[i + c];
            if (!Number.isFinite(v)) res.errors.push(`${mat?.name}: posição não finita`);
            mn[c] = Math.min(mn[c], v);
            mx[c] = Math.max(mx[c], v);
          }
        }
        for (let c = 0; c < 3; c++) {
          if (Math.abs(pos.a.min?.[c] - mn[c]) > 1e-5 || Math.abs(pos.a.max?.[c] - mx[c]) > 1e-5) {
            res.errors.push(`${mat?.name}: min/max do accessor não confere`);
            break;
          }
          minB[c] = Math.min(minB[c], mn[c]);
          maxB[c] = Math.max(maxB[c], mx[c]);
        }
        let badN = 0;
        for (let i = 0; i < nrm.data.length; i += 3) {
          const l = Math.hypot(nrm.data[i], nrm.data[i + 1], nrm.data[i + 2]);
          if (Math.abs(l - 1) > 0.02) badN++;
        }
        if (badN) res.errors.push(`${mat?.name}: ${badN} normais fora do comprimento 1`);
        let bad = 0;
        let vol = 0;
        for (let i = 0; i < idx.data.length; i += 3) {
          const a = idx.data[i], b = idx.data[i + 1], c = idx.data[i + 2];
          if (a >= count || b >= count || c >= count) {
            bad++;
            continue;
          }
          const A = [pos.data[a * 3], pos.data[a * 3 + 1], pos.data[a * 3 + 2]];
          const B = [pos.data[b * 3], pos.data[b * 3 + 1], pos.data[b * 3 + 2]];
          const C = [pos.data[c * 3], pos.data[c * 3 + 1], pos.data[c * 3 + 2]];
          vol += (A[0] * (B[1] * C[2] - B[2] * C[1]) - A[1] * (B[0] * C[2] - B[2] * C[0]) + A[2] * (B[0] * C[1] - B[1] * C[0])) / 6;
        }
        if (bad) res.errors.push(`${mat?.name}: ${bad} triângulos com índice fora do intervalo`);
        const solid = mat && !mat.doubleSided && mat.alphaMode !== 'BLEND';
        if (solid && vol <= 0) res.errors.push(`${mat.name}: faces voltadas para dentro (volume assinado ${vol.toExponential(2)})`);
      }
    }
  } catch (e) {
    res.errors.push(e.message);
    return res;
  }

  const size = [0, 1, 2].map((c) => (maxB[c] - minB[c]) * CM);
  const center = [(minB[0] + maxB[0]) / 2 * CM, (minB[2] + maxB[2]) / 2 * CM];
  res.info = { ...res.info, verts, tris, w: size[0], h: size[1], d: size[2] };

  if (Math.abs(minB[1]) > 1e-4) res.errors.push(`base não está em y=0 (mín. y = ${(minB[1] * CM).toFixed(2)} cm)`);
  if (Math.abs(center[0]) > 0.08 * size[0] || Math.abs(center[1]) > 0.08 * size[2]) {
    res.errors.push(`modelo descentralizado em X/Z (${center[0].toFixed(2)}, ${center[1].toFixed(2)} cm)`);
  }

  const dim = item.dimensionsCm;
  const hErr = Math.abs(size[1] - dim.height) / dim.height;
  if (hErr > TOL_HEIGHT) res.errors.push(`altura ${size[1].toFixed(1)} cm, esperado ${dim.height} cm`);
  if (dim.diameter) {
    const e = Math.abs(Math.max(size[0], size[2]) - dim.diameter) / dim.diameter;
    if (e > TOL_WIDTH) res.errors.push(`diâmetro ${Math.max(size[0], size[2]).toFixed(1)} cm, esperado ${dim.diameter} cm`);
    res.info.dims = `Ø ${Math.max(size[0], size[2]).toFixed(1)} × ${size[1].toFixed(1)}`;
  } else {
    const ew = Math.abs(size[0] - dim.width) / dim.width;
    const ed = Math.abs(size[2] - dim.depth) / dim.depth;
    if (ew > TOL_WIDTH) res.errors.push(`largura ${size[0].toFixed(1)} cm, esperado ${dim.width} cm`);
    if (ed > TOL_WIDTH) res.errors.push(`profundidade ${size[2].toFixed(1)} cm, esperado ${dim.depth} cm`);
    res.info.dims = `${size[0].toFixed(1)} × ${size[2].toFixed(1)} × ${size[1].toFixed(1)}`;
  }
  return res;
}

console.log(`Validação dos modelos de "${SLUG}"\n`);
const rows = menu.items.map(validate);
const pad = (s, n) => String(s).padEnd(n);
console.log(`${pad('', 3)}${pad('Prato', 24)}${pad('Peso', 10)}${pad('Vértices', 10)}${pad('Tamanho (cm)', 22)}Esperado`);
for (const r of rows) {
  const item = menu.items.find((i) => i.id === r.id);
  const d = item.dimensionsCm;
  const exp = d.diameter ? `Ø ${d.diameter} × ${d.height}` : `${d.width} × ${d.depth} × ${d.height}`;
  const mark = r.errors.length ? 'X' : r.warns.length ? '!' : 'OK';
  console.log(
    `${pad(mark, 3)}${pad(r.id, 24)}${pad(r.info.size ? `${Math.round(r.info.size / 1024)} KB` : '-', 10)}${pad(r.info.verts ?? '-', 10)}${pad(r.info.dims ?? '-', 22)}${exp}`,
  );
  for (const e of r.errors) console.log(`     erro: ${e}`);
  for (const w of r.warns) console.log(`     aviso: ${w}`);
}
const failed = rows.filter((r) => r.errors.length).length;
const total = rows.reduce((s, r) => s + (r.info.size ?? 0), 0);
console.log(`\n${rows.length - failed}/${rows.length} modelos válidos, peso total ${(total / 1048576).toFixed(2)} MB`);
process.exit(failed ? 1 : 0);
