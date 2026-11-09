// Ponto de entrada: carrega o cardápio, aplica o tema e liga rotas, abas e detalhe do prato.

import { readParams, loadMenu } from './data.js';
import { hydrateIcons } from './icons.js';
import { applyTheme, loadFonts, renderHero, renderTabs, renderMenu, renderAbout, renderContact, renderFatal } from './ui.js';
import { DetailSheet } from './detail.js';
import { prefetchModels } from './preload.js';

const $ = (s, r = document) => r.querySelector(s);

async function boot() {
  hydrateIcons();
  const { slug, mesa } = readParams();

  let menu;
  try {
    menu = await loadMenu(slug);
  } catch (err) {
    renderFatal(err.message === 'not-found' ? 'not-found' : 'network');
    return;
  }

  applyTheme(menu.theme);
  await loadFonts(menu.theme);
  const baseTitle = `${menu.name} · Cardápio`;
  document.title = baseTitle;

  renderHero(menu, mesa);
  renderTabs(menu);
  renderAbout(menu);
  renderContact(menu);

  const byId = new Map(menu.items.map((i) => [i.id, i]));
  const app = $('#app');
  let currentView = null;
  let sheet = null;

  const goHome = () => {
    history.replaceState(null, '', `${location.pathname}${location.search}#/`);
    route();
  };

  // Abrir um prato cria uma entrada no histórico (o botão voltar do celular fecha o detalhe).
  const posterOk = renderMenu(
    menu,
    (id, card) => {
      sheet.trigger = card;
      history.pushState({ app: true }, '', `#/prato/${encodeURIComponent(id)}`);
      route();
    },
    (id) => sheet.prime(byId.get(id)),
  );

  sheet = new DetailSheet({
    menu,
    posterOk,
    onRequestClose: () => (history.state?.app ? history.back() : goHome()),
  });

  /* ------------------------------ telas ------------------------------ */

  function showView(name) {
    app.dataset.view = name;
    document.querySelectorAll('.view').forEach((v) => {
      v.hidden = v.dataset.view !== name;
    });
    document.querySelectorAll('.nav__item').forEach((a) => {
      if (a.dataset.view === name) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (currentView !== null && currentView !== name) window.scrollTo(0, 0);
    currentView = name;
    document.title = name === 'about' ? `Sobre · ${menu.name}` : name === 'contact' ? `Contato · ${menu.name}` : baseTitle;
  }

  function route() {
    const [view, arg] = location.hash.replace(/^#\/?/, '').split('/');
    if (view === 'prato' && arg) {
      const item = byId.get(decodeURIComponent(arg));
      if (item) {
        if (currentView === null) showView('menu');
        sheet.open(item);
        return;
      }
      goHome();
      return;
    }
    if (sheet.isOpen) {
      sheet.close();
      document.title = baseTitle;
    }
    showView(view === 'sobre' ? 'about' : view === 'contato' ? 'contact' : 'menu');
  }

  window.addEventListener('hashchange', route);
  document.querySelectorAll('.nav__item').forEach((a) => {
    a.addEventListener('click', () => {
      if (a.dataset.view === currentView && !sheet.isOpen) window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });

  /* ------------------------- abas e rolagem -------------------------- */

  setupTabs();
  route();
  document.body.classList.add('is-ready');

  // Prepara o 3D enquanto a pessoa lê o cardápio, para o "Ver na mesa" já abrir pronto.
  sheet.warm();
  prefetchModels(menu.items);
}

function setupTabs() {
  const wrap = $('#tabsWrap');
  const tabsEl = $('#tabs');
  const tabs = [...tabsEl.querySelectorAll('.tab')];
  const sections = [...document.querySelectorAll('.cat')];
  if (!tabs.length) return;
  let locked = false;
  let lockTimer;

  const syncHeight = () => document.documentElement.style.setProperty('--tabs-h', `${wrap.offsetHeight}px`);
  const syncFade = () => {
    const more = tabsEl.scrollWidth - tabsEl.clientWidth - tabsEl.scrollLeft > 8;
    tabsEl.classList.toggle('has-more', more);
  };
  syncHeight();
  syncFade();
  tabsEl.addEventListener('scroll', syncFade, { passive: true });
  window.addEventListener('resize', () => {
    syncHeight();
    syncFade();
  });

  const setActive = (id) => {
    for (const t of tabs) {
      const on = t.dataset.cat === id;
      t.setAttribute('aria-pressed', String(on));
      if (on && tabsEl.scrollWidth > tabsEl.clientWidth) {
        const left = t.offsetLeft - (tabsEl.clientWidth - t.offsetWidth) / 2;
        tabsEl.scrollTo({ left, behavior: 'smooth' });
      }
    }
  };

  tabs.forEach((t) =>
    t.addEventListener('click', () => {
      const target = document.getElementById(`cat-${t.dataset.cat}`);
      if (!target) return;
      locked = true;
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => (locked = false), 900);
      setActive(t.dataset.cat);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }),
  );

  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      if (wrap.offsetParent === null) return;
      wrap.classList.toggle('is-stuck', wrap.getBoundingClientRect().top <= 0.5);
      if (locked) return;
      const line = wrap.offsetHeight + 40;
      let current = sections[0];
      for (const s of sections) if (s.getBoundingClientRect().top <= line) current = s;
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = sections[sections.length - 1];
      if (current) setActive(current.dataset.cat);
    });
  };
  window.addEventListener('scroll', onScroll, { passive: true });
}

boot();
