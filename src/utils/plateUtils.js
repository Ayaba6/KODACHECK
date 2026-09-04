/**
 * Corrige les confusions fréquentes de Tesseract OCR sur les plaques.
 * Les règles s'appuient sur les formats courants au Burkina Faso (ex: 11-RJ-8596 ou 4131 5X03).
 */
export function normalizePlate(rawText) {
  if (!rawText) return '';

  // 1. Découpage par ligne / espace et suppression des caractères parasites
  let cleaned = rawText
    .toUpperCase()
    .replace(/[^A-Z0-9\s-]/g, '') // Ne garder que lettres, chiffres, espaces et tirets
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Dictionnaire de remplacement OCR
  const charMapToNumber = { 'O': '0', 'Q': '0', 'D': '0', 'I': '1', 'L': '1', 'Z': '2', 'S': '5', 'B': '8' };
  const charMapToLetter = { '0': 'O', '1': 'I', '5': 'S', '8': 'B', '2': 'Z' };

  // 3. Correction segment par segment
  const parts = cleaned.split(/[\s-]+/);

  const fixedParts = parts.map((part) => {
    // Si la partie est uniquement composée de 2 à 4 caractères (ex: bloc de chiffres ou de lettres)
    let fixed = '';
    
    // Détection : si la majorité du bloc est numérique, on force la conversion vers des chiffres
    const digitCount = (part.match(/[0-9]/g) || []).length;
    const letterCount = (part.match(/[A-Z]/g) || []).length;

    if (digitCount >= letterCount) {
      // Convertir les lettres ambiguës en chiffres
      for (let char of part) {
        fixed += charMapToNumber[char] || char;
      }
    } else {
      // Convertir les chiffres ambigus en lettres
      for (let char of part) {
        fixed += charMapToLetter[char] || char;
      }
    }
    return fixed;
  });

  return fixedParts.join(' ');
}

/**
 * Nettoie une plaque pour la recherche Supabase (supprime tout sauf A-Z et 0-9)
 */
export function getCleanSearchString(plateText) {
  return plateText.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}