import { parsePageRanges } from './page-ranges.js';

export async function openPdf(file) {
  let pdfjs;
  try {
    pdfjs = await import('../vendor/pdfjs/build/pdf.min.mjs');
  } catch {
    throw new Error('Brak PDF.js. Zainstaluj paczkę modułu z katalogu dist po wykonaniu npm run build.');
  }
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdfjs/build/pdf.worker.min.mjs', import.meta.url).href;
  const base = new URL('../vendor/pdfjs/', import.meta.url).href;
  const task = pdfjs.getDocument({
    data: new Uint8Array(await file.arrayBuffer()),
    isEvalSupported: false,
    cMapUrl: `${base}cmaps/`, cMapPacked: true,
    standardFontDataUrl: `${base}standard_fonts/`,
    wasmUrl: `${base}wasm/`
  });
  try {
    const document = await task.promise;
    return document;
  } catch (error) {
    await task.destroy();
    if (error.name === 'PasswordException') throw new Error('PDF jest zabezpieczony hasłem. Użyj odblokowanej kopii.');
    throw new Error(`Nie można otworzyć PDF: ${error.message}`);
  }
}

/** Preserve the PDF text item order and line breaks; columns may need manual correction. */
export function textFromItems(items) {
  let text = '';
  let lastY = null;
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform?.[5];
    if (lastY !== null && Number.isFinite(y) && Math.abs(y - lastY) > 3 && !text.endsWith('\n')) text += '\n';
    text += item.str + (item.hasEOL ? '\n' : ' ');
    if (Number.isFinite(y)) lastY = y;
  }
  return text.replace(/[ \t]+\n/g, '\n').trim();
}

/** Only selected pages are passed to getPage/getTextContent. No document-wide text scan. */
export async function extractSelectedPages(document, range, onProgress = () => {}) {
  const pages = parsePageRanges(range, document.numPages);
  const results = [];
  for (const [index, number] of pages.entries()) {
    const page = await document.getPage(number);
    try {
      const content = await page.getTextContent();
      results.push({ number, text: textFromItems(content.items) });
      onProgress(index + 1, pages.length);
    } finally {
      page.cleanup();
    }
  }
  return results;
}
