export const SKIP_ITEM = '__skip__';
import { isWorldItemUuid, ITEM_LABELS, parsePercent } from './world-items.js';
export { ITEM_LABELS } from './world-items.js';

export function normalizeName(value) {
  return String(value ?? '').normalize('NFKD').replace(/\p{M}/gu, '').replace(/ł/g, 'l').replace(/Ł/g, 'L')
    .toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();
}

// Exact aliases only. Calibres, specializations and distinct weapon models stay distinct.
const SKILL_NAMES = [
  ['Spostrzegawczość', 'Spot Hidden', 'spot-hidden'], ['Nasłuchiwanie', 'Listen', 'listen'],
  ['Korzystanie z Bibliotek', 'Library Use', 'library-use'], ['Unik', 'Dodge', 'dodge'],
  ['Archeologia', 'Archaeology', 'archaeology'], ['Historia', 'History', 'history'],
  ['Księgowość', 'Accounting', 'accounting'], ['Majętność', 'Credit Rating', 'credit-rating'],
  ['Mity Cthulhu', 'Cthulhu Mythos', 'cthulhu-mythos'], ['Okultyzm', 'Occult', 'occult'],
  ['Perswazja', 'Persuade', 'persuade'], ['Przekonywanie', 'Persuade', 'persuade'],
  ['Prawo', 'Law', 'law'], ['Psychologia', 'Psychology', 'psychology'],
  ['Ukrywanie', 'Stealth', 'stealth'], ['Zastraszanie', 'Intimidate', 'intimidate'],
  ['Pierwsza Pomoc', 'First Aid', 'first-aid'], ['Medycyna', 'Medicine', 'medicine'],
  ['Walka Wręcz (Bijatyka)', 'Fighting (Brawl)', 'fighting-brawl'],
  ['Walka (Bijatyka)', 'Fighting (Brawl)', 'fighting-brawl'],
  ['Broń Palna (Krótka)', 'Firearms (Handgun)', 'firearms-handgun']
];

export function aliasKey(request) { return `${request.type}:${normalizeName(request.name)}`; }
// Generic CoCIDs can identify different languages/specializations; never merge those by ID alone.
export function stableCoCID(id) { return typeof id === 'string' && /^i\.(skill|weapon|spell)\./.test(id) && !/-(any|own)$/.test(id); }

export function matchItem(request, catalog, aliases = {}) {
  const items = catalog.filter(item => item.type === request.type && isWorldItemUuid(item.uuid));
  const saved = aliases[aliasKey(request)];
  if (saved) {
    const found = items.find(item => item.uuid === saved);
    return { choice: found?.uuid ?? '', reason: found ? 'Zapamiętane dopasowanie' : 'Zapamiętany przedmiot nie jest już dostępny' };
  }
  const name = normalizeName(request.name);
  const translations = request.type === 'skill' ? SKILL_NAMES.filter(([pl, en]) => [pl, en].some(n => normalizeName(n) === name)) : [];
  const cocids = new Set([request.cocid, ...translations.map(([, , id]) => `i.skill.${id}`)].filter(stableCoCID));
  // A translated existing item can bridge names via its stable CoCID.
  for (const item of items) if (normalizeName(item.name) === name && stableCoCID(item.cocid)) cocids.add(item.cocid);
  const englishNames = translations.map(([, en]) => normalizeName(en));
  const candidates = items.map(item => {
    const exact = normalizeName(item.name) === name;
    const equivalent = cocids.has(item.cocid) || englishNames.includes(normalizeName(item.name));
    if (!exact && !equivalent) return null;
    const preferredLanguage = request.type === 'spell' ? 'pl' : 'en';
    const score = (item.lang === preferredLanguage ? 4 : 0) + (exact ? 2 : 0);
    return { item, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  if (!candidates.length) return { choice: '', reason: 'Brak pewnego dopasowania — wybierz ręcznie' };
  if (candidates[1]?.score === candidates[0].score) return { choice: '', reason: 'Kilka równorzędnych dopasowań — wybierz ręcznie' };
  return { choice: candidates[0].item.uuid, reason: 'Zgodna nazwa, słownik PL–EN lub CoCID' };
}

export async function loadItemCatalog(game) {
  const catalog = [];
  for (const item of game.items ?? []) {
    if (!ITEM_LABELS[item.type] || !isWorldItemUuid(item.uuid) || item.parent || item.actor || item.pack || item.compendium) continue;
    const flag = item.flags?.CoC7?.cocidFlag ?? {};
    catalog.push({ uuid: item.uuid, name: item.name, type: item.type, cocid: flag.id ?? '', lang: flag.lang ?? '', source: 'Items', origin: 'world' });
  }
  return { catalog, warnings: [] };
}

export function initializeMatches(requests, catalog, aliases) {
  return requests.map(request => ({ ...request, ...matchItem(request, catalog, aliases) }));
}

/** Actor-level drops reuse listed percentages, and never copy a template's skill value. */
export function requestForWorldItem(entry, item, catalog, aliases = {}) {
  if (!isWorldItemUuid(item.uuid) || !ITEM_LABELS[item.type]) throw new Error('Wybierz obsługiwany przedmiot z Items.');
  const cocid = item.flags?.CoC7?.cocidFlag?.id;
  const matches = entry.requests.filter(r => !r.requiredBy && r.type === item.type &&
    (r.choice === item.uuid || normalizeName(r.name) === normalizeName(item.name) ||
      (stableCoCID(cocid) && r.cocid === cocid) || matchItem(r, catalog, aliases).choice === item.uuid));
  if (matches.length > 1) throw new Error('Kilka pozycji listy pasuje do tego Item. Upuść go na konkretny wiersz.');
  if (matches.length === 1) return matches[0];
  let number = entry.requests.length;
  while (entry.requests.some(r => r.key === `manual:${number}`)) number++;
  const request = { key: `manual:${number}`, type: item.type, name: item.name, cocid, sourceLinks: {} };
  entry.requests.push(request);
  return request;
}

/** Expand the ready weapon's actual skill references, so even dependencies are reviewable. */
export async function addWeaponDependencies(entry, catalog, aliases, resolveUuid) {
  const previous = new Map(entry.requests.filter(r => r.requiredBy).map(r => [r.key, r]));
  entry.requests = entry.requests.filter(r => !r.requiredBy);
  for (const weapon of entry.requests.filter(r => r.type === 'weapon')) {
    weapon.links = {};
    weapon.sourceSkills = {};
    if (!weapon.choice || weapon.choice === SKIP_ITEM) continue;
    if (!isWorldItemUuid(weapon.choice)) { weapon.choice = ''; weapon.reason = 'Wybierz broń z katalogu Items.'; continue; }
    let document;
    try { document = await resolveUuid(weapon.choice); } catch { /* A stale index must remain reviewable. */ }
    if (!document || document.type !== 'weapon') {
      weapon.choice = ''; weapon.reason = 'Wybrana broń nie jest dostępna — wskaż inny wzorzec.';
      continue;
    }
    if (!document.system.skill?.main?.id && !document.system.skill?.main?.name && (weapon.value !== undefined || weapon.sourceLinks?.main)) {
      weapon.choice = ''; weapon.reason = 'Ten wzorzec broni nie wskazuje głównej umiejętności. Wybierz inny przedmiot w Items.';
      continue;
    }
    for (const slot of ['main', 'alternativ']) {
      const reference = document.system.skill?.[slot];
      weapon.sourceSkills[slot] = { id: reference?.id ?? '', name: reference?.name ?? '' };
      if (!reference?.name && !reference?.id) continue;
      const sourceLink = entry.requests.find(r => r.key === weapon.sourceLinks?.[slot] && r.type === 'skill');
      if (sourceLink) { weapon.links[slot] = sourceLink.key; continue; }
      const worldSkill = catalog.find(i => i.type === 'skill' && i.uuid === `Item.${reference.id}`);
      const name = reference.name || worldSkill?.name;
      if (!name) {
        weapon.choice = ''; weapon.reason = `Broń ma nieczytelne powiązanie umiejętności (${slot}) — wskaż inny wzorzec.`;
        break;
      }
      const request = {
        key: `weapon:${weapon.key}:${slot}`, type: 'skill', name, requiredBy: weapon.key,
        sourceWeapon: weapon.choice,
        cocid: name.startsWith('i.skill.') ? name : worldSkill?.cocid,
        value: slot === 'main' ? weapon.value : undefined
      };
      weapon.links[slot] = request.key;
      const prior = previous.get(request.key);
      if (prior?.sourceWeapon === weapon.choice && prior.name === name && request.value === undefined) request.value = prior.value;
      const decision = prior?.sourceWeapon === weapon.choice && prior.name === name && prior.choice
        ? { choice: prior.choice, reason: prior.reason } : matchItem(request, catalog, aliases);
      const explicitSkills = entry.requests.filter(r => r.type === 'skill' && !r.requiredBy &&
        ((decision.choice && r.choice === decision.choice) || (stableCoCID(request.cocid) && r.cocid === request.cocid) || normalizeName(r.name) === normalizeName(name)));
      if (explicitSkills.length === 1) { weapon.links[slot] = explicitSkills[0].key; continue; }
      entry.requests.push({ ...request, ...decision });
    }
  }
}

export function hasPendingItems(entry) {
  const requests = entry.requests ?? [];
  return requests.some(request => !request.choice ||
    (request.choice !== SKIP_ITEM && (!isWorldItemUuid(request.choice) || (request.type === 'skill' && parsePercent(request.value) === undefined))) ||
    (request.requiredBy && request.choice === SKIP_ITEM && requests.find(r => r.key === request.requiredBy)?.choice !== SKIP_ITEM) ||
    (request.type === 'weapon' && request.choice !== SKIP_ITEM && Object.values(request.links ?? {}).some(key => !requests.find(r => r.key === key && r.choice && r.choice !== SKIP_ITEM))));
}

function copyItem(document, randomID) {
  const item = structuredClone(document.toObject());
  for (const key of ['_id', 'folder', 'sort', 'ownership', '_stats']) delete item[key];
  item._id = randomID();
  return item;
}

function setSkillValue(item, value) {
  if (value === undefined) return;
  value = parsePercent(value);
  if (value === undefined) throw new Error(`Nieprawidłowy procent umiejętności ${item.name}.`);
  item.system.base = String(value);
  item.system.adjustments = { base: value, personal: 0, occupation: 0, archetype: 0, experiencePackage: 0, experience: 0 };
  delete item.system.value; // CoC7 8.16 derives the value from adjustments.
}

/** Prepare every embedded item before Actor.create, preserving links with fresh actor-local IDs. */
export async function prepareEmbeddedItems(entry, { resolveUuid, randomID }) {
  if (hasPendingItems(entry)) throw new Error('Rozstrzygnij dopasowania przedmiotów i umiejętności broni w podglądzie.');
  const items = [], byRequest = new Map(), skills = new Map();
  const requests = (entry.requests ?? []).filter(r => r.choice !== SKIP_ITEM);
  for (const request of [...requests.filter(r => r.type === 'skill'), ...requests.filter(r => r.type !== 'skill')]) {
    const document = await resolveUuid(request.choice);
    if (!document || document.type !== request.type) throw new Error(`Niedostępny lub nieprawidłowy przedmiot: ${request.name}.`);
    let item = copyItem(document, randomID);
    if (request.type === 'skill') {
      const cocid = item.flags?.CoC7?.cocidFlag?.id;
      const identity = stableCoCID(cocid) ? cocid : normalizeName(item.name);
      const existing = skills.get(identity);
      if (existing) {
        if (request.value !== undefined && existing.value !== undefined && request.value !== existing.value) {
          throw new Error(`Sprzeczne wartości umiejętności ${item.name}: ${existing.value}% i ${request.value}%. Popraw JSON lub dopasowanie.`);
        }
        if (request.value !== undefined) { setSkillValue(existing.item, request.value); existing.value = request.value; }
        byRequest.set(request.key, existing.item); continue;
      }
      setSkillValue(item, request.value);
      skills.set(identity, { item, value: request.value });
    }
    items.push(item); byRequest.set(request.key, item);
  }
  for (const request of requests.filter(r => r.type === 'weapon')) {
    const weapon = byRequest.get(request.key);
    for (const slot of ['main', 'alternativ']) {
      const reference = weapon.system.skill?.[slot];
      const expected = request.sourceSkills?.[slot];
      if (!expected || expected.id !== (reference?.id ?? '') || expected.name !== (reference?.name ?? '')) {
        throw new Error(`Powiązanie umiejętności wzorca broni „${request.name}” zmieniło się. Przygotuj podgląd ponownie.`);
      }
      if (!reference?.name && !reference?.id) continue;
      const skill = byRequest.get(request.links?.[slot]);
      if (!skill) throw new Error(`Wybierz umiejętność ${slot} dla broni „${request.name}”.`);
      if (slot === 'main' && request.value !== undefined && request.value !== skill.system.adjustments?.base) {
        throw new Error(`Broń „${request.name}” i powiązana umiejętność mają różne procenty. Popraw wartość w JSON albo w podglądzie.`);
      }
      weapon.system.skill[slot] = { id: skill._id, name: skill.flags?.CoC7?.cocidFlag?.id || skill.name };
    }
  }
  return items;
}
