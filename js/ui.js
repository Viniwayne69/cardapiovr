// Renderização das telas: cabeçalho, abas, lista, Sobre e Contato.

import { icon } from './icons.js';
import { money, escapeHtml as esc, readableOn } from './format.js';

const BADGE_ICONS = { 'mais pedido': 'crown' };
const DEFAULT_HIGHLIGHTS = ['mais pedido', 'favorito', 'queridinha'];

/* ------------------------------ tema ------------------------------ */

export function applyTheme(theme = {}) {
  const root = document.documentElement.style;
  const map = { primary: '--primary', accent: '--accent', background: '--bg', surface: '--surface', text: '--text' };
  for (const [key, cssVar] of Object.entries(map)) {
    if (theme[key]) root.setProperty(cssVar, theme[key]);
  }
  if (theme.primary) root.setProperty('--on-primary', readableOn(theme.primary, '#ffffff', '#1b1209'));
  if (theme.accent) root.setProperty('--on-accent', readableOn(theme.accent, '#ffffff', '#1b1209'));
  if (theme.fontDisplay) root.setProperty('--font-display', `"${theme.fontDisplay}", ui-sans-serif, system-ui, sans-serif`);
  if (theme.fontBody) root.setProperty('--font-body', `"${theme.fontBody}", ui-sans-serif, system-ui, sans-serif`);
  if (theme.background) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.background);
}

export function loadFonts(theme = {}) {
  const fam = (name, weights) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@${weights}`;
  const parts = [];
  if (theme.fontDisplay) parts.push(fam(theme.fontDisplay, theme.fontDisplayWeights ?? '600;700;800'));
  if (theme.fontBody && theme.fontBody !== theme.fontDisplay) parts.push(fam(theme.fontBody, theme.fontBodyWeights ?? '400;500;600;700'));
  if (!parts.length) return Promise.resolve();
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${parts.join('&')}&display=swap`;
  const loaded = new Promise((resolve) => {
    link.onload = resolve;
    link.onerror = resolve;
  });
  document.head.append(link);
  const timeout = new Promise((resolve) => setTimeout(resolve, 2500));
  return Promise.race([loaded.then(() => document.fonts?.ready), timeout]);
}

/* ----------------------------- cabeçalho --------------------------- */

export function logoMark(menu, size = 44) {
  if (menu.logo) {
    return `<img src="assets/restaurants/${esc(menu.slug)}/${esc(menu.logo)}" alt="" width="${size}" height="${size}">`;
  }
  return icon('burger', size);
}

export function renderHero(menu, mesa) {
  document.getElementById('logo').innerHTML = logoMark(menu);
  document.getElementById('name').textContent = menu.name;
  document.getElementById('tagline').textContent = menu.tagline ?? '';
  document.getElementById('hint').textContent = menu.hint ?? '';
  const chip = document.getElementById('mesa');
  if (mesa) {
    chip.textContent = `Mesa ${mesa}`;
    chip.hidden = false;
  }
}

/* ------------------------------- abas ------------------------------ */

export function renderTabs(menu) {
  document.getElementById('tabs').innerHTML = menu.categories
    .map((c, i) => `<button type="button" class="tab" data-cat="${esc(c.id)}" aria-pressed="${i === 0}">${esc(c.name)}</button>`)
    .join('');
}

/* ------------------------------- lista ----------------------------- */

function badgeFor(item, highlights) {
  const tag = (item.tags ?? []).find((t) => highlights.includes(t.toLowerCase()));
  if (!tag) return '';
  const ic = BADGE_ICONS[tag.toLowerCase()] ?? 'flame';
  return `<span class="badge">${icon(ic, 14)}<span>${esc(tag)}</span></span>`;
}

function cardHtml(item, menu, cat, index, highlights) {
  const badge = badgeFor(item, highlights);
  const thumb = item.posterUrl
    ? `<img src="${esc(item.posterUrl)}" alt="" width="104" height="104" loading="${index < 4 ? 'eager' : 'lazy'}" decoding="async">`
    : '';
  return `
    <li class="cards__item" style="--i:${Math.min(index, 8)}">
      <button type="button" class="card" data-id="${esc(item.id)}" aria-label="${esc(item.name)}, ${money(item.price, menu.currency)}. Abrir detalhes e ver em 3D e realidade aumentada">
        <span class="card__media">
          <span class="card__ph">${icon(cat?.icon ?? 'dish', 38)}</span>
          ${thumb}
        </span>
        <span class="card__body">
          <span class="card__head"><span class="card__name">${esc(item.name)}</span>${badge}</span>
          <span class="card__desc">${esc(item.description)}</span>
          <span class="card__foot">
            <span class="price">${money(item.price, menu.currency)}</span>
            <span class="ar-pill">${icon('cube', 16)}<span>Ver em 3D/AR</span></span>
          </span>
        </span>
      </button>
    </li>`;
}

// Devolve o conjunto de pôsteres que carregaram (para usar no visualizador 3D).
export function renderMenu(menu, onOpen) {
  const highlights = (menu.highlightTags ?? DEFAULT_HIGHLIGHTS).map((t) => t.toLowerCase());
  const posterOk = new Set();
  let n = 0;
  const html = menu.categories
    .map((cat) => {
      const items = menu.items.filter((it) => it.category === cat.id);
      if (!items.length) return '';
      return `
        <section class="cat" id="cat-${esc(cat.id)}" data-cat="${esc(cat.id)}" aria-labelledby="h-${esc(cat.id)}">
          <h2 class="cat__title" id="h-${esc(cat.id)}">${esc(cat.name)}</h2>
          <ul class="cards">${items.map((it) => cardHtml(it, menu, cat, n++, highlights)).join('')}</ul>
        </section>`;
    })
    .join('');
  const list = document.getElementById('menuList');
  list.innerHTML = html;

  list.querySelectorAll('.card').forEach((card) => {
    const id = card.dataset.id;
    const img = card.querySelector('img');
    if (img) {
      img.addEventListener('load', () => {
        posterOk.add(id);
        card.classList.add('has-img');
      });
      img.addEventListener('error', () => img.remove());
    }
    card.addEventListener('click', () => onOpen(id, card));
  });
  return posterOk;
}

/* ------------------------------ Sobre ------------------------------ */

export function renderAbout(menu) {
  const a = menu.about ?? {};
  const features = (a.highlights ?? [])
    .map(
      (h, i) => `
      <li class="feature" style="--i:${i}">
        <span class="feature__n">${String(i + 1).padStart(2, '0')}</span>
        <div><h3>${esc(h.title)}</h3><p>${esc(h.text)}</p></div>
      </li>`,
    )
    .join('');
  document.getElementById('view-about').innerHTML = `
    <div class="page">
      <div class="page__logo">${logoMark(menu, 40)}</div>
      <h2 class="page__title">${esc(a.title ?? `Sobre ${menu.name}`)}</h2>
      <p class="page__lead">${esc(a.text ?? '')}</p>
      <ul class="features">${features}</ul>
    </div>`;
}

/* ----------------------------- Contato ----------------------------- */

export function renderContact(menu) {
  const c = menu.contact ?? {};
  const maps = c.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(c.address)}` : null;
  const hours = (c.hours ?? [])
    .map((h) => `<li><span>${esc(h.days)}</span><strong>${esc(h.time)}</strong></li>`)
    .join('');
  const wa = c.whatsapp
    ? `<a class="link-card" href="https://wa.me/${encodeURIComponent(c.whatsapp.number)}" target="_blank" rel="noopener noreferrer">
         <span class="link-card__icon">${icon('whatsapp', 22)}</span>
         <span class="link-card__text"><strong>WhatsApp</strong><small>${esc(c.whatsapp.label)}</small></span>
         <span class="link-card__go">${icon('arrow', 18)}</span>
       </a>`
    : '';
  const ig = c.instagram
    ? `<a class="link-card" href="${esc(c.instagram.url)}" target="_blank" rel="noopener noreferrer">
         <span class="link-card__icon">${icon('instagram', 22)}</span>
         <span class="link-card__text"><strong>Instagram</strong><small>${esc(c.instagram.label)}</small></span>
         <span class="link-card__go">${icon('arrow', 18)}</span>
       </a>`
    : '';
  document.getElementById('view-contact').innerHTML = `
    <div class="page">
      <div class="page__logo">${logoMark(menu, 40)}</div>
      <h2 class="page__title">Contato</h2>
      <p class="page__lead">Fale com a gente ou venha nos visitar</p>
      ${c.address ? `
      <div class="info-card">
        <div class="info-card__head">${icon('pin', 20)}<h3>Endereço</h3></div>
        <p>${esc(c.address)}</p>
        <a class="text-link" href="${maps}" target="_blank" rel="noopener noreferrer">Como chegar ${icon('arrow', 16)}</a>
      </div>` : ''}
      ${hours ? `
      <div class="info-card">
        <div class="info-card__head">${icon('clock', 20)}<h3>Horários</h3></div>
        <ul class="hours">${hours}</ul>
      </div>` : ''}
      <div class="links">${wa}${ig}</div>
    </div>`;
}

/* ------------------------------ erro ------------------------------- */

export function renderFatal(kind) {
  const notFound = kind === 'not-found';
  document.getElementById('app').innerHTML = `
    <div class="fatal" role="alert">
      <div class="fatal__icon">${icon('dish', 44)}</div>
      <h1>${notFound ? 'Cardápio não encontrado' : 'Não foi possível abrir o cardápio'}</h1>
      <p>${notFound ? 'Confira o link ou escaneie o QR code da mesa novamente.' : 'Verifique sua conexão com a internet e tente de novo.'}</p>
      <a class="cta cta--inline" href="${notFound ? location.pathname : location.href}">${notFound ? 'Ver o cardápio de demonstração' : 'Tentar de novo'}</a>
    </div>`;
}
