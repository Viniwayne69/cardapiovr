// Gerador de QR code sem dependências (modo byte, versões 1 a 40, correção de erro L/M/Q/H).
// Baseado no algoritmo descrito na ISO/IEC 18004. Uso: encodeQR("https://...", "M") -> { size, modules }.

const ECC_FORMAT_BITS = { L: 1, M: 0, Q: 3, H: 2 };
const ECC_PER_BLOCK = {
  L: [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  M: [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  Q: [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  H: [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
};
const NUM_BLOCKS = {
  L: [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  M: [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  Q: [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  H: [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
};

const bit = (x, i) => ((x >>> i) & 1) !== 0;

function rawDataModules(ver) {
  let r = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2;
    r -= (25 * n - 10) * n - 55;
    if (ver >= 7) r -= 36;
  }
  return r;
}

const dataCodewords = (ver, ecl) => Math.floor(rawDataModules(ver) / 8) - ECC_PER_BLOCK[ecl][ver] * NUM_BLOCKS[ecl][ver];

function gfMul(x, y) {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 2);
  }
  return result;
}

function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0);
  for (const b of data) {
    const factor = b ^ result.shift();
    result.push(0);
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)));
  }
  return result;
}

function addEccAndInterleave(data, ver, ecl) {
  const numBlocks = NUM_BLOCKS[ecl][ver];
  const eccLen = ECC_PER_BLOCK[ecl][ver];
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const blocks = [];
  const div = rsDivisor(eccLen);
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const ecc = rsRemainder(dat, div);
    if (i < numShort) dat.push(0);
    blocks.push(dat.concat(ecc));
  }
  const result = [];
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]);
    });
  }
  return result;
}

class Matrix {
  constructor(ver) {
    this.ver = ver;
    this.size = ver * 4 + 17;
    this.m = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.f = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  setFn(x, y, dark) {
    this.m[y][x] = dark;
    this.f[y][x] = true;
  }

  drawFunctionPatterns(ecl) {
    const { size } = this;
    for (let i = 0; i < size; i++) {
      this.setFn(6, i, i % 2 === 0);
      this.setFn(i, 6, i % 2 === 0);
    }
    this.finder(3, 3);
    this.finder(size - 4, 3);
    this.finder(3, size - 4);
    const pos = this.alignPositions();
    const last = pos.length - 1;
    for (let i = 0; i < pos.length; i++) {
      for (let j = 0; j < pos.length; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
        this.align(pos[i], pos[j]);
      }
    }
    this.formatBits(ecl, 0);
    this.versionBits();
  }

  finder(x, y) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.setFn(xx, yy, d !== 2 && d !== 4);
      }
    }
  }

  align(x, y) {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) this.setFn(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }

  alignPositions() {
    const { ver, size } = this;
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const result = [6];
    for (let pos = size - 7; result.length < n; pos -= step) result.splice(1, 0, pos);
    return result;
  }

  formatBits(ecl, mask) {
    const { size } = this;
    const data = (ECC_FORMAT_BITS[ecl] << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    for (let i = 0; i <= 5; i++) this.setFn(8, i, bit(bits, i));
    this.setFn(8, 7, bit(bits, 6));
    this.setFn(8, 8, bit(bits, 7));
    this.setFn(7, 8, bit(bits, 8));
    for (let i = 9; i < 15; i++) this.setFn(14 - i, 8, bit(bits, i));
    for (let i = 0; i < 8; i++) this.setFn(size - 1 - i, 8, bit(bits, i));
    for (let i = 8; i < 15; i++) this.setFn(8, size - 15 + i, bit(bits, i));
    this.setFn(8, size - 8, true);
  }

  versionBits() {
    const { ver, size } = this;
    if (ver < 7) return;
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const c = bit(bits, i);
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFn(a, b, c);
      this.setFn(b, a, c);
    }
  }

  drawCodewords(data) {
    const { size } = this;
    let i = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < size; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? size - 1 - vert : vert;
          if (!this.f[y][x] && i < data.length * 8) {
            this.m[y][x] = bit(data[i >>> 3], 7 - (i & 7));
            i++;
          }
        }
      }
    }
  }

  applyMask(mask) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        let inv;
        switch (mask) {
          case 0: inv = (x + y) % 2 === 0; break;
          case 1: inv = y % 2 === 0; break;
          case 2: inv = x % 3 === 0; break;
          case 3: inv = (x + y) % 3 === 0; break;
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
        }
        if (!this.f[y][x] && inv) this.m[y][x] = !this.m[y][x];
      }
    }
  }

  penalty() {
    const { size, m } = this;
    let score = 0;
    const lines = [];
    for (let i = 0; i < size; i++) {
      lines.push(m[i].slice());
      lines.push(m.map((row) => row[i]));
    }
    for (const line of lines) {
      let run = 1;
      for (let i = 1; i <= size; i++) {
        if (i < size && line[i] === line[i - 1]) run++;
        else {
          if (run >= 5) score += run - 2;
          run = 1;
        }
      }
      const s = line.map((v) => (v ? '1' : '0')).join('');
      score += 40 * [...s.matchAll(/(?=(00001011101|10111010000))/g)].length;
    }
    for (let y = 0; y < size - 1; y++) {
      for (let x = 0; x < size - 1; x++) {
        if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) score += 3;
      }
    }
    let dark = 0;
    for (const row of m) for (const v of row) if (v) dark++;
    const k = Math.ceil(Math.abs(dark * 20 - size * size * 10) / (size * size)) - 1;
    return score + Math.max(0, k) * 10;
  }
}

export function encodeQR(text, ecl = 'M') {
  const bytes = [...new TextEncoder().encode(text)];
  let ver = 1;
  for (; ; ver++) {
    const cap = dataCodewords(ver, ecl) * 8;
    const used = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8;
    if (used <= cap) break;
    if (ver >= 40) throw new Error('Texto longo demais para o QR code');
  }
  const bits = [];
  const push = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0x4, 4);
  push(bytes.length, ver < 10 ? 8 : 16);
  bytes.forEach((b) => push(b, 8));
  const cap = dataCodewords(ver, ecl) * 8;
  push(0, Math.min(4, cap - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));

  const all = addEccAndInterleave(data, ver, ecl);
  const base = new Matrix(ver);
  base.drawFunctionPatterns(ecl);
  base.drawCodewords(all);

  let best = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const mx = new Matrix(ver);
    mx.m = base.m.map((r) => r.slice());
    mx.f = base.f;
    mx.applyMask(mask);
    mx.formatBits(ecl, mask);
    const score = mx.penalty();
    if (score < bestScore) {
      bestScore = score;
      best = mx;
    }
  }
  return { size: best.size, modules: best.m, version: ver };
}

// Desenha o QR como SVG vetorial (nítido em qualquer tamanho de impressão).
export function qrToSvg(qr, { quiet = 4, dark = '#000', light = '#fff', label = 'QR code' } = {}) {
  const n = qr.size + quiet * 2;
  let path = '';
  qr.modules.forEach((row, y) =>
    row.forEach((v, x) => {
      if (v) path += `M${x + quiet} ${y + quiet}h1v1h-1z`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges" role="img" aria-label="${label}"><rect width="${n}" height="${n}" fill="${light}"/><path d="${path}" fill="${dark}"/></svg>`;
}
