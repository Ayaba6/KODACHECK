/**
 * Plaques d'immatriculation du Burkina Faso.
 *
 * Format actuel (deux lignes) :      0029
 *                                 BF D₁ 08
 *   - n° d'ordre sur 4 chiffres ;
 *   - catégorie (D usage privé, A État/police, B collectivités, C parapublic, T transport public,
 *     CD diplomatique, WW transit/garage) suivie d'un petit indice de série (₁) ;
 *   - code de région 01 à 13.
 * Forme canonique utilisée dans KodaCheck : « 0029 D1 08 ».
 *
 * Deux-roues (deux lignes) :   4131        8730
 *                            BF 5X 03    BF 2DJ 03
 *   - n° d'ordre sur 4 chiffres ; chiffre + 1-2 lettres ; code de région.
 * Forme canonique : « 4131 5X 03 ».
 *
 * Ancien format, encore en circulation : « 11 GH 1234 ».
 */

export const BF_REGIONS: Record<string, { name: string; chefLieu: string }> = {
  '01': { name: 'Boucle du Mouhoun', chefLieu: 'Dédougou' },
  '02': { name: 'Cascades', chefLieu: 'Banfora' },
  '03': { name: 'Centre', chefLieu: 'Ouagadougou' },
  '04': { name: 'Centre-Est', chefLieu: 'Tenkodogo' },
  '05': { name: 'Centre-Nord', chefLieu: 'Kaya' },
  '06': { name: 'Centre-Ouest', chefLieu: 'Koudougou' },
  '07': { name: 'Centre-Sud', chefLieu: 'Manga' },
  '08': { name: 'Est', chefLieu: "Fada N'Gourma" },
  '09': { name: 'Hauts-Bassins', chefLieu: 'Bobo-Dioulasso' },
  '10': { name: 'Nord', chefLieu: 'Ouahigouya' },
  '11': { name: 'Plateau Central', chefLieu: 'Ziniaré' },
  '12': { name: 'Sahel', chefLieu: 'Dori' },
  '13': { name: 'Sud-Ouest', chefLieu: 'Gaoua' },
};

export const BF_CATEGORIES: Record<string, string> = {
  D: 'Usage privé',
  A: 'État / Police nationale',
  B: 'Collectivités territoriales',
  C: 'Organismes parapublics',
  T: 'Transport public',
  CD: 'Corps diplomatique',
  WW: 'Transit / garage',
};

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', J: '1', Z: '2', S: '5', B: '8', G: '6', A: '4' };
const TO_LETTER: Record<string, string> = { '0': 'D', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G', '4': 'A', '7': 'T' };

/** Confusions propres aux lettres de catégorie (une seule lettre, liste fermée). */
const CATEGORY_FIX: Record<string, string> = { '1': 'T', I: 'T', '7': 'T', Y: 'T', '0': 'D', O: 'D', '8': 'B', '4': 'A', '6': 'C', G: 'C' };

const toDigits = (s: string) => [...s].map((c) => TO_DIGIT[c] ?? c).join('');
const toLetters = (s: string) => [...s].map((c) => TO_LETTER[c] ?? c).join('');
const isRegion = (code: string | null): code is string => code !== null && code in BF_REGIONS;

/** Lectures possibles de chaque caractère dans un code région (ex : G = 0 ou 6). */
const REGION_CHAR: Record<string, string[]> = { O: ['0'], Q: ['0'], D: ['0'], U: ['0'], G: ['0', '6'], C: ['0'], I: ['1'], L: ['1'], T: ['1'], J: ['1'], Z: ['2'], S: ['5'], B: ['8'], A: ['4'] };

/** Code région valide (01-13) correspondant à 2 caractères lus, en tenant compte des confusions. */
function toRegion(two: string): string | null {
  const opts = [...two].map((c) => (/[0-9]/.test(c) ? [c] : REGION_CHAR[c] ?? []));
  for (const a of opts[0] ?? []) for (const b of opts[1] ?? []) if (isRegion(a + b)) return a + b;
  return null;
}

export interface PlateParts {
  /** auto : « 0029 D1 08 » · moto : « 4131 5X 03 » */
  kind: 'auto' | 'moto';
  serial: string;
  /** Lettres : catégorie (auto) ou série alphabétique (moto). */
  category: string;
  /** Auto : petit indice après la catégorie, souvent illisible. Moto : chiffre devant les lettres. */
  series: string | null;
  region: string;
}

export interface PlateReading {
  /** Plaque normalisée, ex : « 0029 D1 08 ». */
  plate: string;
  /** true si la lecture correspond à un format connu et cohérent. */
  strong: boolean;
  format: 'bf' | 'ancien' | 'partiel';
  parts?: PlateParts;
}

export function formatParts(p: PlateParts): string {
  return p.kind === 'moto'
    ? `${p.serial} ${p.series ?? ''}${p.category} ${p.region}`
    : `${p.serial} ${p.category}${p.series ?? ''} ${p.region}`;
}

/** Caractère pouvant être un chiffre mal lu. */
const D = '[0-9OQDUILTJZSBGA]';

/**
 * Deuxième ligne d'une plaque de deux-roues : chiffre + 1-2 lettres + région, ex : 5X03, 2DJ03.
 * Le chiffre de tête doit être lu comme un vrai chiffre et les lettres contenir au moins une vraie
 * lettre : cela évite de confondre avec une plaque auto dont la catégorie aurait été lue « 1 » (T1 10).
 */
function parseMotoSecondLine(s: string): Omit<PlateParts, 'serial'> | null {
  for (const letters of [2, 1]) {
    const len = 1 + letters + 2;
    for (let start = s.length - len; start >= 0; start--) {
      const chunk = s.slice(start, start + len);
      const series = chunk[0];
      const rawLetters = chunk.slice(1, 1 + letters);
      const category = toLetters(rawLetters);
      const region = toRegion(chunk.slice(1 + letters));
      if (!/^[1-9]$/.test(series) || !/[A-Z]/.test(rawLetters)) continue;
      if (!/^[A-Z]+$/.test(category) || !isRegion(region)) continue;
      return { kind: 'moto', category, series, region };
    }
  }
  return null;
}

/**
 * Bloc « catégorie + indice + région » lu d'un seul tenant, ex : D108, CD09, WW101, D08 (auto),
 * ou « chiffre + lettres + région » (deux-roues). Les lettres sont parfois lues comme des chiffres.
 */
function parseSecondLine(raw: string): Omit<PlateParts, 'serial'> | null {
  const s = raw.replace(/\s+/g, '');
  const moto = parseMotoSecondLine(s);
  if (moto) return moto;
  // Du plus long au plus court : 2 lettres + indice + région, 1 lettre + indice + région, sans indice…
  const attempts: Array<[number, number]> = [
    [2, 1],
    [1, 1],
    [2, 0],
    [1, 0],
  ];
  for (const [letters, idx] of attempts) {
    const len = letters + idx + 2;
    for (let start = s.length - len; start >= 0; start--) {
      const chunk = s.slice(start, start + len);
      let category = toLetters(chunk.slice(0, letters));
      // Lettres de catégorie souvent confondues par l'OCR (T lu « 1 », D lu « 0 »…)
      if (letters === 1 && !(category in BF_CATEGORIES)) category = CATEGORY_FIX[chunk[0]] ?? category;
      const series = idx ? toDigits(chunk.slice(letters, letters + 1)) : null;
      const region = toRegion(chunk.slice(letters + idx));
      if (!/^[A-Z]+$/.test(category) || !isRegion(region)) continue;
      if (series !== null && !/^[1-9]$/.test(series)) continue;
      // Plaques auto : seules les catégories officielles sont acceptées (évite « Z 01 » lu dans « 20J G3 »)
      if (!(category in BF_CATEGORIES)) continue;
      return { kind: 'auto', category, series, region };
    }
  }
  return null;
}

/** Nettoie le texte OCR : majuscules, caractères utiles, une entrée par ligne. */
function ocrLines(raw: string): string[] {
  return raw
    .toUpperCase()
    .split('\n')
    .map((line) => line.replace(/[^A-Z0-9]/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function parseBf(lines: string[]): PlateReading | null {
  // Le n° d'ordre : 4 caractères « chiffres » formant un bloc, de préférence sur la 1re ligne.
  for (let i = 0; i < lines.length; i++) {
    // Le drapeau, à gauche du n° d'ordre, est parfois lu comme un chiffre de plus (« 28730 ») :
    // en début de ligne on tolère un caractère parasite devant les 4 chiffres.
    const serialMatch =
      lines[i].match(new RegExp(`(?:^|\\s|[^0-9])(${D}{4})(?![0-9])`)) ??
      lines[i].match(new RegExp(`^${D}(${D}{4})(?![0-9A-Z])`));
    if (!serialMatch) continue;
    const serial = toDigits(serialMatch[1]);
    if (!/^\d{4}$/.test(serial)) continue;

    // La 2e ligne (ou la suite de la même ligne si l'OCR a tout fusionné), sans la mention « BF ».
    const after = [lines[i].slice((serialMatch.index ?? 0) + serialMatch[0].length), ...lines.slice(i + 1)]
      .join(' ')
      .replace(/\b(?:BF|8F|BE|EF|B F)\b/g, ' ');
    // parseSecondLine part de la fin du texte, là où se trouve le code région
    const second = parseSecondLine(after);
    if (second) {
      const parts = { serial, ...second };
      return { plate: formatParts(parts), strong: true, format: 'bf', parts };
    }
  }

  // Tout lu sur une ligne sans séparation : « 0029D108 »
  const compact = lines.join('').replace(/(?:BF|8F)/g, '');
  const m = compact.match(new RegExp(`(${D}{4})([A-Z0-9]{3,5})$`));
  if (m) {
    const serial = toDigits(m[1]);
    const second = parseSecondLine(m[2]);
    if (/^\d{4}$/.test(serial) && second) {
      const parts = { serial, ...second };
      return { plate: formatParts(parts), strong: true, format: 'bf', parts };
    }
  }
  return null;
}

function parseLegacy(text: string): PlateReading | null {
  // 2 chiffres + 1-2 lettres + 4 chiffres : 11 GH 1234
  const re = new RegExp(`(?:^|[^0-9A-Z])(${D}{2})\\s*([A-Z0-9]{1,2})\\s*(${D}{4})(?![0-9A-Z])`);
  for (const variant of [text, text.replace(/\s+/g, '')]) {
    const m = variant.match(re);
    if (!m) continue;
    const letters = toLetters(m[2]);
    const a = toDigits(m[1]);
    const b = toDigits(m[3]);
    if (/^[A-Z]{1,2}$/.test(letters) && /^\d{2}$/.test(a) && /^\d{4}$/.test(b)) {
      return { plate: `${a} ${letters} ${b}`, strong: true, format: 'ancien' };
    }
  }
  return null;
}

/** Extrait la plaque la plus plausible d'un texte (OCR ou saisie), ou null si rien d'exploitable. */
export function parsePlate(rawText: string): PlateReading | null {
  const lines = ocrLines(rawText);
  if (lines.length === 0) return null;

  const bf = parseBf(lines);
  if (bf) return bf;

  const legacy = parseLegacy(lines.join(' '));
  if (legacy) return legacy;

  // Lecture partielle : proposée à l'agent, qui pourra la corriger
  const tokens = lines.join(' ').split(' ').filter((t) => t.length >= 2 && /\d/.test(t) && t !== 'BF');
  const guess = tokens.slice(0, 3).join(' ');
  return guess.replace(/\s/g, '').length >= 4 ? { plate: guess, strong: false, format: 'partiel' } : null;
}

/**
 * Mise en forme d'une plaque saisie à la main, pour un enregistrement homogène :
 * « 0029d108 » → « 0029 D1 08 ». Une saisie non reconnue est conservée en majuscules.
 */
export function normalizePlateInput(value: string): string {
  const clean = value.trim().toUpperCase().replace(/\s+/g, ' ');
  if (!clean) return '';
  const reading = parsePlate(clean);
  return reading?.strong ? reading.plate : clean;
}

/** Version compacte (A-Z / 0-9 uniquement) pour comparer deux plaques. */
export function compactPlate(plate: string | null | undefined): string {
  return (plate ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Deux plaques désignent-elles le même engin ? Tolère l'indice de série manquant
 * (souvent illisible à distance) : « 0029 D 08 » correspond à « 0029 D1 08 ».
 */
export function platesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const ca = compactPlate(a);
  const cb = compactPlate(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  const pa = parsePlate(ca)?.parts;
  const pb = parsePlate(cb)?.parts;
  if (!pa || !pb) return false;
  if (pa.kind !== pb.kind || pa.serial !== pb.serial || pa.category !== pb.category || pa.region !== pb.region) {
    return false;
  }
  // L'indice manquant n'est toléré que sur les plaques auto (petit chiffre) ; sur les deux-roues
  // le chiffre de tête est aussi grand que le reste et fait partie de l'immatriculation.
  return pa.kind === 'auto' ? pa.series === null || pb.series === null || pa.series === pb.series : pa.series === pb.series;
}

/** Description lisible d'une plaque : catégorie et région d'immatriculation. */
export function describePlate(plate: string | null | undefined): { category?: string; region?: string } | null {
  const parts = parsePlate(plate ?? '')?.parts;
  if (!parts) return null;
  const region = BF_REGIONS[parts.region];
  return {
    category: parts.kind === 'moto' ? 'Deux-roues' : BF_CATEGORIES[parts.category],
    region: region ? `${region.name} (${region.chefLieu})` : undefined,
  };
}

/** La saisie (ou la lecture) correspond-elle à une plaque complète et au format reconnu ? */
export function isCompletePlate(value: string | null | undefined): boolean {
  return Boolean(parsePlate(value ?? '')?.strong);
}

/**
 * N° d'ordre (4 chiffres) présent dans une lecture partielle, ex : « 4131 Y I » → « 4131 ».
 * Sert à proposer des correspondances possibles quand la plaque n'a pas été lue entièrement.
 */
export function extractSerial(value: string | null | undefined): string | null {
  const m = (value ?? '').toUpperCase().match(new RegExp(`(?:^|[^0-9])(${D}{4})(?![0-9])`));
  if (!m) return null;
  const serial = toDigits(m[1]);
  return /^\d{4}$/.test(serial) ? serial : null;
}
