// Liga as imagens dos pratos ao menu.json.
// Para cada prato procura assets/restaurants/<slug>/img/<id>.(webp|png|jpg|jpeg|avif) e atualiza o campo "poster".
// Sem imagem, o campo fica null e o cardápio mostra um ícone no lugar (sem erro 404 no console).
// Uso: npm run posters [slug]   (padrão: smash-lab)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SLUG = process.argv[2] ?? 'smash-lab';
const menuFile = path.join(ROOT, 'data', 'restaurants', SLUG, 'menu.json');
const imgDir = path.join(ROOT, 'assets', 'restaurants', SLUG, 'img');
const EXTS = ['webp', 'png', 'jpg', 'jpeg', 'avif'];

let text = fs.readFileSync(menuFile, 'utf8');
const menu = JSON.parse(text);
let linked = 0;
const missing = [];

for (const item of menu.items) {
  const ext = EXTS.find((e) => fs.existsSync(path.join(imgDir, `${item.id}.${e}`)));
  const value = ext ? `"img/${item.id}.${ext}"` : 'null';
  const re = new RegExp(`("id":\\s*"${item.id}"[\\s\\S]*?"poster":\\s*)(null|"[^"]*")`);
  if (!re.test(text)) {
    console.warn(`Campo "poster" não encontrado no item ${item.id}; adicione "poster": null ao JSON.`);
    continue;
  }
  text = text.replace(re, `$1${value}`);
  if (ext) linked++;
  else missing.push(item.id);
}

fs.writeFileSync(menuFile, text);
console.log(`${linked}/${menu.items.length} imagens ligadas em ${path.relative(ROOT, menuFile)}`);
if (missing.length) console.log(`Sem imagem: ${missing.join(', ')}`);
