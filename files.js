// files.js — leitura de arquivos enviados e geração de miniatura de capa.
if (window.pdfjsLib) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = './vendor/pdf.worker.min.js';
}

const MAX_THUMB_DIM = 900; // px — miniatura nítida o bastante pro iPad, mas leve

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsArrayBuffer(file);
  });
}

function resizeCanvasToBlob(canvas, mime = 'image/jpeg', quality = 0.86) {
  return new Promise((resolve) => canvas.toBlob(resolve, mime, quality));
}

// rightHalf: quando true, usa só a metade direita da folha como capa (ex: a folha
// digitalizada trouxe duas páginas lado a lado e a capa de verdade é só a da direita).
async function makeThumbFromImageFile(file, rightHalf) {
  const bitmap = await createImageBitmap(file);
  const srcX = rightHalf ? Math.floor(bitmap.width / 2) : 0;
  const srcW = bitmap.width - srcX;
  const scale = Math.min(1, MAX_THUMB_DIM / Math.max(srcW, bitmap.height));
  const w = Math.round(srcW * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, srcX, 0, srcW, bitmap.height, 0, 0, w, h);
  return resizeCanvasToBlob(canvas);
}

async function makeThumbFromPdfFile(file, rightHalf) {
  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, MAX_THUMB_DIM / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const fullCanvas = document.createElement('canvas');
  fullCanvas.width = viewport.width;
  fullCanvas.height = viewport.height;
  const fullCtx = fullCanvas.getContext('2d');
  await page.render({ canvasContext: fullCtx, viewport }).promise;
  if (!rightHalf) return resizeCanvasToBlob(fullCanvas);

  const srcX = Math.floor(fullCanvas.width / 2);
  const srcW = fullCanvas.width - srcX;
  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = fullCanvas.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(fullCanvas, srcX, 0, srcW, fullCanvas.height, 0, 0, srcW, fullCanvas.height);
  return resizeCanvasToBlob(canvas);
}

// Corta a metade direita de uma miniatura já gerada (sem re-renderizar PDF/imagem de novo) —
// usado quando reaplicamos o último ajuste de "capa é a metade direita" a um upload novo.
async function cropBlobRightHalf(blob) {
  const bitmap = await createImageBitmap(blob);
  const srcX = Math.floor(bitmap.width / 2);
  const srcW = bitmap.width - srcX;
  const canvas = document.createElement('canvas');
  canvas.width = srcW;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, srcX, 0, srcW, bitmap.height, 0, 0, srcW, bitmap.height);
  return resizeCanvasToBlob(canvas);
}

// Retorna { thumbBlob, fileBlob, fileType, fileName }
async function processUpload(file, rightHalf) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const fileType = isPdf ? 'pdf' : 'image';
  const thumbBlob = isPdf ? await makeThumbFromPdfFile(file, rightHalf) : await makeThumbFromImageFile(file, rightHalf);
  return {
    thumbBlob,
    fileBlob: file,
    fileType,
    fileName: file.name
  };
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(blob);
  });
}
