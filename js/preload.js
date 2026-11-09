// Baixa os modelos 3D em segundo plano, em ordem de cardápio, para que o "Ver na mesa" já esteja
// pronto quando a pessoa abrir o prato. Os arquivos vão para o cache HTTP do navegador (o vercel.json
// define o Cache-Control dos .glb), e o <model-viewer> os lê de lá.

const IDLE_MS = 1200;

function shouldSkip() {
  const c = navigator.connection;
  if (!c) return false;
  return c.saveData === true || /(^|-)2g$/.test(c.effectiveType ?? '');
}

export function prefetchModels(items) {
  if (shouldSkip()) return;
  const urls = items.map((i) => i.modelUrl).filter(Boolean);
  let i = 0;
  const next = async () => {
    if (i >= urls.length) return;
    const url = urls[i++];
    try {
      const res = await fetch(url, { priority: 'low' });
      await res.arrayBuffer();
    } catch {
      /* sem rede ou arquivo ausente: o visualizador mostra o erro se a pessoa abrir o prato */
    }
    next();
  };
  const start = () => setTimeout(next, IDLE_MS);
  if (document.readyState === 'complete') start();
  else window.addEventListener('load', start, { once: true });
}
