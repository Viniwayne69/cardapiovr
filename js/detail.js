// Tela de detalhe do prato: foto no topo (ou 3D girando, se o prato não tem foto) e botão "Ver na mesa" (AR).
// O <model-viewer> sempre carrega, mesmo escondido, porque é ele que abre a realidade aumentada.

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
    this.photo = document.getElementById('stagePhoto');
    this.arLabel = document.getElementById('arLabel');
    this.photoMode = false;
    this.failed = false;
    this.pending = false; // tocou em "Ver na mesa" antes de o 3D ficar pronto
    this.mvSrc = null; // último modelo entregue ao visualizador
    this.viewerReady = null;
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
    // foto que não carrega: cai para o 3D girando no topo
    this.photo.addEventListener('error', () => this.setPhoto(false));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) this.onRequestClose();
    });
  }

  /* ------------------------- abrir / fechar ------------------------ */

  open(item, trigger) {
    if (this.isOpen && this.item?.id === item.id) return;
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
    // o modelo continua no visualizador: reabrir o mesmo prato (ou voltar a ele) abre na hora
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

  // Com foto, o topo mostra a imagem e o 3D fica escondido até o "Ver na mesa".
  setPhoto(on) {
    this.photoMode = on;
    this.stage.classList.toggle('is-photo', on);
    this.photo.hidden = !on;
    // escondido, o 3D não precisa girar (poupa bateria)
    if (this.mv) this.mv.autoRotate = !on;
  }

  // O botão nunca fica apagado: se o 3D ainda não chegou, mostra "Preparando…" e abre o AR sozinho depois.
  setBusy(on) {
    this.arBtn.classList.toggle('is-busy', on);
    this.arBtn.setAttribute('aria-busy', String(on));
    this.arLabel.textContent = on ? 'Preparando…' : 'Ver na mesa';
  }

  resetState() {
    const item = this.item;
    if (item?.posterUrl) {
      this.photo.alt = `Foto de ${item.name}`;
      this.photo.src = item.posterUrl;
      this.setPhoto(true);
    } else {
      this.photo.removeAttribute('src');
      this.setPhoto(false);
    }
    this.failed = false;
    this.loaded = false;
    this.loading.hidden = false;
    this.errorBox.hidden = true;
    this.progress.classList.remove('is-done');
    this.bar.style.transform = 'scaleX(0)';
    this.hint.classList.remove('is-hidden');
    this.pending = false;
    this.setBusy(false);
    this.arBtn.classList.remove('is-unsupported');
    this.hideCoach();
  }

  /* ------------------------------ 3D -------------------------------- */

  // Um único visualizador, mesmo que warm(), prime() e loadModel() peçam ao mesmo tempo.
  ensureViewer() {
    this.viewerReady ??= this.buildViewer().catch((err) => {
      this.viewerReady = null;
      throw err;
    });
    return this.viewerReady;
  }

  async buildViewer() {
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

  // Cria o visualizador antes do primeiro toque (a parte pesada do WebGL), para o detalhe abrir pronto.
  warm() {
    return this.ensureViewer().catch(() => {});
  }

  // No toque no cartão já começa a baixar o modelo, antes mesmo de o detalhe terminar de abrir.
  prime(item) {
    if (this.isOpen || !item || this.mvSrc === item.modelUrl) return;
    this.ensureViewer()
      .then((mv) => {
        if (this.isOpen || this.mvSrc === item.modelUrl) return;
        this.mvSrc = item.modelUrl;
        mv.src = item.modelUrl;
      })
      .catch(() => {});
  }

  async loadModel() {
    const item = this.item;
    if (!item) return;
    this.errorBox.hidden = true;
    this.loading.hidden = false;
    this.loaded = false;
    this.failed = false;
    try {
      const mv = await this.ensureViewer();
      if (this.item !== item) return;
      mv.alt = `Modelo 3D de ${item.name}, em tamanho real`;
      if (item.posterUrl && this.posterOk.has(item.id)) mv.poster = item.posterUrl;
      else mv.removeAttribute('poster');
      mv.autoRotate = !this.photoMode;
      const same = this.mvSrc === item.modelUrl;
      this.mvSrc = item.modelUrl;
      mv.src = item.modelUrl;
      // o modelo já estava carregado (pré-carregado ou prato reaberto): não vem outro evento "load"
      if (same && mv.loaded) this.onLoaded();
    } catch {
      this.showError();
    }
  }

  onLoaded() {
    // ignora o "load" de um modelo pré-carregado que não é o do prato aberto
    if (!this.item || this.mvSrc !== this.item.modelUrl) return;
    this.loaded = true;
    this.loading.hidden = true;
    this.errorBox.hidden = true;
    this.progress.classList.add('is-done');
    this.mv.cameraOrbit = '28deg 74deg 122%';
    this.mv.jumpCameraToGoal?.();
    const supported = !!this.mv.canActivateAR;
    this.arBtn.classList.toggle('is-unsupported', !supported);
    const note = document.getElementById('arNote');
    if (note) note.hidden = supported;
    if (this.pending) {
      // a pessoa já tinha tocado: abre o AR agora, sem pedir outro toque
      this.pending = false;
      this.setBusy(false);
      this.launchAR();
    }
  }

  showError() {
    this.loading.hidden = true;
    this.failed = true;
    // com a foto no topo não cobrimos a imagem: o aviso aparece ao tocar em "Ver na mesa"
    if (!this.photoMode) this.errorBox.hidden = false;
    if (this.pending) {
      this.pending = false;
      this.setBusy(false);
      this.toast('Não foi possível carregar o 3D. Toque de novo para tentar');
    }
  }

  /* ------------------------------- AR -------------------------------- */

  activateAR() {
    if (this.failed) {
      this.pending = true;
      this.setBusy(true);
      this.loadModel();
      return;
    }
    if (!this.mv || !this.loaded) {
      // ainda carregando: o botão vira "Preparando…" e o AR abre sozinho quando o 3D chegar
      this.pending = true;
      this.setBusy(true);
      return;
    }
    this.launchAR();
  }

  launchAR() {
    if (!this.mv.canActivateAR) {
      if (this.photoMode) {
        // sem AR (ex.: computador): mostra o 3D no topo, no lugar da foto
        this.setPhoto(false);
        this.scroll.scrollTo({ top: 0, behavior: 'smooth' });
        this.toast('Aqui o 3D abre em cima. Para ver na mesa, abra no celular');
        return;
      }
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
