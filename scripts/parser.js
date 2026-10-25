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

/** First MVP: 7e PL/EN characteristics and attributes. Unsupported content stays in keeper notes. */
export function parseBlock(text, type = 'npc') {
  if (!['npc', 'creature'].includes(type)) throw new Error('Obsługiwane typy: npc i creature.');
  const normalized = String(text).normalize('NFKC').replace(/\u00a0/g, ' ').trim();
  const name = normalized.split(/\r?\n/)[0]?.replace(/^#+\s*/, '').trim();
  const errors = [];
  const warnings = [];
  if (!name || STAT.test(name)) errors.push('Pierwsza linia musi zawierać nazwę postaci, przed statystykami.');
  STAT.lastIndex = 0;
  const characteristics = {};
  const attribs = {};
  const seen = new Set();
  for (const match of normalized.matchAll(STAT)) {
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
  if (Object.keys(characteristics).length < 3) errors.push('Rozpoznano mniej niż 3 cechy. Popraw tekst lub skróty statystyk.');
  const missing = ['str', 'con', 'siz', 'dex', 'app', 'int', 'pow', 'edu'].filter(k => !(k in characteristics));
  if (missing.length) warnings.push(`Brak cech: ${missing.join(', ').toUpperCase()}.`);
  warnings.push('Umiejętności, broń, pancerz i zaklęcia pozostają w notatkach Strażnika; ta wersja nie tworzy z nich przedmiotów.');
  return {
    text: normalized, name: name || '(bez nazwy)', errors: [...new Set(errors)], warnings,
    actor: {
      name, type,
      system: {
        characteristics, attribs,
        description: { keeper: `<pre>${escapeHtml(normalized)}</pre>` }
      }
    }
  };
}

export function parseActors(text, type = 'npc') {
  const blocks = splitBlocks(text);
  if (!blocks.length) throw new Error('Wklej tekst postaci lub odczytaj wybrane strony PDF.');
  return blocks.map(block => parseBlock(block, type));
}
