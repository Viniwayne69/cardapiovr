// Geometria procedural mínima para gerar os modelos 3D (unidades em cm, eixo Y para cima).
// Cada geometria é { pos: number[], nrm: number[], idx: number[] }.

export const TAU = Math.PI * 2;

export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const newGeo = () => ({ pos: [], nrm: [], idx: [] });

/* ------------------------------------------------------------------ */
/* Transformações (modificam a geometria e devolvem a mesma)           */
/* ------------------------------------------------------------------ */

function normalizeAt(n, i) {
  const l = Math.hypot(n[i], n[i + 1], n[i + 2]) || 1;
  n[i] /= l;
  n[i + 1] /= l;
  n[i + 2] /= l;
}

export function translate(g, x = 0, y = 0, z = 0) {
  const p = g.pos;
  for (let i = 0; i < p.length; i += 3) {
    p[i] += x;
    p[i + 1] += y;
    p[i + 2] += z;
  }
  return g;
}

export function scale(g, sx, sy = sx, sz = sx) {
  const p = g.pos;
  const n = g.nrm;
  for (let i = 0; i < p.length; i += 3) {
    p[i] *= sx;
    p[i + 1] *= sy;
    p[i + 2] *= sz;
    n[i] /= sx;
    n[i + 1] /= sy;
    n[i + 2] /= sz;
    normalizeAt(n, i);
  }
  return g;
}

function rotate(g, f) {
  const p = g.pos;
  const n = g.nrm;
  for (let i = 0; i < p.length; i += 3) {
    const a = f(p[i], p[i + 1], p[i + 2]);
    p[i] = a[0];
    p[i + 1] = a[1];
    p[i + 2] = a[2];
    const b = f(n[i], n[i + 1], n[i + 2]);
    n[i] = b[0];
    n[i + 1] = b[1];
    n[i + 2] = b[2];
  }
  return g;
}

export function rotX(g, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return rotate(g, (x, y, z) => [x, y * c - z * s, y * s + z * c]);
}

export function rotY(g, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return rotate(g, (x, y, z) => [x * c + z * s, y, -x * s + z * c]);
}

export function rotZ(g, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  return rotate(g, (x, y, z) => [x * c - y * s, x * s + y * c, z]);
}

export function merge(list) {
  const out = newGeo();
  for (const g of list) {
    const off = out.pos.length / 3;
    for (let i = 0; i < g.pos.length; i++) out.pos.push(g.pos[i]);
    for (let i = 0; i < g.nrm.length; i++) out.nrm.push(g.nrm[i]);
    for (let i = 0; i < g.idx.length; i++) out.idx.push(g.idx[i] + off);
  }
  return out;
}

export function bounds(g) {
  const b = { minX: Infinity, minY: Infinity, minZ: Infinity, maxX: -Infinity, maxY: -Infinity, maxZ: -Infinity };
  const p = g.pos;
  for (let i = 0; i < p.length; i += 3) {
    b.minX = Math.min(b.minX, p[i]);
    b.maxX = Math.max(b.maxX, p[i]);
    b.minY = Math.min(b.minY, p[i + 1]);
    b.maxY = Math.max(b.maxY, p[i + 1]);
    b.minZ = Math.min(b.minZ, p[i + 2]);
    b.maxZ = Math.max(b.maxZ, p[i + 2]);
  }
  return b;
}

/* ------------------------------------------------------------------ */
/* Superfície de revolução (lathe)                                     */
/* ------------------------------------------------------------------ */
// O perfil é uma lista de [raio, y] percorrida com o sólido à ESQUERDA do
// sentido de percurso: centro da base -> para fora -> para cima -> para dentro
// -> centro do topo. Cantos vivos (ângulo maior que `smooth`) viram arestas duras.

export function lathe(profile, o = {}) {
  const seg = o.seg ?? 40;
  const smooth = o.smooth ?? 52;
  const deform = o.deform ?? null;
  const closed = !!o.closed;
  const n = profile.length;
  const cosT = Math.cos((smooth * Math.PI) / 180);

  const segN = [];
  for (let i = 0; i < n - 1; i++) {
    const dr = profile[i + 1][0] - profile[i][0];
    const dy = profile[i + 1][1] - profile[i][1];
    const l = Math.hypot(dr, dy) || 1;
    segN.push([dy / l, -dr / l]);
  }

  const rings = [];
  const startRing = new Array(n - 1);
  const endRing = new Array(n - 1);
  for (let i = 0; i < n; i++) {
    const rg = profile[i];
    if (i === 0) {
      rings.push(rg);
      startRing[0] = rings.length - 1;
    } else if (i === n - 1) {
      rings.push(rg);
      endRing[n - 2] = rings.length - 1;
    } else {
      const a = segN[i - 1];
      const b = segN[i];
      const d = a[0] * b[0] + a[1] * b[1];
      if (d < cosT) {
        rings.push(rg);
        endRing[i - 1] = rings.length - 1;
        rings.push(rg);
        startRing[i] = rings.length - 1;
      } else {
        rings.push(rg);
        endRing[i - 1] = rings.length - 1;
        startRing[i] = rings.length - 1;
      }
    }
  }

  const S1 = seg + 1;
  const g = newGeo();
  for (let k = 0; k < rings.length; k++) {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * TAU;
      let r = rings[k][0];
      let y = rings[k][1];
      if (deform) {
        const q = deform(r, y, th, k, j);
        r = q[0];
        y = q[1];
      }
      g.pos.push(r * Math.sin(th), y, r * Math.cos(th));
    }
  }

  const acc = new Array(g.pos.length).fill(0);
  const p = g.pos;
  const tri = (a, b, c) => {
    const ax = p[a * 3], ay = p[a * 3 + 1], az = p[a * 3 + 2];
    const e1x = p[b * 3] - ax, e1y = p[b * 3 + 1] - ay, e1z = p[b * 3 + 2] - az;
    const e2x = p[c * 3] - ax, e2y = p[c * 3 + 1] - ay, e2z = p[c * 3 + 2] - az;
    const nx = e1y * e2z - e1z * e2y;
    const ny = e1z * e2x - e1x * e2z;
    const nz = e1x * e2y - e1y * e2x;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    g.idx.push(a, b, c);
    for (const v of [a, b, c]) {
      acc[v * 3] += nx;
      acc[v * 3 + 1] += ny;
      acc[v * 3 + 2] += nz;
    }
  };
  for (let s = 0; s < n - 1; s++) {
    const kA = startRing[s];
    const kB = endRing[s];
    for (let j = 0; j < seg; j++) {
      const a = kA * S1 + j;
      const b = a + 1;
      const c = kB * S1 + j;
      const d = c + 1;
      tri(a, b, c);
      tri(b, d, c);
    }
  }

  // costura (j = 0 e j = seg) e anéis sobre o eixo
  for (let k = 0; k < rings.length; k++) {
    const i0 = (k * S1) * 3;
    const i1 = (k * S1 + seg) * 3;
    for (let c = 0; c < 3; c++) {
      const s = acc[i0 + c] + acc[i1 + c];
      acc[i0 + c] = s;
      acc[i1 + c] = s;
    }
    if (rings[k][0] < 1e-6) {
      const sum = [0, 0, 0];
      for (let j = 0; j <= seg; j++) for (let c = 0; c < 3; c++) sum[c] += acc[(k * S1 + j) * 3 + c];
      for (let j = 0; j <= seg; j++) for (let c = 0; c < 3; c++) acc[(k * S1 + j) * 3 + c] = sum[c];
    }
  }
  if (closed) {
    const last = rings.length - 1;
    for (let j = 0; j <= seg; j++) {
      for (let c = 0; c < 3; c++) {
        const s = acc[(j) * 3 + c] + acc[(last * S1 + j) * 3 + c];
        acc[j * 3 + c] = s;
        acc[(last * S1 + j) * 3 + c] = s;
      }
    }
  }

  for (let i = 0; i < acc.length; i += 3) {
    const l = Math.hypot(acc[i], acc[i + 1], acc[i + 2]);
    if (l < 1e-12) {
      g.nrm.push(0, 1, 0);
    } else {
      g.nrm.push(acc[i] / l, acc[i + 1] / l, acc[i + 2] / l);
    }
  }
  return g;
}

/* ------------------------------------------------------------------ */
/* Perfis e primitivas                                                  */
/* ------------------------------------------------------------------ */

export function arcPts(cx, cy, rx, ry, a0, a1, n) {
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]);
  }
  return pts;
}

// Disco (placa redonda) com borda levemente arredondada.
export function discProfile(R, t, { levels = [0.3, 0.55, 0.75, 0.9], round } = {}) {
  const rd = round ?? Math.min(t * 0.4, 0.15);
  const p = [[0, 0]];
  for (const l of levels) p.push([l * R, 0]);
  p.push([R - rd, 0], [R, rd], [R, t - rd], [R - rd, t]);
  for (const l of [...levels].reverse()) p.push([l * R, t]);
  p.push([0, t]);
  return p;
}

export function sphere(rx, ry = rx, rz = rx, seg = 16, rings = 10) {
  const prof = [];
  for (let i = 0; i <= rings; i++) {
    const f = (Math.PI * i) / rings;
    prof.push([Math.sin(f), -Math.cos(f)]);
  }
  return scale(lathe(prof, { seg, smooth: 90 }), rx, ry, rz);
}

export function cylinder(r, h, seg = 24) {
  return lathe([[0, 0], [r, 0], [r, h], [0, h]], { seg });
}

/* ------------------------------------------------------------------ */
/* Quadrilátero plano e caixa                                           */
/* ------------------------------------------------------------------ */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

export function quad(g, pts, hint) {
  let [a, b, c, d] = pts;
  let n = cross(sub(b, a), sub(c, a));
  if (hint && dot(n, hint) < 0) {
    [b, d] = [d, b];
    n = cross(sub(b, a), sub(c, a));
  }
  const l = Math.hypot(n[0], n[1], n[2]) || 1;
  const base = g.pos.length / 3;
  for (const v of [a, b, c, d]) {
    g.pos.push(v[0], v[1], v[2]);
    g.nrm.push(n[0] / l, n[1] / l, n[2] / l);
  }
  g.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  return g;
}

export function box(w, h, d) {
  const g = newGeo();
  const x = w / 2, y = h / 2, z = d / 2;
  quad(g, [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]], [0, 0, 1]);
  quad(g, [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]], [0, 0, -1]);
  quad(g, [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]], [1, 0, 0]);
  quad(g, [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]], [-1, 0, 0]);
  quad(g, [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]], [0, 1, 0]);
  quad(g, [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]], [0, -1, 0]);
  return g;
}

/* ------------------------------------------------------------------ */
/* Placa ondulada (bacon, fitas)                                        */
/* ------------------------------------------------------------------ */
// Comprimento em X, largura em Z, altura dada por f(x, z). Tem espessura.

export function waveSlab(len, wid, thick, nx, nz, f) {
  const g = newGeo();
  const top = [];
  const bot = [];
  for (let i = 0; i <= nx; i++) {
    top[i] = [];
    bot[i] = [];
    for (let k = 0; k <= nz; k++) {
      const x = -len / 2 + (len * i) / nx;
      const z = -wid / 2 + (wid * k) / nz;
      const y = f(x, z);
      top[i][k] = [x, y + thick / 2, z];
      bot[i][k] = [x, y - thick / 2, z];
    }
  }
  const addGrid = (grid, up) => {
    const base = g.pos.length / 3;
    const W = nz + 1;
    const acc = [];
    for (let i = 0; i <= nx; i++) for (let k = 0; k <= nz; k++) {
      g.pos.push(...grid[i][k]);
      acc.push(0, 0, 0);
    }
    const tri = (a, b, c) => {
      const A = [g.pos[a * 3], g.pos[a * 3 + 1], g.pos[a * 3 + 2]];
      const B = [g.pos[b * 3], g.pos[b * 3 + 1], g.pos[b * 3 + 2]];
      const C = [g.pos[c * 3], g.pos[c * 3 + 1], g.pos[c * 3 + 2]];
      const n = cross(sub(B, A), sub(C, A));
      g.idx.push(a, b, c);
      for (const v of [a, b, c]) {
        const o = (v - base) * 3;
        acc[o] += n[0];
        acc[o + 1] += n[1];
        acc[o + 2] += n[2];
      }
    };
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      const a = base + i * W + k;
      const b = base + (i + 1) * W + k;
      const c = base + i * W + k + 1;
      const d = base + (i + 1) * W + k + 1;
      if (up) {
        tri(a, c, b);
        tri(b, c, d);
      } else {
        tri(a, b, c);
        tri(b, d, c);
      }
    }
    for (let v = 0; v < acc.length; v += 3) {
      const l = Math.hypot(acc[v], acc[v + 1], acc[v + 2]) || 1;
      g.nrm.push(acc[v] / l, acc[v + 1] / l, acc[v + 2] / l);
    }
  };
  addGrid(top, true);
  addGrid(bot, false);
  for (let i = 0; i < nx; i++) {
    quad(g, [top[i][0], top[i + 1][0], bot[i + 1][0], bot[i][0]], [0, 0, -1]);
    quad(g, [top[i][nz], top[i + 1][nz], bot[i + 1][nz], bot[i][nz]], [0, 0, 1]);
  }
  for (let k = 0; k < nz; k++) {
    quad(g, [top[0][k], top[0][k + 1], bot[0][k + 1], bot[0][k]], [-1, 0, 0]);
    quad(g, [top[nx][k], top[nx][k + 1], bot[nx][k + 1], bot[nx][k]], [1, 0, 0]);
  }
  return g;
}
