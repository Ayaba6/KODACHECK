import { createWorker, OEM, PSM, type Worker } from 'tesseract.js';
import { parsePlate, type PlateReading } from './plateUtils';

const BASE = `${import.meta.env.BASE_URL}ocr`;

/**
 * Démarre le moteur OCR avec les fichiers servis par l'application (public/ocr),
 * sans dépendre d'un CDN. Le modèle de langue est ensuite mis en cache par le navigateur.
 */
export async function createPlateWorker(): Promise<Worker> {
  const worker = await createWorker('eng', OEM.LSTM_ONLY, {
    workerPath: `${BASE}/worker.min.js`,
    corePath: `${BASE}/core`,
    langPath: `${BASE}/lang`,
    gzip: true,
  });
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ- ',
    tessedit_pageseg_mode: PSM.SINGLE_BLOCK,
    preserve_interword_spaces: '1',
  });
  return worker;
}

export interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Convertit la zone de visée affichée à l'écran en coordonnées de l'image caméra,
 * en tenant compte du recadrage « object-cover » de la vidéo.
 */
export function mapOverlayToVideo(video: HTMLVideoElement, overlay: HTMLElement): Region {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  const vr = video.getBoundingClientRect();
  const or = overlay.getBoundingClientRect();
  const scale = Math.max(vr.width / vw, vr.height / vh);
  const offsetX = (vr.width - vw * scale) / 2;
  const offsetY = (vr.height - vh * scale) / 2;

  const x = (or.left - vr.left - offsetX) / scale;
  const y = (or.top - vr.top - offsetY) / scale;
  const w = or.width / scale;
  const h = or.height / scale;

  const cx = Math.max(0, Math.min(vw, x));
  const cy = Math.max(0, Math.min(vh, y));
  return { x: cx, y: cy, w: Math.min(vw - cx, w), h: Math.min(vh - cy, h) };
}

/** Seuil d'Otsu : sépare au mieux le texte du fond, quel que soit l'éclairage. */
function otsuThreshold(hist: Uint32Array, total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 127;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/**
 * Prépare la zone de la plaque pour l'OCR : agrandissement, niveaux de gris, étirement du contraste,
 * binarisation d'Otsu, texte remis en noir sur blanc et marge blanche autour.
 */
export interface PreprocessOptions {
  /** Inverse la décision automatique de polarité (2e essai si la 1re lecture échoue). */
  flipPolarity?: boolean;
  /** Largeur de travail : assez pour des caractères nets, assez peu pour une lecture rapide. */
  width?: number;
}

export function preprocessRegion(
  source: HTMLVideoElement | HTMLCanvasElement,
  region: Region,
  out: HTMLCanvasElement,
  { flipPolarity = false, width = 560 }: PreprocessOptions = {},
): void {
  const PAD = 16;
  const targetW = Math.round(width);
  const scale = targetW / region.w;
  const targetH = Math.round(region.h * scale);

  out.width = targetW + PAD * 2;
  out.height = targetH + PAD * 2;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(source, region.x, region.y, region.w, region.h, PAD, PAD, targetW, targetH);

  const img = ctx.getImageData(PAD, PAD, targetW, targetH);
  const px = img.data;
  const n = targetW * targetH;
  const gray = new Uint8ClampedArray(n);

  // Niveaux de gris + histogramme
  const hist = new Uint32Array(256);
  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const g = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    gray[j] = g;
    hist[gray[j]]++;
  }

  // Étirement du contraste (2 % / 98 %) pour les images ternes ou à contre-jour
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && acc + hist[lo] < n * 0.02; lo++) acc += hist[lo];
  for (let acc = 0; hi > 0 && acc + hist[hi] < n * 0.02; hi--) acc += hist[hi];
  const range = Math.max(1, hi - lo);

  const stretched = new Uint32Array(256);
  for (let j = 0; j < n; j++) {
    gray[j] = ((gray[j] - lo) * 255) / range;
    stretched[gray[j]]++;
  }

  const t = otsuThreshold(stretched, n);

  // Polarité : le texte occupe moins de surface que le fond de la plaque. On ne compte que le centre
  // du cadre, pour que l'environnement autour de la plaque (carrosserie, ombre) ne fausse pas le calcul.
  let dark = 0;
  let counted = 0;
  const x0 = Math.floor(targetW * 0.15);
  const x1 = Math.ceil(targetW * 0.85);
  const y0 = Math.floor(targetH * 0.2);
  const y1 = Math.ceil(targetH * 0.8);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      if (gray[y * targetW + x] <= t) dark++;
      counted++;
    }
  }
  const invert = dark > counted / 2 !== flipPolarity;

  // ink = 1 pour les pixels de texte (noirs après binarisation)
  const ink = new Uint8Array(n);
  for (let j = 0; j < n; j++) ink[j] = (gray[j] <= t) !== invert ? 1 : 0;

  removeNonCharacterShapes(ink, targetW, targetH);

  for (let i = 0, j = 0; j < n; i += 4, j++) {
    const v = ink[j] ? 0 : 255;
    px[i] = px[i + 1] = px[i + 2] = v;
  }
  ctx.putImageData(img, PAD, PAD);
}

/**
 * Supprime les formes qui ne peuvent pas être des caractères : cadre de la plaque, bords de l'image,
 * taches. Sans cela, Tesseract considère le texte encadré comme une image et ne renvoie rien.
 */
function removeNonCharacterShapes(ink: Uint8Array, w: number, h: number): void {
  const seen = new Uint8Array(ink.length);
  const stack = new Int32Array(ink.length);
  const minArea = Math.max(12, Math.round(w * h * 0.0004));

  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;

    // Parcours de la composante connexe (4-voisinage)
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let minX = w, maxX = 0, minY = h, maxY = 0, area = 0;
    const members: number[] = [];
    const visit = (q: number) => {
      if (ink[q] && !seen[q]) {
        seen[q] = 1;
        stack[top++] = q;
      }
    };
    while (top > 0) {
      const p = stack[--top];
      members.push(p);
      area++;
      const x = p % w;
      const y = (p - x) / w;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x > 0) visit(p - 1);
      if (x < w - 1) visit(p + 1);
      if (y > 0) visit(p - w);
      if (y < h - 1) visit(p + w);
    }

    const bw = maxX - minX + 1;
    const bh = maxY - minY + 1;
    const touchesEdge = minX === 0 || minY === 0 || maxX === w - 1 || maxY === h - 1;
    const tooWide = bw > w * 0.4; // un caractère ne fait jamais 40 % de la largeur
    const tooTall = bh > h * 0.9;
    const tooSmall = area < minArea;
    const hollow = area < bw * bh * 0.08 && bw > w * 0.2; // cadre fin et large

    if (touchesEdge || tooWide || tooTall || tooSmall || hollow) {
      for (const p of members) ink[p] = 0;
    }
  }
}

export interface OcrAttempt {
  reading: PlateReading | null;
  confidence: number;
  rawText: string;
}

/** Lit une image préparée et en extrait la plaque. */
export async function readPlate(worker: Worker, canvas: HTMLCanvasElement): Promise<OcrAttempt> {
  // On passe une image PNG déjà encodée : avec un canvas, tesseract.js appelle canvas.toBlob(),
  // que Chrome peut différer d'environ 1 s quand la page ne se redessine pas (≈ 70 ms au lieu de 1,1 s).
  const { data } = await worker.recognize(canvas.toDataURL('image/png'));
  return { reading: parsePlate(data.text), confidence: data.confidence, rawText: data.text };
}

/**
 * Prépare et lit une zone ; si aucune plaque reconnue, retente avec la polarité inverse
 * (plaques claires sur fond sombre, reflets…).
 */
export async function scanRegion(
  worker: Worker,
  source: HTMLVideoElement | HTMLCanvasElement,
  region: Region,
  work: HTMLCanvasElement,
): Promise<OcrAttempt> {
  preprocessRegion(source, region, work);
  const first = await readPlate(worker, work);
  if (first.reading?.strong) return first;

  preprocessRegion(source, region, work, { flipPolarity: true });
  const second = await readPlate(worker, work);
  if (second.reading?.strong) return second;
  return (second.reading && !first.reading) ? second : first;
}
