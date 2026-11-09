// Ícones em SVG inline (traço), todos em viewBox 24x24 e herdando a cor do texto.

const PATHS = {
  back: '<path d="M19 12H5m7-7-7 7 7 7"/>',
  share: '<path d="M12 15V4m0 0L8 8m4-4 4 4"/><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12 4 7.5M12 12v9"/>',
  ruler: '<path d="M3.5 16.5 16.5 3.5l4 4-13 13z"/><path d="M7.5 12.5l2 2M10.5 9.5l2 2M13.5 6.5l2 2"/>',
  crown: '<path fill="currentColor" stroke="none" d="M3.2 8.2 7.6 12 12 5.2l4.4 6.8 4.4-3.8-1.9 10H5.1z"/>',
  flame: '<path fill="currentColor" stroke="none" d="M12.4 2.5c.4 3-1.6 4.4-3 6.2-1.3 1.7-1.9 3.1-1.5 5 .3 1.3 1 2.3 2 3-.5-1.8.1-3 1.2-4.2 1.1 1.3 3 2.4 2.7 4.9 1.5-.8 2.7-2.6 2.7-4.7 0-3.6-2.6-5.6-4.1-10.2z"/>',
  menu: '<path d="M5 4.5h11A3 3 0 0 1 19 7.5V20H8a3 3 0 0 1-3-3z"/><path d="M9 8.5h6M9 12h6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.2M12 7.8v.01"/>',
  phone: '<path d="M5 4h3.6l1.9 4.9-2.4 1.5a11 11 0 0 0 5.5 5.5l1.5-2.4 4.9 1.9V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  pin: '<path d="M12 21s7-6.2 7-11.2a7 7 0 1 0-14 0C5 14.8 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  whatsapp: '<path d="M20 12a8 8 0 0 1-11.8 7L4 20.2l1.2-4.1A8 8 0 1 1 20 12z"/><path d="M9.2 8.8c-.3 2.6 2.8 5.9 5.9 6l1-1.6-2-1-.9.8a4 4 0 0 1-1.9-1.9l.8-.9-1-2z"/>',
  instagram: '<rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.6"/><path d="M16.9 7.1v.01"/>',
  rotateL: '<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M18 3v4h-4"/>',
  rotateR: '<path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M6 3v4h4"/>',
  arrow: '<path d="M5 12h14m-6-6 6 6-6 6"/>',
  burger: '<path d="M5 11a7 7 0 0 1 14 0z"/><rect x="3.5" y="13" width="17" height="2.6" rx="1.3"/><path d="M5 17.9h14c0 1.5-1 2.6-2.6 2.6H7.6C6 20.5 5 19.4 5 17.9z"/><path d="M9 7.4v.01M12.2 6.2v.01M15 7.6v.01"/>',
  fries: '<path d="M6.2 10h11.6L16.4 20H7.6z"/><path d="M8.4 10V5.4M11 10V3.5M13.6 10V4.6M16 10V6.6"/>',
  cup: '<path d="M6.2 7.5h11.6L16.4 20.2H7.6z"/><path d="M5 7.5h14M12.5 7.5 14 3.6h3"/>',
  icecream: '<path d="M7.2 11.2h9.6L12 21z"/><path d="M7.2 11.2a4.8 4.8 0 0 1 9.6 0"/><path d="M12 3.4v.01"/>',
  dish: '<path d="M3 16.5h18M5 16.5a7 7 0 0 1 14 0"/><path d="M12 7.6v2.2"/>',
};

export function icon(name, size = 22) {
  const body = PATHS[name] ?? PATHS.dish;
  return `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}

// Substitui <span data-icon="nome" data-size="22"> pelo SVG correspondente.
export function hydrateIcons(root = document) {
  root.querySelectorAll('[data-icon]').forEach((el) => {
    if (el.dataset.ready) return;
    el.innerHTML = icon(el.dataset.icon, Number(el.dataset.size) || 22);
    el.dataset.ready = '1';
  });
}
