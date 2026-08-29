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

async function makeThumbFromImageFile(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_THUMB_DIM / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, w, h);
  return resizeCanvasToBlob(canvas);
}

async function makeThumbFromPdfFile(file) {
  const buf = await readFileAsArrayBuffer(file);
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(2.2, MAX_THUMB_DIM / Math.max(baseViewport.width, baseViewport.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return resizeCanvasToBlob(canvas);
}

// Retorna { thumbBlob, fileBlob, fileType, fileName }
async function processUpload(file) {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const fileType = isPdf ? 'pdf' : 'image';
  const thumbBlob = isPdf ? await makeThumbFromPdfFile(file) : await makeThumbFromImageFile(file);
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
