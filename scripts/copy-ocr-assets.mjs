// Copie le moteur OCR (Tesseract) dans public/ocr pour qu'il soit servi par l'application
// au lieu d'être téléchargé depuis un CDN externe. Lancé automatiquement avant dev/build.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nm = (...p) => join(root, 'node_modules', ...p);
const out = (...p) => join(root, 'public', 'ocr', ...p);

const files = [
  [nm('tesseract.js', 'dist', 'worker.min.js'), out('worker.min.js')],
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), out('core', 'tesseract-core-lstm.wasm.js')],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), out('core', 'tesseract-core-simd-lstm.wasm.js')],
  [nm('tesseract.js-core', 'tesseract-core-relaxedsimd-lstm.wasm.js'), out('core', 'tesseract-core-relaxedsimd-lstm.wasm.js')],
  [nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), out('lang', 'eng.traineddata.gz')],
];

let copied = 0;
for (const [from, to] of files) {
  if (!existsSync(from)) {
    console.error(`[ocr] Fichier manquant : ${from} (lancez npm install)`);
    process.exit(1);
  }
  if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
  copied++;
}
if (copied) console.log(`[ocr] ${copied} fichier(s) du moteur OCR copiés dans public/ocr`);
