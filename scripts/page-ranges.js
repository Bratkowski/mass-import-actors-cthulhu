/** Physical, one-based PDF page numbers. An empty selection never means all pages. */
export function parsePageRanges(input, pageCount) {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error('Nieprawidłowa liczba stron PDF.');
  const normalized = String(input ?? '').trim().replace(/[–—]/g, '-');
  if (!normalized) throw new Error('Wybierz strony PDF, np. 3, 7-9, 12.');
  const pages = new Set();
  for (const part of normalized.split(',')) {
    const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
    if (!match) throw new Error(`Nieprawidłowy zakres: „${part.trim()}”. Użyj np. 3, 7-9, 12.`);
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end > pageCount || start > end) {
      throw new Error(`Zakres „${part.trim()}” musi mieścić się w 1-${pageCount}, od mniejszej do większej strony.`);
    }
    for (let page = start; page <= end; page++) pages.add(page);
  }
  return [...pages].sort((a, b) => a - b);
}
