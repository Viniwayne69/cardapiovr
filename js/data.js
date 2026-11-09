// Leitura dos parâmetros da URL e do cardápio (data/restaurants/<slug>/menu.json).

export const DEFAULT_SLUG = 'smash-lab';

export function readParams() {
  const q = new URLSearchParams(location.search);
  const raw = (q.get('r') || DEFAULT_SLUG).toLowerCase();
  const slug = /^[a-z0-9-]{1,60}$/.test(raw) ? raw : null;
  const mesaRaw = (q.get('mesa') || '').trim();
  const mesa = /^[0-9a-zA-Z-]{1,6}$/.test(mesaRaw) ? mesaRaw : null;
  return { slug, mesa };
}

export async function loadMenu(slug) {
  if (!slug) throw new Error('not-found');
  const res = await fetch(`data/restaurants/${slug}/menu.json`, { cache: 'no-cache' });
  if (res.status === 404) throw new Error('not-found');
  if (!res.ok) throw new Error('network');
  const menu = await res.json();
  const base = `assets/restaurants/${slug}/`;
  menu.items = (menu.items ?? []).map((it) => ({
    ...it,
    modelUrl: base + it.model,
    posterUrl: it.poster ? base + it.poster : null,
  }));
  return menu;
}
