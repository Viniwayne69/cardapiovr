// Formatação em português do Brasil.

const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const moneyCache = new Map();

export const num = (n) => decimal.format(n);

export function money(value, currency = 'BRL') {
  if (!moneyCache.has(currency)) {
    moneyCache.set(currency, new Intl.NumberFormat('pt-BR', { style: 'currency', currency }));
  }
  return moneyCache.get(currency).format(value);
}

// Medidas reais do prato, como aparecem no detalhe.
export function dimensions(d) {
  if (!d) return null;
  if (d.diameter) {
    return { text: `Ø ${num(d.diameter)} cm × ${num(d.height)} cm`, hint: 'diâmetro × altura' };
  }
  return { text: `${num(d.width)} × ${num(d.depth)} × ${num(d.height)} cm`, hint: 'largura × profundidade × altura' };
}

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Cor de texto legível sobre um fundo hexadecimal.
export function readableOn(hex, light = '#ffffff', dark = '#1b1209') {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return light;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.42 ? dark : light;
}
