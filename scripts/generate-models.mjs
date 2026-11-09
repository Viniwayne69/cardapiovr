// Gera os modelos 3D (GLB) estilizados da demo, por geometria procedural.
// Uso: node scripts/generate-models.mjs [slug]   (padrão: smash-lab)
//
// ATENÇÃO: são modelos PLACEHOLDER, feitos para demonstrar o fluxo de AR.
// Para usar modelos reais, basta substituir o arquivo .glb mantendo o caminho no menu.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from './lib/geom.mjs';
import { buildGLB } from './lib/glb.mjs';

const { TAU } = G;
const T = G.translate;
const PI = Math.PI;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = process.argv[2] ?? 'smash-lab';
const menu = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'restaurants', SLUG, 'menu.json'), 'utf8'));
const outDir = path.join(ROOT, 'assets', 'restaurants', SLUG, 'models');

/* ------------------------------------------------------------------ */
/* Materiais PBR (cores em sRGB, convertidas para linear na gravação)   */
/* c = cor, r = rugosidade, m = metálico, a = opacidade, d = dupla face */
/* ------------------------------------------------------------------ */
const MATERIALS = {
  bun: { c: '#C9772B', r: 0.55 },
  bunWG: { c: '#8C5A2C', r: 0.65 },
  seed: { c: '#F3E3B5', r: 0.6 },
  patty: { c: '#3B1F12', r: 0.8 },
  pattyVeg: { c: '#6A2B2F', r: 0.85 },
  cheddar: { c: '#F29A1C', r: 0.35 },
  cheese: { c: '#F8D65C', r: 0.35 },
  lettuce: { c: '#5DAE2E', r: 0.5, d: true },
  arugula: { c: '#2F6E1C', r: 0.55, d: true },
  tomato: { c: '#C9281D', r: 0.35 },
  pickle: { c: '#6F8B25', r: 0.4 },
  onion: { c: '#9B5B1F', r: 0.5 },
  sauce: { c: '#F0B26B', r: 0.35 },
  mayo: { c: '#F7EBCF', r: 0.35 },
  sauceGreen: { c: '#A5C45F', r: 0.4 },
  bacon: { c: '#B23C22', r: 0.55, d: true },
  baconFat: { c: '#F0C2A0', r: 0.55, d: true },
  fry: { c: '#EDB63A', r: 0.6 },
  fryDark: { c: '#D79A22', r: 0.6 },
  paperOrange: { c: '#E8571F', r: 0.8, d: true },
  paperCream: { c: '#F8EEDF', r: 0.8, d: true },
  breading: { c: '#D6A044', r: 0.9 },
  bowl: { c: '#2B211B', r: 0.5 },
  cheddarSauce: { c: '#E8780A', r: 0.18 },
  baconBits: { c: '#6B1F14', r: 0.7 },
  chive: { c: '#4C9A2A', r: 0.6 },
  canBody: { c: '#2B1612', r: 0.35, m: 0.8 },
  canStripe: { c: '#E8571F', r: 0.4, m: 0.7 },
  canCream: { c: '#F8EEDF', r: 0.4, m: 0.6 },
  alu: { c: '#C9CED3', r: 0.3, m: 1 },
  canDark: { c: '#1A1210', r: 0.5, m: 0.5 },
  glass: { c: '#DCEBFA', r: 0.05, a: 0.16, d: true },
  shake: { c: '#6B3418', r: 0.3 },
  cream: { c: '#FBF6EC', r: 0.5 },
  chocoSauce: { c: '#1F0E07', r: 0.12 },
  cherry: { c: '#B3091E', r: 0.15 },
  strawOr: { c: '#E8571F', r: 0.5 },
  strawCream: { c: '#F8EEDF', r: 0.5 },
  lemonade: { c: '#F1EE9A', r: 0.2, a: 0.92 },
  ice: { c: '#F4FAFF', r: 0.1, a: 0.5, d: true },
  lemonRind: { c: '#F5C518', r: 0.45 },
  lemonPith: { c: '#FBF3C8', r: 0.6 },
  lemonFlesh: { c: '#F0DE55', r: 0.3 },
  mint: { c: '#2E8B3A', r: 0.5, d: true },
  ceramic: { c: '#F4EFE8', r: 0.25 },
  brownie: { c: '#2B150B', r: 0.65 },
  vanilla: { c: '#FBEBC0', r: 0.6 },
  nut: { c: '#8A5E34', r: 0.7 },
  strawSauce: { c: '#B01030', r: 0.15 },
  strawIce: { c: '#F6A5B8', r: 0.55 },
  wafer: { c: '#D9A55E', r: 0.8 },
};

const SEG = 44;
const mk = () => {
  const parts = [];
  return { parts, add: (geo, mat) => parts.push({ geo, mat }) };
};

/* ------------------------------------------------------------------ */
/* Componentes de hambúrguer                                            */
/* ------------------------------------------------------------------ */

const bunHeel = (R = 5.5, h = 2.05) =>
  G.lathe([[0, 0], [R - 0.8, 0], [R - 0.3, 0.22], [R, 0.75], [R - 0.02, h - 0.55], [R - 0.35, h], [0, h]], { seg: SEG });

function bunCrown(R = 5.5, H = 3.7, nSeeds = 30, seed = 7) {
  const hh = H - 0.25;
  const yAt = (a) => 0.25 + hh * Math.pow(Math.sin(a), 0.85);
  const rAt = (a) => R * Math.pow(Math.cos(a), 0.8);
  const prof = [[0, 0], [R - 0.5, 0], [R - 0.12, 0.14]];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * (PI / 2);
    prof.push(i === N ? [0, H] : [rAt(a), yAt(a)]);
  }
  const bun = G.lathe(prof, { seg: SEG });

  const rnd = G.rng(seed);
  const seeds = [];
  for (let k = 0; k < nSeeds; k++) {
    const u = Math.sqrt((k + 0.5) / nSeeds) * 0.85;
    const a = PI / 2 - u;
    const th = k * 2.39996 + rnd() * 0.3;
    const r = rAt(a);
    const y = yAt(a);
    const da = 1e-3;
    const dr = (rAt(a + da) - rAt(a - da)) / (2 * da);
    const dy = (yAt(a + da) - yAt(a - da)) / (2 * da);
    const nl = Math.hypot(dy, dr) || 1;
    const q = Math.atan2(dy / nl, -dr / nl);
    const s = G.sphere(0.3, 0.1, 0.17, 6, 4);
    G.rotY(s, rnd() * TAU);
    G.rotZ(s, -q);
    G.rotY(s, th - PI / 2);
    seeds.push(T(s, r * Math.sin(th), y + 0.03, r * Math.cos(th)));
  }
  return { bun, seeds: G.merge(seeds) };
}

function patty(R = 5.3, t = 1.2, seed = 3, bumpy = 1) {
  const rnd = G.rng(seed);
  const ph = [rnd() * TAU, rnd() * TAU, rnd() * TAU, rnd() * TAU];
  const prof = [
    [0, 0], [R * 0.5, 0], [R * 0.9, 0], [R, 0.2], [R + 0.05, t * 0.5],
    [R * 0.96, t - 0.15], [R * 0.8, t], [R * 0.4, t + 0.03], [0, t + 0.04],
  ];
  return G.lathe(prof, {
    seg: SEG,
    deform: (r, y, th) => {
      const e = Math.max(0, r / R - 0.8) / 0.2;
      const n1 = Math.sin(th * 7 + ph[0]) * 0.5 + Math.sin(th * 13 + ph[1]) * 0.3 + Math.sin(th * 23 + ph[2]) * 0.2;
      const top = y > t * 0.6 ? Math.sin(th * 5 + ph[3] + r) * Math.cos(r * 2.1 + ph[1]) * 0.07 * bumpy : 0;
      return [r * (1 + 0.045 * n1 * e), y + top + e * 0.08 * n1];
    },
  });
}

// Fatia de queijo derretida: quadrada com cantos arredondados, caindo pelas bordas do hambúrguer.
function cheese(Rf = 5.2, t = 0.24, droop = 1.1) {
  return G.lathe(G.discProfile(Rf, t, { levels: [0.3, 0.55, 0.72, 0.84, 0.93] }), {
    seg: SEG,
    deform: (r, y, th) => {
      const tp = th + PI / 4;
      const p = 3;
      const sf = 1 / Math.pow(Math.pow(Math.abs(Math.cos(tp)), p) + Math.pow(Math.abs(Math.sin(tp)), p), 1 / p);
      const corner = (sf - 1) / 0.122;
      const rr = r / Rf;
      const melt = 0.55 * Math.pow(rr, 5) + droop * corner * Math.pow(rr, 3.5);
      return [r * sf, y - melt];
    },
  });
}

function lettuce(R = 5.7, amp = 0.3, freq = 7, seed = 2) {
  const rnd = G.rng(seed);
  const p1 = rnd() * TAU;
  const p2 = rnd() * TAU;
  return G.lathe(G.discProfile(R, 0.12, { levels: [0.25, 0.5, 0.7, 0.85] }), {
    seg: SEG,
    deform: (r, y, th) => {
      const rr = r / R;
      const wave = Math.sin(th * freq + p1) * amp * rr * rr + Math.sin(th * (freq + 5) + p2) * amp * 0.35 * rr * rr;
      return [r * (1 + 0.05 * Math.sin(th * (freq + 4) + p2)), y + wave + 0.25 * Math.pow(rr, 3)];
    },
  });
}

const tomatoSlice = (R = 3.7, t = 0.7) =>
  G.lathe([[0, 0], [R * 0.7, 0], [R * 0.97, 0.05], [R, t * 0.5], [R * 0.97, t - 0.05], [R * 0.7, t], [0, t]], { seg: 32 });

const pickleSlice = (R = 1.6, t = 0.28, seed = 1) =>
  G.lathe(G.discProfile(R, t, { levels: [0.5, 0.8] }), {
    seg: 20,
    deform: (r, y, th) => [r * (1 + 0.05 * Math.sin(th * 9 + seed)), y],
  });

function sauceDisc(R = 4.9, t = 0.3, seed = 1) {
  return G.lathe(G.discProfile(R, t, { levels: [0.4, 0.7, 0.9] }), {
    seg: SEG,
    deform: (r, y, th) => [r * (1 + 0.07 * Math.sin(th * 9 + seed) + 0.03 * Math.sin(th * 17 + seed * 2)), y],
  });
}

function onionPile(R, count, seed) {
  const rnd = G.rng(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const s = G.sphere(0.9 + rnd() * 0.5, 0.3 + rnd() * 0.15, 0.45 + rnd() * 0.2, 8, 5);
    G.rotY(s, rnd() * TAU);
    const rad = Math.sqrt(rnd()) * R;
    const a = rnd() * TAU;
    parts.push(T(s, rad * Math.cos(a), rnd() * 0.3, rad * Math.sin(a)));
  }
  return G.merge(parts);
}

function baconStrips(seed = 1) {
  const lean = [];
  const fat = [];
  [[0.3, 1.5], [-0.35, -1.5]].forEach(([ang, zoff], i) => {
    const f = (x, z) => Math.sin(x * 1.5 + seed + i * 2) * 0.2 + Math.sin(x * 0.7 + z * 2) * 0.07 - 0.045 * x * x;
    const a = G.waveSlab(10.8, 2.5, 0.22, 26, 3, f);
    const b = G.waveSlab(10.8, 0.7, 0.24, 26, 1, (x, z) => f(x, z) + 0.01);
    for (const [g, bucket] of [[a, lean], [b, fat]]) {
      G.rotY(g, ang);
      T(g, 0, 0, zoff * 0.8);
      bucket.push(g);
    }
  });
  return { lean: G.merge(lean), fat: G.merge(fat) };
}

function arugulaLeaves(R, count, seed) {
  const rnd = G.rng(seed);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const s = G.sphere(1.7, 0.1, 0.5, 8, 5);
    G.rotZ(s, (rnd() - 0.5) * 0.3);
    G.rotY(s, rnd() * TAU);
    const rad = Math.sqrt(rnd()) * R;
    const a = rnd() * TAU;
    parts.push(T(s, rad * Math.cos(a), rnd() * 0.3, rad * Math.sin(a)));
  }
  return G.merge(parts);
}

/* ------------------------------------------------------------------ */
/* Hambúrgueres                                                         */
/* ------------------------------------------------------------------ */

function classico() {
  const { parts, add } = mk();
  let y = 0;
  add(bunHeel(), 'bun');
  y += 2.0;
  add(T(sauceDisc(5.0, 0.3, 1), 0, y, 0), 'sauce');
  y += 0.22;
  add(T(lettuce(5.75, 0.3, 7, 2), 0, y, 0), 'lettuce');
  y += 0.5;
  add(T(tomatoSlice(), -1.3, y, 0.2), 'tomato');
  add(T(tomatoSlice(), 1.4, y + 0.1, -0.3), 'tomato');
  y += 0.75;
  add(T(patty(4.95, 1.3, 3), 0, y - 0.05, 0), 'patty');
  y += 1.28;
  add(T(cheese(5.2, 0.24, 1.1), 0, y - 0.02, 0), 'cheese');
  y += 0.2;
  const c = bunCrown(5.5, 3.7, 32, 7);
  add(T(c.bun, 0, y - 0.05, 0), 'bun');
  add(T(c.seeds, 0, y - 0.05, 0), 'seed');
  return parts;
}

function cheddarBacon() {
  const { parts, add } = mk();
  let y = 0;
  add(bunHeel(5.5, 2.15), 'bun');
  y += 2.1;
  add(T(sauceDisc(5.0, 0.3, 4), 0, y, 0), 'mayo');
  y += 0.25;
  add(T(patty(4.95, 1.9, 5), 0, y - 0.05, 0), 'patty');
  y += 1.88;
  add(T(cheese(5.2, 0.24, 1.1), 0, y - 0.02, 0), 'cheddar');
  y += 0.22;
  add(T(G.rotY(cheese(5.05, 0.24, 1.0), PI / 4), 0, y - 0.03, 0), 'cheddar');
  y += 0.22;
  const b = baconStrips(2);
  add(T(b.lean, 0, y + 0.1, 0), 'bacon');
  add(T(b.fat, 0, y + 0.13, 0), 'baconFat');
  y += 0.62;
  const c = bunCrown(5.5, 4.1, 34, 11);
  add(T(c.bun, 0, y - 0.05, 0), 'bun');
  add(T(c.seeds, 0, y - 0.05, 0), 'seed');
  return parts;
}

function duploSmash() {
  const { parts, add } = mk();
  let y = 0;
  add(bunHeel(5.5, 2.1), 'bun');
  y += 2.05;
  add(T(sauceDisc(5.0, 0.28, 6), 0, y, 0), 'sauce');
  y += 0.22;
  add(T(patty(4.95, 1.0, 8), 0, y - 0.03, 0), 'patty');
  y += 0.98;
  add(T(cheese(5.2, 0.24, 1.1), 0, y - 0.02, 0), 'cheese');
  y += 0.2;
  add(T(patty(4.9, 1.0, 9), 0, y - 0.03, 0), 'patty');
  y += 0.98;
  add(T(G.rotY(cheese(5.2, 0.24, 1.1), PI / 4), 0, y - 0.02, 0), 'cheese');
  y += 0.2;
  const rnd = G.rng(21);
  [[-3.9, 0.4], [0.3, -3.9], [3.7, 0.9], [-1.0, 3.9], [3.0, -2.8]].forEach(([x, z], i) => {
    add(T(pickleSlice(1.7, 0.3, i), x, y + (i % 2) * 0.12, z), 'pickle');
  });
  y += 0.3;
  add(T(onionPile(3.9, 11, 13), 0, y, 0), 'onion');
  y += 0.45;
  const c = bunCrown(5.5, 3.9, 32, 5 + Math.floor(rnd() * 3));
  add(T(c.bun, 0, y - 0.05, 0), 'bun');
  add(T(c.seeds, 0, y - 0.05, 0), 'seed');
  return parts;
}

function veggie() {
  const { parts, add } = mk();
  let y = 0;
  add(bunHeel(5.5, 1.95), 'bunWG');
  y += 1.9;
  add(T(sauceDisc(5.0, 0.28, 3), 0, y, 0), 'sauceGreen');
  y += 0.22;
  add(T(arugulaLeaves(4.2, 16, 5), 0, y, 0), 'arugula');
  y += 0.35;
  add(T(tomatoSlice(3.6, 0.65), -1.2, y, 0.3), 'tomato');
  add(T(tomatoSlice(3.6, 0.65), 1.3, y + 0.08, -0.3), 'tomato');
  y += 0.62;
  add(T(patty(4.8, 1.45, 17, 2.2), 0, y - 0.05, 0), 'pattyVeg');
  y += 1.42;
  add(T(cheese(5.0, 0.24, 0.9), 0, y - 0.02, 0), 'cheese');
  y += 0.2;
  const c = bunCrown(5.5, 3.3, 30, 19);
  add(T(c.bun, 0, y - 0.05, 0), 'bunWG');
  add(T(c.seeds, 0, y - 0.05, 0), 'seed');
  return parts;
}

/* ------------------------------------------------------------------ */
/* Porções                                                              */
/* ------------------------------------------------------------------ */

function frySticks(rnd, n, place) {
  const a = [];
  const b = [];
  for (let i = 0; i < n; i++) {
    const g = place(i, rnd);
    (rnd() > 0.45 ? a : b).push(g);
  }
  return { a: G.merge(a), b: G.merge(b) };
}

function batataFrita() {
  const { parts, add } = mk();
  const wb = 4.2, wt = 5.8, db = 2.5, dt = 3.8, Hb = 9.2, Hf = 6.4;
  const corner = (sx, sz, y) => [
    sx * (wb + ((wt - wb) * y) / Hb),
    y,
    sz * (db + ((dt - db) * y) / Hb),
  ];
  const box = G.newGeo();
  const bot = [corner(-1, -1, 0), corner(1, -1, 0), corner(1, 1, 0), corner(-1, 1, 0)];
  G.quad(box, bot, [0, -1, 0]);
  G.quad(box, [corner(-1, 1, 0), corner(1, 1, 0), corner(1, 1, Hf), corner(-1, 1, Hf)], [0, 0.2, 1]);
  G.quad(box, [corner(1, -1, 0), corner(-1, -1, 0), corner(-1, -1, Hb), corner(1, -1, Hb)], [0, 0.2, -1]);
  G.quad(box, [corner(-1, -1, 0), corner(-1, 1, 0), corner(-1, 1, Hf), corner(-1, -1, Hb)], [-1, 0.2, 0]);
  G.quad(box, [corner(1, 1, 0), corner(1, -1, 0), corner(1, -1, Hb), corner(1, 1, Hf)], [1, 0.2, 0]);
  add(box, 'paperOrange');

  const band = G.newGeo();
  const off = 0.04;
  const yb = [2.0, 3.8];
  const front = (y) => corner(1, 1, y);
  const back = (y) => corner(1, -1, y);
  const lerpZ = (c, dz) => [c[0], c[1], c[2] + dz];
  G.quad(band, [lerpZ(corner(-1, 1, yb[0]), off), lerpZ(front(yb[0]), off), lerpZ(front(yb[1]), off), lerpZ(corner(-1, 1, yb[1]), off)], [0, 0.2, 1]);
  G.quad(band, [lerpZ(back(yb[0]), -off), lerpZ(corner(-1, -1, yb[0]), -off), lerpZ(corner(-1, -1, yb[1]), -off), lerpZ(back(yb[1]), -off)], [0, 0.2, -1]);
  add(band, 'paperCream');

  const rnd = G.rng(31);
  const sticks = frySticks(rnd, 46, (i) => {
    const L = i === 0 ? 10.2 : 6.4 + rnd() * 3.4;
    const g = T(G.box(0.95, L, 0.95), 0, L / 2, 0);
    G.rotY(g, rnd() * 0.6);
    const base = i === 0 ? 3.8 : 2.6 + rnd() * 1.3;
    const tilt = i === 0 ? 0.05 : (rnd() - 0.5) * 0.4;
    G.rotZ(g, tilt);
    G.rotX(g, (rnd() - 0.4) * 0.35 + (i === 0 ? 0 : 0.05));
    const x = i === 0 ? 0.4 : (rnd() - 0.5) * 6.6;
    const z = i === 0 ? 0 : (rnd() - 0.5) * 3.2;
    return T(g, x, base, z);
  });
  add(sticks.a, 'fry');
  add(sticks.b, 'fryDark');
  return parts;
}

function onionRings() {
  const { parts, add } = mk();
  const rnd = G.rng(41);
  const ringGeo = (Ro, Ri, h, seed) => {
    const Rc = (Ro + Ri) / 2;
    const a = (Ro - Ri) / 2;
    const b = h / 2;
    const n = 3;
    const prof = [];
    const N = 18;
    for (let i = 0; i <= N; i++) {
      const f = (i / N) * TAU;
      const c = Math.cos(f);
      const s = Math.sin(f);
      prof.push([Rc + a * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), b + b * Math.sign(s) * Math.pow(Math.abs(s), 2 / n)]);
    }
    prof[N] = prof[0];
    return G.lathe(prof, {
      seg: 40,
      smooth: 80,
      closed: true,
      deform: (r, y, th, k) => {
        const bump = Math.sin(th * 13 + k * 1.7 + seed) * 0.09 + Math.sin(th * 29 + k * 2.3) * 0.05;
        return [r + bump, y + Math.sin(th * 11 + seed) * 0.06];
      },
    });
  };
  // Monte de argolas: 3 deitadas na base, 2 apoiadas por cima e 1 em pé encostada.
  const rings = [
    // [raio externo, x, y, z, inclinação X, inclinação Z, giro Y, material]
    [3.05, 1.45, 0.85, 0.0, 0.0, 0.0, 0.0, 'breading'],
    [3.05, -0.75, 0.85, 1.25, 0.0, 0.0, 1.0, 'fryDark'],
    [3.05, -0.75, 0.85, -1.25, 0.0, 0.0, 2.1, 'breading'],
    [3.0, 0.2, 2.5, 0.6, 0.3, 0.2, 0.4, 'fryDark'],
    [2.9, -0.4, 2.55, -0.7, -0.25, 0.25, 1.7, 'breading'],
    [2.8, 0.1, 4.55, 0.1, 1.05, 0.1, 0.8, 'fryDark'],
  ];
  rings.forEach(([Ro, x, y, z, rx, rz, ry, mat], i) => {
    const g = ringGeo(Ro, Ro - 1.75, 1.7, i * 3 + 1);
    G.rotX(g, rx);
    G.rotZ(g, rz);
    G.rotY(g, ry);
    add(T(g, x, y, z), mat);
  });
  return parts;
}

function batataCheddarBacon() {
  const { parts, add } = mk();
  const bowlProf = [[0, 0], [3.4, 0], [3.7, 0.3], [5.3, 1.9], [7.0, 4.4], [6.75, 4.4], [5.1, 2.1], [3.3, 0.9], [0, 0.85]];
  add(G.lathe(bowlProf, { seg: SEG }), 'bowl');
  const ri = (y) => (y < 0.9 ? 3.2 : 3.3 + ((y - 0.9) / (4.4 - 0.9)) * (6.75 - 3.3));
  const rnd = G.rng(51);
  const sticks = frySticks(rnd, 70, () => {
    const rad = Math.sqrt(rnd()) * 3.1;
    const ang = rnd() * TAU;
    const ytop = 4.3 + 0.8 * (1 - rad / 3.4);
    const y = 1.3 + rnd() * (ytop - 1.3);
    let L = 4.2 + rnd() * 2.4;
    L = Math.max(2.2, Math.min(L, 2 * (ri(y) - rad - 0.45)));
    const g = G.box(0.68, L, 0.68);
    G.rotZ(g, PI / 2 + (rnd() - 0.5) * 0.8);
    G.rotY(g, rnd() * TAU);
    return T(g, rad * Math.cos(ang), y, rad * Math.sin(ang));
  });
  add(sticks.a, 'fry');
  add(sticks.b, 'fryDark');

  const cheddarParts = [];
  for (let i = 0; i < 14; i++) {
    const rad = Math.sqrt(rnd()) * 3.2;
    const ang = rnd() * TAU;
    const s = G.sphere(1.5 + rnd() * 0.9, 0.45, 1.3 + rnd() * 0.7, 14, 7);
    G.rotY(s, rnd() * TAU);
    cheddarParts.push(T(s, rad * Math.cos(ang), 5.0 + rnd() * 0.35, rad * Math.sin(ang)));
  }
  for (let i = 0; i < 5; i++) {
    const ang = rnd() * TAU;
    const s = G.sphere(0.32, 0.8, 0.32, 8, 6);
    cheddarParts.push(T(s, 3.1 * Math.cos(ang), 4.35, 3.1 * Math.sin(ang)));
  }
  add(G.merge(cheddarParts), 'cheddarSauce');

  const bits = [];
  for (let i = 0; i < 28; i++) {
    const rad = Math.sqrt(rnd()) * 3.6;
    const ang = rnd() * TAU;
    const g = G.box(0.55, 0.32, 0.5);
    G.rotY(g, rnd() * TAU);
    G.rotX(g, (rnd() - 0.5) * 0.6);
    bits.push(T(g, rad * Math.cos(ang), 5.45 + rnd() * 0.4, rad * Math.sin(ang)));
  }
  add(G.merge(bits), 'baconBits');

  const chives = [];
  for (let i = 0; i < 24; i++) {
    const rad = Math.sqrt(rnd()) * 3.6;
    const ang = rnd() * TAU;
    const g = G.cylinder(0.09, 0.85, 6);
    G.rotZ(g, PI / 2);
    G.rotY(g, rnd() * TAU);
    chives.push(T(g, rad * Math.cos(ang), 5.65 + rnd() * 0.4, rad * Math.sin(ang)));
  }
  add(G.merge(chives), 'chive');
  return parts;
}

/* ------------------------------------------------------------------ */
/* Bebidas                                                              */
/* ------------------------------------------------------------------ */

function refrigerante() {
  const { parts, add } = mk();
  const seg = 40;
  add(G.lathe([[0, 0.45], [2.0, 0.45], [2.45, 0], [3.0, 0.3], [3.3, 0.8], [3.3, 1.3], [0, 1.3]], { seg }), 'alu');
  add(G.lathe([[0, 1.3], [3.3, 1.3], [3.3, 10.7], [0, 10.7]], { seg }), 'canBody');
  const band = (y0, y1, mat, grow = 0.012) => add(G.lathe([[0, y0], [3.3 + grow, y0], [3.3 + grow, y1], [0, y1]], { seg }), mat);
  band(5.0, 7.2, 'canStripe');
  band(4.6, 4.85, 'canCream', 0.016);
  band(7.35, 7.6, 'canCream', 0.016);
  add(G.lathe([[0, 10.7], [3.3, 10.7], [3.3, 10.9], [2.85, 11.6], [2.6, 11.75], [2.6, 12.2], [2.35, 12.2], [2.35, 11.85], [0, 11.85]], { seg }), 'alu');
  add(T(G.sphere(0.95, 0.09, 0.55, 14, 6), 0.35, 11.94, 0), 'alu');
  add(T(G.sphere(0.5, 0.03, 0.28, 12, 6), -0.85, 11.88, 0), 'canDark');
  return parts;
}

function glassShell({ H, rb, rt, wall = 0.16, floor = 1.3, seg = 40 }) {
  const ro = (y) => rb + ((rt - rb) * y) / H;
  const ri = (y) => ro(y) - wall;
  const prof = [[0, 0], [ro(0) - 0.5, 0], [ro(0.35), 0.35], [ro(H), H], [ri(H), H], [ri(floor), floor], [0, floor]];
  return { shell: G.lathe(prof, { seg, smooth: 50 }), ri, floor, H };
}

const liquidIn = (gl, level, inset = 0.03, seg = 40) =>
  G.lathe(
    [[0, gl.floor + 0.03], [gl.ri(gl.floor) - inset, gl.floor + 0.03], [gl.ri(level) - inset, level], [gl.ri(level) * 0.55, level + 0.04], [0, level + 0.07]],
    { seg },
  );

function swirlR(R0, t, turns) {
  return Math.max(0, R0 * Math.pow(1 - t, 0.75) * (1 + 0.14 * Math.sin(t * TAU * turns)));
}

function swirl(R0, y0, h, turns, seg = 36) {
  const pts = [[0, y0], [R0 * 0.93, y0]];
  const N = 26;
  for (let i = 1; i <= N; i++) {
    const t = i / N;
    pts.push(i === N ? [0, y0 + h] : [swirlR(R0, t, turns), y0 + h * Math.pow(t, 0.9)]);
  }
  return G.lathe(pts, {
    seg,
    deform: (r, y, th) => [r * (1 + 0.06 * Math.sin(th * 3 + y * 1.6)), y],
  });
}

function candyStraw(parts, base, tiltZ, length, r, matA, matB, tiltX = 0) {
  const A = [];
  const B = [];
  const segLen = 1.2;
  const n = Math.ceil(length / segLen);
  for (let i = 0; i < n; i++) {
    const L = Math.min(segLen, length - i * segLen);
    (i % 2 ? B : A).push(T(G.cylinder(r, L, 10), 0, i * segLen, 0));
  }
  for (const [list, mat] of [[A, matA], [B, matB]]) {
    if (!list.length) continue;
    const g = G.merge(list);
    G.rotZ(g, tiltZ);
    G.rotX(g, tiltX);
    T(g, base[0], base[1], base[2]);
    parts.push({ geo: g, mat });
  }
}

function milkshake() {
  const { parts, add } = mk();
  const gl = glassShell({ H: 13.5, rb: 3.0, rt: 4.0, wall: 0.16, floor: 1.5 });
  add(gl.shell, 'glass');
  add(liquidIn(gl, 12.2), 'shake');
  const y0 = 12.15;
  const h = 4.0;
  add(swirl(3.55, y0, h, 3.5), 'cream');
  for (const t of [0.22, 0.5]) {
    const R = swirlR(3.55, t, 3.5) + 0.05;
    const y = y0 + h * Math.pow(t, 0.9);
    const prof = G.arcPts(R, y, 0.13, 0.13, 0, TAU, 10);
    add(G.lathe(prof, { seg: 40, smooth: 80, closed: true }), 'chocoSauce');
  }
  add(T(G.sphere(0.85, 0.8, 0.85, 14, 10), 0, y0 + h + 0.5, 0), 'cherry');
  add(T(G.rotZ(G.cylinder(0.05, 1.3, 6), 0.4), 0, y0 + h + 1.1, 0), 'chive');
  candyStraw(parts, [1.0, 1.9, 0.5], -0.13, 16.1, 0.3, 'strawOr', 'strawCream');
  return parts;
}

function limonada() {
  const { parts, add } = mk();
  const gl = glassShell({ H: 11.0, rb: 3.3, rt: 3.95, wall: 0.17, floor: 1.3 });
  add(gl.shell, 'glass');
  add(liquidIn(gl, 9.4), 'lemonade');
  const rnd = G.rng(61);
  const ice = [];
  for (let i = 0; i < 7; i++) {
    const g = G.box(2.1, 2.1, 2.1);
    G.rotX(g, rnd() * TAU);
    G.rotY(g, rnd() * TAU);
    G.rotZ(g, rnd() * TAU);
    const rad = Math.sqrt(rnd()) * 1.8;
    const a = rnd() * TAU;
    ice.push(T(g, rad * Math.cos(a), 6.2 + (i / 6) * 3.9 + rnd() * 0.3, rad * Math.sin(a)));
  }
  add(G.merge(ice), 'ice');
  // rodela de limão presa na borda (plano vertical, voltada para a frente)
  const cz = 3.88;
  const cy = 11.6;
  const wheel = (R, t, mat, dz) => add(T(G.rotX(G.lathe(G.discProfile(R, t, { levels: [0.5, 0.85], round: 0.03 }), { seg: 36 }), PI / 2), 0, cy, cz + dz), mat);
  wheel(2.3, 0.3, 'lemonRind', -0.15);
  wheel(2.12, 0.34, 'lemonPith', -0.16);
  wheel(1.95, 0.36, 'lemonFlesh', -0.17);
  const spokes = [];
  for (let i = 0; i < 8; i++) {
    const g = G.box(0.1, 1.85, 0.05);
    T(g, 0, 0.925, 0);
    G.rotZ(g, (i / 8) * TAU);
    spokes.push(T(g, 0, cy, cz + 0.21));
  }
  add(G.merge(spokes), 'lemonPith');
  const leaves = [];
  [[-1.2, 10.4, 0.4, 0.3], [0.9, 10.6, -0.8, 2.1], [-0.3, 10.7, 1.2, 4.2]].forEach(([x, y, z, rot]) => {
    const l = G.sphere(1.0, 0.07, 0.5, 10, 6);
    G.rotZ(l, 0.3);
    G.rotY(l, rot);
    leaves.push(T(l, x, y, z));
  });
  add(G.merge(leaves), 'mint');
  candyStraw(parts, [0.9, 1.7, -0.5], -0.1, 12.2, 0.28, 'strawCream', 'strawOr');
  return parts;
}

/* ------------------------------------------------------------------ */
/* Sobremesas                                                           */
/* ------------------------------------------------------------------ */

function dripCap(R, ry, cy, a0, seed, dripDepth = 1.2) {
  const rnd = G.rng(seed);
  const ph = rnd() * TAU;
  const pts = [];
  const N = 8;
  for (let i = 0; i <= N; i++) {
    const a = a0 + ((PI / 2 - a0) * i) / N;
    pts.push(i === N ? [0, cy + ry * 1.01] : [R * 1.01 * Math.cos(a), cy + ry * 1.01 * Math.sin(a)]);
  }
  return G.lathe(pts, {
    seg: 40,
    deform: (r, y, th, k) => {
      if (k !== 0) return [r, y];
      const d = Math.pow(Math.abs(Math.sin(th * 2.5 + ph)), 5) * dripDepth + Math.abs(Math.sin(th * 6 + ph)) * 0.15;
      return [r * (1 + d * 0.06), y - d];
    },
  });
}

function brownieSorvete() {
  const { parts, add } = mk();
  add(G.lathe([[0, 0], [4.6, 0], [4.9, 0.15], [7.0, 1.0], [7.0, 1.2], [6.8, 1.2], [6.6, 1.1], [4.5, 0.45], [0, 0.45]], { seg: SEG }), 'ceramic');
  const py = 0.45;
  // poça de calda
  add(
    T(G.lathe(G.discProfile(4.1, 0.12, { levels: [0.5, 0.8] }), {
      seg: 40,
      deform: (r, y, th) => [r * (1 + 0.1 * Math.sin(th * 3 + 1) + 0.05 * Math.sin(th * 7)), y],
    }), 0.2, py, 0.1),
    'chocoSauce',
  );
  const rnd = G.rng(71);
  const brown = G.lathe(G.discProfile(3.5, 3.4, { levels: [0.3, 0.6, 0.85], round: 0.25 }), {
    seg: 40,
    deform: (r, y, th) => {
      const p = 6;
      const sf = 1 / Math.pow(Math.pow(Math.abs(Math.cos(th)), p) + Math.pow(Math.abs(Math.sin(th)), p), 1 / p);
      const top = y > 3 ? Math.sin(th * 5 + r * 3) * 0.05 + Math.cos(th * 9 + r * 5) * 0.04 : 0;
      return [r * sf, y + top];
    },
  });
  G.rotY(brown, 0.2);
  add(T(brown, 0, py + 0.1, 0), 'brownie');
  const top = py + 0.1 + 3.4;
  const scoop = G.lathe(
    [[0, -1.9], [1.8, -1.9], [2.5, -1.5], [2.8, -1.2], [2.5, -0.9], [2.55, -0.2], [2.4, 0.6], [1.8, 1.6], [0.9, 2.2], [0, 2.4]],
    {
      seg: 36,
      deform: (r, y, th) => (y < -0.8 ? [r * (1 + 0.06 * Math.sin(th * 14)), y] : [r, y]),
    },
  );
  const cy = top + 1.75;
  add(T(scoop, 0.1, cy, 0), 'vanilla');
  add(T(dripCap(2.55, 2.55, 0, 0.9, 5, 1.1), 0.1, cy, 0), 'chocoSauce');
  const nuts = [];
  [[-3.2, py + 0.3, 1.9], [2.6, py + 0.3, -2.4], [3.8, py + 0.3, 1.2], [0.5, cy + 2.35, 0.3], [-0.6, cy + 2.25, -0.5]].forEach(([x, y, z], i) => {
    const s = G.sphere(0.45, 0.32, 0.4, 7, 5);
    G.rotY(s, rnd() * TAU);
    nuts.push(T(s, x, y, z));
  });
  add(G.merge(nuts), 'nut');
  return parts;
}

function sundaeMorango() {
  const { parts, add } = mk();
  const outer = [[0, 0], [2.6, 0], [2.95, 0.2], [2.85, 0.45], [1.6, 0.8], [0.5, 1.3], [0.42, 3.0], [1.0, 3.5], [2.4, 4.3], [3.7, 5.8], [4.5, 8.6]];
  const inner = [[4.33, 8.6], [3.55, 5.8], [2.2, 4.4], [0.85, 3.75], [0, 3.7]];
  add(G.lathe([...outer, ...inner], { seg: SEG, smooth: 50 }), 'glass');
  const ip = [[0, 3.7], [0.85, 3.75], [2.2, 4.4], [3.55, 5.8], [4.33, 8.6]];
  const ri = (y) => {
    for (let i = 0; i < ip.length - 1; i++) {
      if (y <= ip[i + 1][1]) {
        const t = (y - ip[i][1]) / (ip[i + 1][1] - ip[i][1]);
        return ip[i][0] + t * (ip[i + 1][0] - ip[i][0]);
      }
    }
    return ip[ip.length - 1][0];
  };
  const fill = (y0, y1, cap) => {
    const pts = [[0, y0]];
    const steps = 8;
    for (let i = 0; i <= steps; i++) {
      const y = y0 + ((y1 - y0) * i) / steps;
      pts.push([ri(y) - 0.04, y]);
    }
    if (cap) {
      const R = ri(y1) - 0.04;
      for (let i = 1; i <= 8; i++) {
        const a = ((PI / 2) * i) / 8;
        pts.push(i === 8 ? [0, y1 + cap] : [R * Math.cos(a), y1 + cap * Math.sin(a)]);
      }
    } else {
      pts.push([0, y1]);
    }
    return G.lathe(pts, { seg: 40, deform: (r, y) => [r, y] });
  };
  add(fill(3.78, 5.75), 'vanilla');
  add(fill(5.7, 6.45), 'strawSauce');
  add(G.lathe(((() => {
    const pts = [[0, 6.4]];
    for (let i = 0; i <= 6; i++) {
      const y = 6.4 + (2.2 * i) / 6;
      pts.push([ri(y) - 0.04, y]);
    }
    for (let i = 1; i <= 8; i++) {
      const a = ((PI / 2) * i) / 8;
      pts.push(i === 8 ? [0, 10.1] : [4.25 * Math.cos(a), 8.6 + 1.5 * Math.sin(a)]);
    }
    return pts;
  })()), { seg: 40, deform: (r, y, th) => [r * (1 + 0.025 * Math.sin(th * 5)), y] }), 'strawIce');
  add(dripCap(4.25, 1.5, 8.6, 0.55, 9, 1.0), 'strawSauce');
  add(swirl(2.5, 9.85, 1.9, 2.5, 32), 'cream');
  add(T(G.sphere(0.75, 0.72, 0.75, 14, 10), 0, 11.8 + 0.45, 0), 'cherry');
  const wafer = T(G.box(0.9, 3.8, 0.2), 0, 1.9, 0);
  G.rotZ(wafer, 0.55);
  add(T(wafer, -1.7, 8.8, 0.3), 'wafer');
  return parts;
}

/* ------------------------------------------------------------------ */
/* Acabamento: escala do item, base em y = 0, centralizado, em metros   */
/* ------------------------------------------------------------------ */

function finalize(parts, targetH) {
  const all = G.merge(parts.map((p) => p.geo));
  let b = G.bounds(all);
  const sy = targetH / (b.maxY - b.minY);
  for (const p of parts) G.scale(p.geo, 1, sy, 1);
  b = G.bounds(G.merge(parts.map((p) => p.geo)));
  const dx = -(b.minX + b.maxX) / 2;
  const dy = -b.minY;
  const dz = -(b.minZ + b.maxZ) / 2;
  for (const p of parts) {
    G.translate(p.geo, dx, dy, dz);
    G.scale(p.geo, 0.01);
  }
  return sy;
}

const BUILDERS = {
  classico,
  'cheddar-bacon': cheddarBacon,
  'duplo-smash': duploSmash,
  veggie,
  'batata-frita': batataFrita,
  'onion-rings': onionRings,
  'batata-cheddar-bacon': batataCheddarBacon,
  refrigerante,
  'milkshake-chocolate': milkshake,
  'limonada-suica': limonada,
  'brownie-sorvete': brownieSorvete,
  'sundae-morango': sundaeMorango,
};

fs.mkdirSync(outDir, { recursive: true });
const only = process.argv[3];
let total = 0;
for (const item of menu.items) {
  if (only && item.id !== only) continue;
  const build = BUILDERS[item.id];
  if (!build) {
    console.warn(`(sem gerador para "${item.id}", mantendo o arquivo existente)`);
    continue;
  }
  const parts = build();
  const sy = finalize(parts, item.dimensionsCm.height);
  const file = path.join(outDir, path.basename(item.model));
  const glb = buildGLB({
    name: item.id,
    parts,
    materials: MATERIALS,
    copyright: 'Modelo placeholder estilizado gerado por script (cardapio-ar)',
  });
  fs.writeFileSync(file, glb);
  total += glb.length;
  const verts = parts.reduce((s, p) => s + p.geo.pos.length / 3, 0);
  const tris = parts.reduce((s, p) => s + p.geo.idx.length / 3, 0);
  console.log(`${item.id.padEnd(22)} ${String(Math.round(glb.length / 1024)).padStart(5)} KB  ${String(verts).padStart(6)} vértices  ${String(tris).padStart(6)} triângulos  (escala Y ${sy.toFixed(2)})`);
}
console.log(`\nTotal: ${(total / 1024 / 1024).toFixed(2)} MB em ${outDir}`);
