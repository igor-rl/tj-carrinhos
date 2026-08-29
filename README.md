# Carrinho de Publicações

App web (PWA) para montar os carrinhos de literatura, do jeito que você já organiza no Figma:
uma tela única com o **carrinho** à esquerda (navegue entre eles com as setas ‹ ›) e a
**biblioteca** de banners/folhetos/brochuras/convites/livros/revistas à direita, dividida por
categoria.

Funciona **100% offline** depois do primeiro carregamento (service worker + IndexedDB).
Os arquivos (imagens e PDFs) ficam salvos localmente no navegador do iPad. Como é local,
o **backup manual em .zip** (aba "Backup") é a forma de levar tudo pra outro dispositivo
ou guardar uma cópia de segurança.

## Como colocar no iPad

Isso é um site estático (HTML/CSS/JS puro, sem backend). Pra instalar como app no iPad,
ele precisa estar servido por **https** (Safari não instala PWA de `file://`). Formas mais
simples, do mais rápido ao mais "seu":

1. **GitHub Pages** (grátis, você já usa GitHub):
   - Crie um repositório novo, suba todo o conteúdo desta pasta na raiz.
   - Settings → Pages → Deploy from branch → `main` / `/ (root)`.
   - Abra a URL gerada (`https://seuusuario.github.io/repo/`) no Safari do iPad.

2. **Cloudflare Pages / Netlify** (arrastar a pasta e pronto):
   - `netlify.com/drop` → arraste a pasta → gera URL https na hora.

3. **Servir você mesmo** (se preferir, já que você mexe com Docker):
   ```bash
   # qualquer servidor estático serve. Exemplo simples:
   npx serve .
   # ou um Dockerfile de 3 linhas com nginx:alpine servindo /usr/share/nginx/html
   ```

Depois de abrir a URL no Safari do iPad:
- Toque em **Compartilhar** → **Adicionar à Tela de Início**.
- Abra pelo ícone criado — ele roda em tela cheia, sem barra do Safari, e funciona offline
  a partir daí (o service worker guarda todo o app em cache no primeiro acesso).

## Uso

- **Carrinho** (esquerda): use ‹ › pra navegar entre os carrinhos, toque no nome pra
  renomear, ＋ no topo cria um novo, o lixo no canto inferior exclui o atual.
- **Biblioteca** (direita, rolável): toque em "Adicionar" em qualquer categoria, escolha
  uma imagem ou PDF. Se for PDF, a capa (1ª página) vira a miniatura automaticamente.
- **Backup**: ícone no topo abre a modal — exporte um `.zip` sempre que quiser garantir
  uma cópia (leva pro iCloud Drive, Google Drive, e-mail, onde preferir). Pra restaurar em
  outro iPad, importe o mesmo `.zip`.

## Estrutura do projeto

```
index.html          shell do app
styles.css           CSS compilado (gerado pelo Tailwind — não editar à mão)
src/input.css        fonte do Tailwind (tema, componentes)
db.js                IndexedDB (biblioteca + carrinhos)
files.js             geração de miniatura (imagem / capa de PDF via pdf.js)
backup.js            export/import em .zip (JSZip)
app.js               telas e interações
service-worker.js    cache offline
manifest.json        metadados do PWA (ícone, nome, tela cheia)
vendor/              pdf.js e JSZip vendorizados (sem depender de CDN)
```

Sem dependências externas em tempo de execução — tudo que o app precisa já está na pasta.
O Tailwind só entra como build local (`npm run build:css`) pra gerar o `styles.css`; o site
publicado continua puro HTML/CSS/JS estático, sem build step no navegador.
