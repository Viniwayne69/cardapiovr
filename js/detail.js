// Tela de detalhe do prato: visualizador 3D (<model-viewer>) e botão "Ver na mesa" (AR).

import { icon, hydrateIcons } from './icons.js';
import { money, dimensions, escapeHtml as esc } from './format.js';

const VIEWER_TIMEOUT = 15000;
const COACH_MS = 5000;
const AR_HINT = 'Aponte para a mesa e mova o celular devagar';

export class DetailSheet {
  constructor({ menu, posterOk, onRequestClose }) {
    this.menu = menu;
    this.posterOk = posterOk;
    this.onRequestClose = onRequestClose;
    this.el = document.getElementById('sheet');
    this.app = document.getElementById('app');
    this.stage = document.getElementById('stage');
    this.scroll = document.getElementById('sheetScroll');
    this.info = document.getElementById('sheetInfo');
    this.arBtn = document.getElementById('arBtn');
    this.coach = document.getElementById('coach');
    this.toastEl = document.getElementById('toast');
    this.loading = document.getElementById('stageLoading');
    this.errorBox = document.getElementById('stageError');
    this.hint = document.getElementById('stageHint');
    this.bar = document.getElementById('progressBar');
    this.progress = document.getElementById('progress');
    this.mv = null;
    this.item = null;
    this.loaded = false;
    this.isOpen = false;
    this.timers = {};
    hydrateIcons(this.el);
    this.bind();
  }

  bind() {
    this.el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => this.onRequestClose()));
    document.getElementById('sheetShare').addEventListener('click', () => this.share());
    this.arBtn.addEventListener('click', () => this.activateAR());
    document.getElementById('retryModel').addEventListener('click', () => this.loadModel());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.onRequestClose();
    });
  }

  /* ------------------------- abrir / fechar ------------------------ */

  open(item, trigger) {
    if (this.isOpen && this.item?.id === item.id) return;
    clearTimeout(this.timers.unload);
    this.item = item;
    this.trigger = trigger ?? this.trigger;
    this.fill(item);
    this.resetState();
    this.el.inert = false;
    this.el.setAttribute('aria-hidden', 'false');
    this.app.inert = true;
    document.documentElement.classList.add('is-locked');
    this.scroll.scrollTop = 0;
    this.isOpen = true;
    // força o estilo inicial (painel abaixo da tela) antes de animar a entrada
    void this.el.getBoundingClientRect();
    this.el.classList.add('is-open');
    document.getElementById('sheetBack').focus({ preventScroll: true });
    this.loadModel();
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.el.classList.remove('is-open');
    this.el.inert = true;
    this.el.setAttribute('aria-hidden', 'true');
    this.app.inert = false;
    document.documentElement.classList.remove('is-locked');
    this.hideCoach();
    if (this.trigger?.isConnected) this.trigger.focus({ preventScroll: true });
    this.timers.unload = setTimeout(() => {
      if (this.mv) this.mv.removeAttribute('src');
      this.loaded = false;
    }, 600);
  }

  /* ----------------------------- conteúdo -------------------------- */

  fill(item) {
    const dims = dimensions(item.dimensionsCm);
    const cat = this.menu.categories.find((c) => c.id === item.category);
    document.title = `${item.name} · ${this.menu.name}`;
    this.info.innerHTML = `
      <div class="note" id="arNote" hidden>
        ${icon('info', 20)}
        <p>Este aparelho não abre a realidade aumentada. Abra o cardápio no seu celular para ver o prato em cima da mesa.</p>
      </div>
      ${cat ? `<p class="info__cat">${esc(cat.name)}</p>` : ''}
      <h2 class="info__name" id="sheetTitle">${esc(item.name)}</h2>
      <p class="info__price">${money(item.price, this.menu.currency)}</p>
      ${dims ? `
      <p class="info__dims">
        <span class="info__dims-icon">${icon('ruler', 20)}</span>
        <span><strong>${dims.text}</strong><small>Tamanho real · ${dims.hint}</small></span>
      </p>` : ''}
      <p class="info__desc">${esc(item.description)}</p>
      ${item.ingredients?.length ? `
      <h3 class="info__sub">Ingredientes</h3>
      <ul class="chips">${item.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>` : ''}
      ${item.tags?.length ? `<ul class="chips chips--tags">${item.tags.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}`;
  }

  resetState() {
    this.loaded = false;
    this.loading.hidden = false;
    this.errorBox.hidden = true;
    this.progress.classList.remove('is-done');
    this.bar.style.transform = 'scaleX(0)';
    this.hint.classList.remove('is-hidden');
    this.arBtn.classList.add('is-wait');
    this.arBtn.setAttribute('aria-disabled', 'true');
    this.hideCoach();
  }

  /* ------------------------------ 3D -------------------------------- */

  async ensureViewer() {
    if (this.mv) return this.mv;
    const ready = await Promise.race([
      customElements.whenDefined('model-viewer').then(() => true),
      new Promise((r) => setTimeout(() => r(false), VIEWER_TIMEOUT)),
    ]);
    if (!ready) throw new Error('viewer-unavailable');

    const mv = document.createElement('model-viewer');
    const attrs = {
      'camera-controls': '',
      'auto-rotate': '',
      'auto-rotate-delay': '500',
      'rotation-per-second': '16deg',
      'interaction-prompt': 'none',
      'shadow-intensity': '1.2',
      'shadow-softness': '0.9',
      exposure: '1.08',
      'environment-image': 'neutral',
      'camera-orbit': '28deg 74deg 122%',
      'min-camera-orbit': 'auto 20deg 60%',
      'max-camera-orbit': 'auto 100deg 220%',
      'touch-action': 'pan-y',
      loading: 'eager',
      reveal: 'auto',
      ar: '',
      'ar-modes': 'webxr scene-viewer quick-look',
      'ar-scale': 'fixed',
      'ar-placement': 'floor',
    };
    for (const [k, v] of Object.entries(attrs)) mv.setAttribute(k, v);
    mv.className = 'stage__viewer';
    // slots vazios: usamos o nosso próprio botão e a nossa barra de progresso
    mv.innerHTML = '<button slot="ar-button" hidden tabindex="-1" aria-hidden="true"></button><div slot="progress-bar"></div>';

    mv.addEventListener('progress', (e) => {
      const p = Math.min(1, e.detail?.totalProgress ?? 0);
      this.bar.style.transform = `scaleX(${p})`;
    });
    mv.addEventListener('load', () => this.onLoaded());
    mv.addEventListener('error', () => this.showError());
    mv.addEventListener('camera-change', (e) => {
      if (e.detail?.source === 'user-interaction') this.hint.classList.add('is-hidden');
    });
    mv.addEventListener('ar-status', (e) => {
      const s = e.detail?.status;
      if (s === 'session-started') this.showCoach();
      if (s === 'failed') this.toast('Não foi possível abrir a realidade aumentada neste aparelho');
    });
    this.stage.prepend(mv);
    this.mv = mv;
    return mv;
  }

  async loadModel() {
    const item = this.item;
    if (!item) return;
    this.errorBox.hidden = true;
    this.loading.hidden = false;
    this.loaded = false;
    try {
      const mv = await this.ensureViewer();
      if (this.item !== item) return;
      mv.alt = `Modelo 3D de ${item.name}, em tamanho real`;
      if (item.posterUrl && this.posterOk.has(item.id)) mv.poster = item.posterUrl;
      else mv.removeAttribute('poster');
      mv.src = item.modelUrl;
    } catch {
      this.showError();
    }
  }

  onLoaded() {
    this.loaded = true;
    this.loading.hidden = true;
    this.errorBox.hidden = true;
    this.progress.classList.add('is-done');
    this.mv.cameraOrbit = '28deg 74deg 122%';
    this.mv.jumpCameraToGoal?.();
    this.arBtn.classList.remove('is-wait');
    const supported = !!this.mv.canActivateAR;
    this.arBtn.setAttribute('aria-disabled', String(!supported));
    this.arBtn.classList.toggle('is-unsupported', !supported);
    const note = document.getElementById('arNote');
    if (note) note.hidden = supported;
  }

  showError() {
    this.loading.hidden = true;
    this.errorBox.hidden = false;
    this.arBtn.classList.add('is-wait');
  }

  /* ------------------------------- AR -------------------------------- */

  activateAR() {
    if (!this.mv || !this.loaded) {
      this.toast('Aguarde o 3D terminar de carregar');
      return;
    }
    if (!this.mv.canActivateAR) {
      this.toast('Seu aparelho não abre a realidade aumentada. Abra no celular');
      document.getElementById('arNote')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    this.showCoach();
    this.mv.activateAR();
  }

  showCoach() {
    this.coach.textContent = AR_HINT;
    this.coach.classList.add('is-show');
    clearTimeout(this.timers.coach);
    this.timers.coach = setTimeout(() => this.hideCoach(), COACH_MS);
  }

  hideCoach() {
    clearTimeout(this.timers.coach);
    this.coach.classList.remove('is-show');
  }

  /* ---------------------------- compartilhar ------------------------- */

  async share() {
    const url = new URL(location.href);
    url.searchParams.delete('mesa');
    url.hash = `#/prato/${encodeURIComponent(this.item.id)}`;
    const data = { title: `${this.item.name} · ${this.menu.name}`, text: `Veja o ${this.item.name} em 3D`, url: url.href };
    try {
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url.href);
      this.toast('Link do prato copiado');
    } catch (err) {
      if (err?.name !== 'AbortError') this.toast('Não foi possível compartilhar agora');
    }
  }

  toast(message) {
    this.toastEl.textContent = message;
    this.toastEl.classList.add('is-show');
    clearTimeout(this.timers.toast);
    this.timers.toast = setTimeout(() => this.toastEl.classList.remove('is-show'), 3200);
  }
}
