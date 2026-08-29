// backup.js — gera e restaura um .zip com toda a biblioteca e os carrinhos.
function extFromFileName(name, fallback) {
  const m = /\.([a-z0-9]+)$/i.exec(name || '');
  return m ? m[1].toLowerCase() : fallback;
}

async function exportBackup() {
  const [items, carts] = await Promise.all([DB.allItems(), DB.allCarts()]);
  const zip = new JSZip();
  const thumbsFolder = zip.folder('thumbs');
  const filesFolder = zip.folder('files');

  const itemsMeta = [];
  for (const item of items) {
    const thumbExt = 'jpg';
    const fileExt = extFromFileName(item.fileName, item.fileType === 'pdf' ? 'pdf' : 'jpg');
    const thumbPath = `${item.id}.${thumbExt}`;
    const filePath = `${item.id}.${fileExt}`;
    thumbsFolder.file(thumbPath, item.thumbBlob);
    filesFolder.file(filePath, item.fileBlob);
    itemsMeta.push({
      id: item.id,
      category: item.category,
      title: item.title,
      sigla: item.sigla || '',
      fileType: item.fileType,
      fileName: item.fileName,
      createdAt: item.createdAt,
      thumbPath,
      filePath
    });
  }

  zip.file('data.json', JSON.stringify({
    version: 3,
    exportedAt: new Date().toISOString(),
    items: itemsMeta,
    carts
  }, null, 2));

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const stamp = new Date().toISOString().slice(0, 10);
  downloadBlob(blob, `carrinho-backup-${stamp}.zip`);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

// Restaura um backup .zip. Faz upsert por id (substitui itens/grupos existentes com o mesmo id,
// mantém os que não estão no backup). Retorna contagem do que foi importado.
async function importBackup(file) {
  const zip = await JSZip.loadAsync(file);
  const dataFile = zip.file('data.json');
  if (!dataFile) throw new Error('Arquivo de backup inválido: data.json não encontrado.');
  const data = JSON.parse(await dataFile.async('string'));

  for (const meta of data.items || []) {
    const thumbEntry = zip.file(`thumbs/${meta.thumbPath}`);
    const fileEntry = zip.file(`files/${meta.filePath}`);
    const thumbBlob = thumbEntry ? await thumbEntry.async('blob') : null;
    const fileBlob = fileEntry ? await fileEntry.async('blob') : null;
    await DB.putItem({
      id: meta.id,
      category: meta.category,
      title: meta.title,
      sigla: meta.sigla ?? meta.subtitle ?? '', // backups antigos (pré-v4) traziam "subtitle"
      fileType: meta.fileType,
      fileName: meta.fileName,
      createdAt: meta.createdAt,
      thumbBlob,
      fileBlob
    });
  }

  // backups v2 já trazem "carts" direto; backups v1 (antigos) trazem "groups" com carts aninhados.
  const carts = data.carts || (data.groups || []).flatMap(g => g.carts || []);
  for (const cart of carts) {
    await DB.putCart(cart);
  }

  return { items: (data.items || []).length, carts: carts.length };
}
