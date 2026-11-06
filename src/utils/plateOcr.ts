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

/**
 * Réglages de lecture. Les plaques BF utilisent une police étroite que le modèle généraliste lit mal :
 * on ramène chaque ligne à une hauteur standard et on l'élargit légèrement. Les variantes sont
 * utilisées à tour de rôle d'une image à l'autre : les erreurs changent, la bonne lecture se répète.
 */
export const READ_VARIANTS = [
  { lineHeight: 56, stretch: 1 },
  { lineHeight: 72, stretch: 1.3 },
  { lineHeight: 44, stretch: 1.15 },
] as const;
export type ReadVariant = (typeof READ_VARIANTS)[number];

/**
 * Repère les lignes de texte d'une image binarisée (texte noir sur blanc).
 * On regroupe les caractères (composantes connexes) selon leur bord supérieur : sur les plaques
 * réelles, une tache ou les empattements des « 1 » relient souvent les deux lignes, ce qui rend
 * inutilisable une simple recherche de bande vide entre elles.
 */
export function findTextLines(canvas: HTMLCanvasElement): Region[] {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !W || !H) return [];
  const data = ctx.getImageData(0, 0, W, H).data;
  const ink = new Uint8Array(W * H);
  for (let p = 0, i = 0; p < ink.length; p++, i += 4) ink[p] = data[i] < 128 ? 1 : 0;

  // Composantes connexes (4-voisinage)
  const boxes: Array<{ x0: number; y0: number; x1: number; y1: number; area: number; id: number }> = [];
  const label = new Int32Array(ink.length).fill(-1);
  const seen = new Uint8Array(ink.length);
  const stack = new Int32Array(ink.length);
  for (let start = 0; start < ink.length; start++) {
    if (!ink[start] || seen[start]) continue;
    let top = 0;
    stack[top++] = start;
    seen[start] = 1;
    let x0 = W, y0 = H, x1 = 0, y1 = 0, area = 0;
    while (top > 0) {
      const p = stack[--top];
      label[p] = boxes.length;
      area++;
      const x = p % W;
      const y = (p - x) / W;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      const neighbours = [x > 0 ? p - 1 : -1, x < W - 1 ? p + 1 : -1, y > 0 ? p - W : -1, y < H - 1 ? p + W : -1];
      for (const q of neighbours) {
        if (q >= 0 && ink[q] && !seen[q]) {
          seen[q] = 1;
          stack[top++] = q;
        }
      }
    }
    boxes.push({ x0, y0, x1, y1, area, id: boxes.length });
  }

  // Caractères probables : on écarte les petites marques (vis, poussière, « BF » miniature)
  const heights = boxes.map((b) => b.y1 - b.y0 + 1).sort((a, b) => b - a);
  const refHeight = heights[Math.min(2, heights.length - 1)] ?? 0;
  const chars = boxes.filter((b) => b.y1 - b.y0 + 1 >= refHeight * 0.45);
  if (chars.length === 0) return [];
  const isChar = new Uint8Array(boxes.length);
  for (const b of chars) isChar[b.id] = 1;

  const median = (values: number[]) => {
    const s = [...values].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const charHeight = median(chars.map((b) => b.y1 - b.y0 + 1));

  // Regroupement par bord supérieur : on coupe au plus grand écart s'il dépasse 40 % d'un caractère
  const sorted = [...chars].sort((a, b) => a.y0 - b.y0);
  let cut = -1;
  let gap = 0;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[i].y0 - sorted[i - 1].y0;
    if (d > gap) {
      gap = d;
      cut = i;
    }
  }
  const groups = gap > charHeight * 0.4 && cut > 0 ? [sorted.slice(0, cut), sorted.slice(cut)] : [sorted];

  return groups
    .filter((g) => g.length > 0)
    .map((g) => {
      // Hauteur de ligne robuste : médiane des bords, pour qu'un caractère soudé à une tache
      // n'agrandisse pas la ligne jusque dans la suivante.
      const margin = Math.round(charHeight * 0.08);
      const y0 = Math.max(0, median(g.map((b) => b.y0)) - margin);
      const y1 = Math.min(H - 1, median(g.map((b) => b.y1)) + margin);
      // Étendue horizontale mesurée dans la bande elle-même : un caractère de la ligne du dessous
      // soudé (par une tache) à un caractère du dessus doit compter pour sa propre ligne.
      let x0 = W;
      let x1 = -1;
      for (let y = y0; y <= y1; y++) {
        for (let x = 0, p = y * W; x < W; x++, p++) {
          if (label[p] >= 0 && isChar[label[p]]) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
          }
        }
      }
      x0 = Math.max(0, x0 - margin);
      x1 = Math.min(W - 1, x1 + margin);
      return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    })
    .filter((r) => r.w > 10 && r.h > 8);
}


/** Redimensionne une ligne à la hauteur voulue, l'élargit et l'entoure de blanc. */
function renderLine(source: HTMLCanvasElement, r: Region, { lineHeight, stretch }: ReadVariant): HTMLCanvasElement {
  const pad = 14;
  const w = Math.round(r.w * (lineHeight / r.h) * stretch);
  const c = document.createElement('canvas');
  c.width = w + pad * 2;
  c.height = lineHeight + pad * 2;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(source, r.x, r.y, r.w, r.h, pad, pad, w, lineHeight);
  }
  return c;
}

const currentPsm = new WeakMap<Worker, string>();
async function setPsm(worker: Worker, psm: PSM) {
  if (currentPsm.get(worker) === psm) return;
  await worker.setParameters({ tessedit_pageseg_mode: psm });
  currentPsm.set(worker, psm);
}

/**
 * Envoie une image au moteur. On passe un PNG déjà encodé : avec un canvas, tesseract.js appelle
 * canvas.toBlob(), que Chrome peut différer d'environ 1 s quand la page ne se redessine pas.
 */
async function recognize(worker: Worker, canvas: HTMLCanvasElement) {
  const { data } = await worker.recognize(canvas.toDataURL('image/png'));
  return data;
}

/** Lit une image préparée (binarisée) : ligne par ligne si possible, sinon en bloc. */
export async function readPlate(worker: Worker, canvas: HTMLCanvasElement, variant: ReadVariant = READ_VARIANTS[0]): Promise<OcrAttempt> {
  const lines = findTextLines(canvas);

  if (lines.length > 0 && lines.length <= 2) {
    await setPsm(worker, PSM.SINGLE_LINE);
    const texts: string[] = [];
    let confidence = 0;
    for (const line of lines) {
      const data = await recognize(worker, renderLine(canvas, line, variant));
      texts.push(data.text.trim());
      confidence += data.confidence;
    }
    const rawText = texts.join('\n');
    const reading = parsePlate(rawText);
    if (reading?.strong) return { reading, confidence: confidence / lines.length, rawText };
  }

  // Repli : lecture du bloc entier
  await setPsm(worker, PSM.SINGLE_BLOCK);
  const data = await recognize(worker, canvas);
  return { reading: parsePlate(data.text), confidence: data.confidence, rawText: data.text };
}

/**
 * Lecture approfondie (capture manuelle) : essaie les variantes et les deux polarités
 * jusqu'à obtenir une plaque au format reconnu.
 */
export async function scanRegion(
  worker: Worker,
  source: HTMLVideoElement | HTMLCanvasElement,
  region: Region,
  work: HTMLCanvasElement,
): Promise<OcrAttempt> {
  let best: OcrAttempt | null = null;
  for (const flipPolarity of [false, true]) {
    preprocessRegion(source, region, work, { flipPolarity });
    for (const variant of READ_VARIANTS) {
      const attempt = await readPlate(worker, work, variant);
      if (attempt.reading?.strong) return attempt;
      if (!best?.reading && attempt.reading) best = attempt;
    }
  }
  return best ?? { reading: null, confidence: 0, rawText: '' };
}
