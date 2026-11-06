/**
 * Outils de lecture des plaques d'immatriculation (formats du Burkina Faso).
 * Exemples : « 11 RJ 8596 » (auto / moto) ou « 4131 5X 03 » (moto récente).
 */

const TO_DIGIT: Record<string, string> = { O: '0', Q: '0', D: '0', I: '1', L: '1', Z: '2', S: '5', B: '8', G: '6' };
const TO_LETTER: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z', '6': 'G' };

const toDigits = (s: string) => [...s].map((c) => TO_DIGIT[c] ?? c).join('');
const toLetters = (s: string) => [...s].map((c) => TO_LETTER[c] ?? c).join('');

/** Extrait une plaque plausible d'un texte brut issu de l'OCR. Retourne null si rien d'exploitable. */
export function extractPlateFromOcr(rawText: string): string | null {
  const tokens = rawText
    .toUpperCase()
    .split('\n')
    .flatMap((line) => line.replace(/[^A-Z0-9]/g, ' ').trim().split(/\s+/))
    .filter(Boolean);

  const full = tokens.join(' ');

  // Format moto récent : 4 chiffres + 2 caractères + 2 chiffres
  const moto = full.match(/([0-9OQDILZSBG]{3,4})\s*([0-9A-Z]{2})\s*([0-9OQDILZSBG]{2})\b/);
  if (moto && /\d/.test(moto[1])) {
    return `${toDigits(moto[1])} ${moto[2]} ${toDigits(moto[3])}`;
  }

  // Format standard : 1-2 chiffres + 1-3 lettres + 3-4 chiffres
  const standard = full.match(/([0-9OQDILZSBG]{1,2})\s*([A-Z0-9]{1,3})\s*([0-9OQDILZSBG]{3,4})/);
  if (standard) {
    return `${toDigits(standard[1])} ${toLetters(standard[2])} ${toDigits(standard[3])}`;
  }

  return tokens.length >= 2 ? tokens.slice(0, 3).join(' ') : null;
}

/** Version compacte (A-Z / 0-9 uniquement) pour comparer deux plaques. */
export function compactPlate(plate: string | null | undefined): string {
  return (plate ?? '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
}
