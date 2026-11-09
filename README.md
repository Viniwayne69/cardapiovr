# Cardápio AR

Cardápio digital com **realidade aumentada** para restaurantes. O cliente escaneia o QR code da mesa, escolhe um prato e vê a comida em 3D, **em tamanho real, em cima da própria mesa**, usando a câmera do celular. Tudo abre no navegador, sem instalar aplicativo.

Esta é a **fase 1**: uma demo completa de uma hamburgueria fictícia (**Smash Lab**), pronta para publicar na Vercel. O projeto já nasce white-label: cada restaurante tem a sua pasta de dados, modelos e tema.

> **Os modelos 3D desta demo são placeholders estilizados**, gerados por script, para demonstrar o fluxo de AR de ponta a ponta. Não são fotorrealistas. Para vender, troque por modelos reais (veja [Trocar os modelos 3D](#trocar-os-modelos-3d)).

## Sumário

- [Rodar localmente](#rodar-localmente)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Como funciona](#como-funciona)
- [Trocar os modelos 3D](#trocar-os-modelos-3d)
- [Colocar as imagens dos pratos](#colocar-as-imagens-dos-pratos)
- [Adicionar um novo restaurante](#adicionar-um-novo-restaurante)
- [Gerar e imprimir o QR code](#gerar-e-imprimir-o-qr-code)
- [Publicar na Vercel](#publicar-na-vercel)
- [Checklist de teste de AR no celular](#checklist-de-teste-de-ar-no-celular)
- [Limitações conhecidas](#limitações-conhecidas)
- [Próximos passos](#próximos-passos)

## Rodar localmente

Só é preciso do [Node.js](https://nodejs.org) 18 ou mais novo. Não há dependências para instalar.

```bash
npm start
```

Abra <http://localhost:5173>. Parâmetros da URL:

| URL | Resultado |
| --- | --- |
| `/` | abre a demo (`smash-lab`) |
| `/?r=smash-lab` | abre o cardápio daquele restaurante |
| `/?r=smash-lab&mesa=12` | idem, mostrando "Mesa 12" no topo |
| `/#/prato/classico` | abre direto o detalhe de um prato (link compartilhável) |
| `/#/sobre` e `/#/contato` | telas Sobre e Contato |

Outros comandos:

```bash
npm run models     # gera os GLBs placeholder em assets/restaurants/smash-lab/models
npm run validate   # valida cada GLB (cabeçalho, accessors, tamanho em metros, peso) e mostra o relatório
npm run posters    # liga ao menu.json as imagens que existem em assets/.../img
```

Para ver todos os modelos 3D, um a um: <http://localhost:5173/scripts/preview-models.html>.

> **O AR em si não funciona no computador.** Ele só pode ser validado em um celular real, com a página em HTTPS (veja o [checklist](#checklist-de-teste-de-ar-no-celular)). No computador você vê o 3D girando e uma mensagem avisando que o aparelho não abre o AR.

## Estrutura do projeto

```
index.html                       página do cardápio
qr.html                          gerador de QR code para imprimir
vercel.json                      cabeçalhos (model/gltf-binary) e cache
css/style.css                    estilos; as cores vêm do tema do JSON (variáveis CSS)
js/
  app.js                         inicialização, rotas e abas
  ui.js                          cabeçalho, lista, Sobre, Contato e tema
  detail.js                      detalhe do prato: <model-viewer> e botão "Ver na mesa"
  data.js · format.js · icons.js · qr.js
data/restaurants/<slug>/menu.json        dados do restaurante
assets/restaurants/<slug>/models/*.glb   modelos 3D
assets/restaurants/<slug>/img/           imagens dos pratos
scripts/                         geração/validação dos modelos, servidor local, prévia
```

## Como funciona

- **Site estático** (HTML, CSS e JavaScript em módulos), sem framework e sem build.
- **Visualizador 3D e AR:** [`<model-viewer>`](https://modelviewer.dev) do Google, versão **4.0.0** fixada, carregada por CDN em `index.html`.
- **Um único visualizador WebGL por vez:** a lista usa imagens estáticas, e o `<model-viewer>` só existe na tela de detalhe (carrega apenas o modelo do prato aberto).
- **AR:** `ar-modes="webxr scene-viewer quick-look"` e `ar-scale="fixed"`, que mantém o tamanho real do prato.
  - **Android:** Scene Viewer (ou WebXR, no Chrome).
  - **iPhone:** AR Quick Look, que exige USDZ. Como o `ios-src` não é informado, o **model-viewer gera o USDZ no próprio aparelho, a partir do GLB**, quando o cliente toca em "Ver na mesa" (a documentação do model-viewer descreve esse comportamento). Não há arquivos `.usdz` para manter.
  - **Aparelho sem AR (ex.: computador):** o 3D funciona normalmente e aparece um aviso claro.
- **Tema (white-label):** o campo `theme` do `menu.json` vira variáveis CSS e define as fontes (Google Fonts). Trocar o JSON troca a marca.
- **Sem espera no "Ver na mesa":** o visualizador é criado ao abrir o cardápio, os modelos baixam em segundo plano (`js/preload.js`, pulando conexão 2G ou economia de dados) e o modelo do prato começa a carregar ao encostar no cartão. O botão nunca fica apagado: se a pessoa tocar antes do 3D chegar, ele mostra "Preparando…" e abre o AR sozinho assim que ficar pronto.
- **Navegação:** rotas por hash (`#/prato/<id>`, `#/sobre`, `#/contato`), então o botão voltar do celular fecha o detalhe.

## Trocar os modelos 3D

Para usar modelos reais (gerados por IA a partir de fotos, fotogrametria ou modelagem manual):

1. Exporte o modelo em **GLB** (glTF 2.0 binário).
2. Salve com **o mesmo nome** em `assets/restaurants/<slug>/models/`, por exemplo `classico.glb`.
3. Pronto. O caminho no `menu.json` (`"model": "models/classico.glb"`) já aponta para ele. Se mudar o nome, atualize o JSON.
4. Rode `npm run validate` para conferir o arquivo.

Boas práticas para o AR ficar certo:

- **Escala em metros reais** (o prato precisa ter o tamanho que tem na vida real; o `ar-scale="fixed"` respeita a escala do arquivo).
- **Origem na base do objeto**, centralizado em X e Z, para o prato "assentar" na mesa.
- **Frente voltada para +Z** (convenção do glTF) e **Y para cima**.
- **Peso:** ideal abaixo de 1 MB por arquivo, no máximo 5 MB. Texturas grandes pesam, então prefira texturas de até 1024 px.
- Mantenha `dimensionsCm` no JSON coerente com o modelo, porque é o que aparece para o cliente.

### Modelo gerado a partir de uma foto (grátis)

Um modelo realista pode sair de uma foto do prato com o **TRELLIS**, que roda de graça no Hugging Face (`huggingface.co/spaces/trellis-community/TRELLIS`): suba a foto, clique em "Generate & Extract GLB" e baixe o GLB. Esse arquivo vem em escala arbitrária, sem normais e com textura PNG pesada, então passe pelo script de preparo:

```bash
node scripts/prepare-scan.mjs caminho/do/arquivo.glb <id-do-prato>
```

O script escala para o diâmetro/largura de `dimensionsCm`, centraliza e apoia a base em y=0, recalcula as normais, ajusta o material, troca a textura por JPEG e grava em `assets/restaurants/<slug>/models/`. O arquivo original fica em `source-models/<slug>/<id>.raw.glb`, e `npm run models` passa a não sobrescrever esse prato. A altura sai da proporção do modelo: se o script avisar que ela difere de `dimensionsCm.height`, ajuste o `menu.json`.

## Colocar as imagens dos pratos

As imagens aparecem como miniatura na lista e como foto principal no topo do detalhe. Quando o prato tem foto, o 3D carrega escondido e só aparece no "Ver na mesa" (AR); em aparelhos sem AR, como o computador, o botão troca a foto pelo 3D girando. Sem imagem, o card mostra um ícone da categoria e o detalhe mostra o 3D girando no topo (sem erro no console).

1. Salve cada imagem em `assets/restaurants/<slug>/img/<id-do-prato>.webp` (também aceita `.png`, `.jpg` e `.avif`).
2. Rode `npm run posters`. O script liga ao `menu.json` apenas as imagens que existem.

Recomendado: imagem **quadrada (1:1)**, pelo menos 800 × 800 px, prato centralizado, fundo transparente ou no tom escuro do tema, até uns 150 KB, com a mesma iluminação e ângulo nos 12 pratos.

Ids da demo: `classico`, `cheddar-bacon`, `duplo-smash`, `veggie`, `batata-frita`, `onion-rings`, `batata-cheddar-bacon`, `refrigerante`, `milkshake-chocolate`, `limonada-suica`, `brownie-sorvete`, `sundae-morango`.

## Adicionar um novo restaurante

1. Copie `data/restaurants/smash-lab` para `data/restaurants/<novo-slug>` (só letras minúsculas, números e hífen).
2. Edite o `menu.json`: nome, tagline, `theme` (cores e fontes), `categories`, `items`, `about` e `contact`.
3. Crie `assets/restaurants/<novo-slug>/models` e `.../img` e coloque os GLBs e as imagens.
4. Abra `/?r=<novo-slug>`. Nenhuma linha de código precisa mudar.

Campos do `menu.json`:

| Campo | Descrição |
| --- | --- |
| `slug`, `name`, `tagline`, `hint` | identificação e a dica do topo |
| `theme` | `primary`, `accent`, `background`, `text`, `fontDisplay`, `fontBody` (opcional: `surface`, `fontDisplayWeights`, `fontBodyWeights`) |
| `currency` | código ISO (`BRL`) |
| `highlightTags` | tags que viram selo no card (ex.: "mais pedido") |
| `categories[]` | `id`, `name`, `icon` (`burger`, `fries`, `cup`, `icecream` ou `dish`) |
| `items[]` | `id`, `category`, `name`, `description`, `ingredients[]`, `price`, `model`, `poster`, `dimensionsCm`, `tags[]` |
| `dimensionsCm` | `{ "diameter", "height" }` para pratos redondos, ou `{ "width", "depth", "height" }` |
| `about`, `contact` | conteúdo das telas Sobre e Contato |

Os dados de Sobre e Contato da demo (endereço, horários, WhatsApp, Instagram) são **fictícios**.

## Gerar e imprimir o QR code

1. Publique o site e copie o endereço público (por exemplo `https://seu-projeto.vercel.app`).
2. Abra `/qr` (ou `qr.html` localmente).
3. Preencha o restaurante (`smash-lab`), cole o endereço público e, se quiser, a mesa inicial e a quantidade (gera um cartão por mesa).
4. Clique em **Imprimir cartões** (A4, 2 por linha, com guia de corte) ou em **Baixar o primeiro QR (SVG)** para usar em outra arte.

O QR é gerado no próprio navegador, sem nenhuma biblioteca ou serviço externo, e usa correção de erro nível Q. O endereço fica salvo no navegador para a próxima vez.

## Publicar na Vercel

O site é 100% estático. Importe o repositório na Vercel (ou arraste a pasta) com as configurações padrão: **Framework Preset "Other"**, sem comando de build e sem diretório de saída. O `vercel.json` já define o tipo `model/gltf-binary` para os `.glb` e o cache dos arquivos. A Vercel serve em HTTPS, que o AR exige.

## Checklist de teste de AR no celular

Abra o link **público (https)** no celular. Faça este roteiro em cada aparelho.

**iPhone (Safari)**

- [ ] O cardápio abre sem erro e a lista rola suave?
- [ ] O 3D do prato carrega rápido e gira com o dedo?
- [ ] Ao tocar em **Ver na mesa**, o AR Quick Look abre (pode levar 1 a 2 segundos para preparar o modelo)?
- [ ] O prato **aparece em cima da mesa**, sem flutuar nem afundar?
- [ ] O **tamanho está certo**? Compare com um objeto real ao lado (por exemplo, uma lata de 350 ml tem 12,2 cm de altura, e o hambúrguer da demo tem 11 cm de diâmetro). O prato **não deve** ser redimensionável.
- [ ] Dá para andar em volta e o prato fica firme no lugar?
- [ ] A cor e a luz estão aceitáveis? A sombra aparece?
- [ ] Ao voltar do AR, o cardápio continua onde estava?

**Android (Chrome)**

- [ ] Ao tocar em **Ver na mesa**, o Scene Viewer (ou o AR do Chrome) abre?
- [ ] O prato aparece na mesa, no **tamanho certo** e sem poder ser ampliado?
- [ ] Ele acompanha o movimento do celular sem "escorregar"?
- [ ] Em um aparelho sem suporte a AR, aparece o aviso amigável e o 3D continua girando?

**Em ambos**

- [ ] O carregamento do modelo é rápido na rede móvel (os arquivos da demo têm de 30 a 220 KB)?
- [ ] O QR code impresso escaneia na câmera nativa e abre o cardápio da mesa certa?

Se algo falhar, anote o aparelho, o sistema e o navegador, e o prato em que aconteceu.

## Limitações conhecidas

- **Modelos placeholder:** são estilizados (low-poly), não fotorrealistas, e foram gerados por script. O AR é real, mas o acabamento do prato só chega ao nível de produto com modelos reais.
- **AR não testado em aparelho real nesta entrega.** Tudo o que depende de câmera e sensores (Quick Look, Scene Viewer, WebXR) precisa ser validado por você no celular, em HTTPS.
- **iPhone:** o USDZ é gerado no aparelho na hora do toque. Em modelos pesados ou celulares antigos pode haver uma pequena espera antes de o AR abrir.
- **Vidro e transparências** (copos, gelo) usam opacidade parcial. Alguns visualizadores de AR simplificam a transparência.
- **Fontes:** vêm do Google Fonts. Sem internet, o cardápio cai nas fontes do sistema (continua funcional).
- **Sem back-end:** não há login, painel, pedidos, pagamento nem banco de dados.

## Próximos passos

1. **Modelos 3D reais** a partir das fotos de cada cliente (IA generativa de imagem para 3D, fotogrametria ou modelagem manual), com o fluxo de troca de arquivo descrito acima.
2. **Supabase multi-restaurante:** mover o `menu.json` para tabelas (`restaurants`, `categories`, `items`, `models`) e o Storage para os GLBs e imagens. O formato atual já foi pensado para virar tabela sem retrabalho.
3. **Painel de administração** para o restaurante editar pratos, preços e fotos sozinho, com login e perfil por restaurante.
4. **Domínio próprio e QR por mesa** com o endereço definitivo de cada cliente.
5. **Métricas:** quantos clientes abrem o AR, quais pratos são mais vistos e em que mesa.
