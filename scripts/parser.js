import { requireActorType } from './actor-types.js';
import { extractItemReferences } from './item-references.js';

const CHARACTERISTICS = {
  STR: 'str', SIŁ: 'str', SIL: 'str', S: 'str', CON: 'con', KON: 'con',
  SIZ: 'siz', BC: 'siz', DEX: 'dex', ZR: 'dex', APP: 'app', WYG: 'app',
  INT: 'int', POW: 'pow', MOC: 'pow', EDU: 'edu', WYK: 'edu'
};
const ATTRIBUTES = { HP: 'hp', PW: 'hp', MP: 'mp', PM: 'mp', SAN: 'san', POC: 'san', P: 'san', MOV: 'mov', RUCH: 'mov', LUCK: 'lck', SZCZ: 'lck', SZCZĘŚCIE: 'lck' };
const LABELS = [...Object.keys(CHARACTERISTICS), ...Object.keys(ATTRIBUTES)].join('|');
const STAT = new RegExp(`(?<![\\p{L}\\d])(${LABELS})\\s*[:=]?\\s*(\\d+)(?![\\d.])`, 'giu');

export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Explicit separators avoid mistaking a page boundary or description for a new actor. */
export function splitBlocks(text) {
  return String(text).replace(/\r\n?/g, '\n').split(/^\s*-{3,}\s*$/m).map(t => t.trim()).filter(Boolean);
}

/** Parse 7e values; items are resolved separately against the user's existing catalog. */
export function parseBlock(text, type = 'npc') {
  requireActorType(type);
  const normalized = String(text).normalize('NFKC').replace(/\u00a0/g, ' ').trim();
  const references = extractItemReferences(normalized);
  const name = normalized.split(/\r?\n/)[0]?.replace(/^#+\s*/, '').trim();
  const errors = [];
  const warnings = [...references.warnings];
  if (!name || STAT.test(name)) errors.push('Pierwsza linia musi zawierać nazwę postaci, przed statystykami.');
  STAT.lastIndex = 0;
  const characteristics = {};
  const attribs = {};
  const seen = new Set();
  for (const match of references.statText.matchAll(STAT)) {
    const label = match[1].toUpperCase();
    const key = CHARACTERISTICS[label] ?? ATTRIBUTES[label];
    const value = Number(match[2]);
    if (seen.has(key)) errors.push(`Powtórzona statystyka ${label}. Sprawdź podział postaci separatorem ---.`);
    seen.add(key);
    if (CHARACTERISTICS[label]) characteristics[key] = { value };
    else {
      attribs[key] = { value };
      if (['hp', 'mp'].includes(key)) Object.assign(attribs[key], { max: value, auto: false });
      if (['mov', 'san'].includes(key)) attribs[key].auto = false;
    }
  }
  if (type !== 'vehicle' && Object.keys(characteristics).length < 3) errors.push('Rozpoznano mniej niż 3 cechy. Popraw tekst lub skróty statystyk.');
  const missing = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'].filter(k => !(k in characteristics));
  if (type !== 'vehicle' && missing.length) warnings.push(`Brak cech: ${missing.join(', ').toUpperCase()}.`);
  let system = { characteristics, attribs, description: { keeper: `<pre>${escapeHtml(normalized)}</pre>` } };
  if (type === 'vehicle') {
    const stats = {};
    if (attribs.hp) stats.hp = attribs.hp.value;
    if (attribs.mov) stats.mov = attribs.mov.value;
    for (const [key, labels] of [['build', 'Krzepa|Build'], ['armor', 'Pancerz|Armor']]) {
      const match = references.statText.match(new RegExp(`(?:^|\\s)(?:${labels})\\s*:?\\s*(\\d+)`, 'iu'));
      if (match) stats[key] = key === 'build' ? { value: Number(match[1]), current: Number(match[1]) } : { value: Number(match[1]) };
    }
    if (!Object.keys(stats).length) errors.push('Pojazd wymaga co najmniej jednej statystyki: PW/HP, Ruch/MOV, Krzepa/Build lub Pancerz/Armor.');
    system = { stats, description: system.description };
  }
  return {
    text: normalized, name: name || '(bez nazwy)', errors: [...new Set(errors)], warnings, requests: references.requests,
    actor: {
      name, type,
      system
    }
  };
}

export function parseActors(text, type = 'npc') {
  const blocks = splitBlocks(text);
  if (!blocks.length) throw new Error('Wklej tekst postaci lub odczytaj wybrane strony PDF.');
  return blocks.map(block => parseBlock(block, type));
}
