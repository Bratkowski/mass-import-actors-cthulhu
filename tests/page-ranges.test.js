import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePageRanges } from '../scripts/page-ranges.js';
import { extractSelectedPages, textFromItems } from '../scripts/pdf.js';

test('zakresy obejmują końce, usuwają duplikaty i sortują strony', () => {
  assert.deepEqual(parsePageRanges('12, 3, 7–9, 8, 3', 20), [3, 7, 8, 9, 12]);
});

test('puste i niepoprawne zakresy nigdy nie wybierają całego PDF', () => {
  for (const range of ['', ' ', '0', '-1', '3-2', '21', '1-21', 'all', '1,', '1.5', '1,,2', '1e2', '1-999999999999999999999']) {
    assert.throws(() => parsePageRanges(range, 20), range);
  }
});

test('odczytywane są tylko wskazane strony i zachowana jest ich kolejność', async () => {
  const requested = [], cleaned = [], progress = [];
  const pdf = {
    numPages: 10,
    async getPage(number) {
      requested.push(number);
      return {
        async getTextContent() { return { items: [{ str: `strona ${number}`, hasEOL: true }] }; },
        cleanup() { cleaned.push(number); }
      };
    }
  };
  const result = await extractSelectedPages(pdf, '7, 2-3', (a, b) => progress.push([a, b]));
  assert.deepEqual(requested, [2, 3, 7]);
  assert.deepEqual(cleaned, requested);
  assert.deepEqual(result.map(r => r.number), requested);
  assert.deepEqual(progress.at(-1), [3, 3]);
  await assert.rejects(extractSelectedPages(pdf, ''), /Wybierz strony/);
  assert.equal(requested.length, 3);
});

test('błąd odczytu zwalnia stronę i nie uruchamia następnych', async () => {
  let cleaned = false;
  await assert.rejects(extractSelectedPages({ numPages: 2, async getPage(number) {
    assert.equal(number, 1);
    return { async getTextContent() { throw new Error('uszkodzony PDF'); }, cleanup() { cleaned = true; } };
  } }, '1-2'), /uszkodzony/);
  assert.equal(cleaned, true);
});

test('tekst uwzględnia podziały wierszy i puste strony', () => {
  assert.equal(textFromItems([{ str: 'Jan', hasEOL: true }, { str: 'STR 50' }]), 'Jan\nSTR 50');
  assert.equal(textFromItems([]), '');
});
