import type { PDFDocumentProxy } from 'pdfjs-dist';

export const MAX_UPLOAD = 12 * 1024 * 1024;
export type PageDocument = { document: PDFDocumentProxy; numPages: number; destroy: () => Promise<void> };
export type Region = { x: number; y: number; w: number; h: number };
let pdfLibrary: Promise<typeof import('pdfjs-dist')> | undefined;

export async function openPdf(file: File) {
  pdfLibrary ??= Promise.all([
    import('pdfjs-dist'),
    import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
  ]).then(([pdf, worker]) => {
    pdf.GlobalWorkerOptions.workerSrc = worker.default;
    return pdf;
  }).catch(error => {
    pdfLibrary = undefined;
    throw error;
  });
  const pdf = await pdfLibrary;
  const task = pdf.getDocument({ data: await file.arrayBuffer(), maxImageSize: 16_000_000 });
  try {
    const document = await task.promise;
    return { document, numPages: document.numPages, destroy: () => task.destroy() };
  } catch (error) {
    await task.destroy();
    throw error;
  }
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}
function compress(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    image => image ? resolve(image) : reject(new Error('Image conversion failed')),
    'image/jpeg', 0.9,
  ));
}

export async function renderPage(doc: PageDocument, pageNumber: number) {
  const page = await doc.document.getPage(pageNumber);
  const initial = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1700 / Math.max(initial.width, initial.height) });
  const canvas = makeCanvas(viewport.width, viewport.height);
  try {
    await page.render({ canvas, viewport, background: '#fff' }).promise;
    return await compress(canvas);
  } finally {
    page.cleanup();
    canvas.width = canvas.height = 1;
  }
}

export async function loadImage(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const image = new Image();
  try {
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function previewImage(file: File) {
  const image = await loadImage(file);
  if (image.naturalWidth * image.naturalHeight > 55_000_000) throw new Error('Image is too large');
  const scale = Math.min(1, 1700 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = makeCanvas(image.naturalWidth * scale, image.naturalHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return compress(canvas);
}

export async function capturePhoto(video: HTMLVideoElement) {
  if (!video.videoWidth || !video.videoHeight) throw new Error('Camera not ready');
  const scale = Math.min(1, 1700 / Math.max(video.videoWidth, video.videoHeight));
  const canvas = makeCanvas(video.videoWidth * scale, video.videoHeight * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(video, 0, 0, canvas.width, canvas.height);
  return compress(canvas);
}

export async function prepareScan(blob: Blob, region?: Region) {
  const image = await loadImage(blob);
  const width = image.naturalWidth * (region?.w ?? 1);
  const height = image.naturalHeight * (region?.h ?? 1);
  if (width < 112 || height < 112) return { issue: 'small' as const };
  const scale = Math.min(1, 1200 / Math.max(width, height));
  const canvas = makeCanvas(width * scale, height * scale);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas unavailable');
  context.drawImage(image, image.naturalWidth * (region?.x ?? 0), image.naturalHeight * (region?.y ?? 0),
    width, height, 0, 0, canvas.width, canvas.height);
  const check = makeCanvas(72, 72);
  const quality = check.getContext('2d');
  if (!quality) throw new Error('Canvas unavailable');
  quality.drawImage(canvas, 0, 0, 72, 72);
  const data = quality.getImageData(0, 0, 72, 72).data;
  let total = 0, square = 0;
  for (let offset = 0; offset < data.length; offset += 4) {
    const v = data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
    total += v;
    square += v * v;
  }
  const average = total / 5184;
  if (average < 22 || average > 248 || square / 5184 - average ** 2 < 22) return { issue: 'unclear' as const };
  return { file: new File([await compress(canvas)], 'leaf-scan.jpg', { type: 'image/jpeg' }) };
}
