export const SKIP_ITEM = '__skip__';
export const ITEM_LABELS = { skill: 'Umiejętność', weapon: 'Broń', spell: 'Zaklęcie' };

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
export function stableCoCID(id) { return !!id && !/-(any|own)$/.test(id); }

export function matchItem(request, catalog, aliases = {}) {
  const items = catalog.filter(item => item.type === request.type);
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
    const score = (item.origin === 'world' ? 30 : item.origin === 'pack' ? 20 : 0)
      + (item.lang === preferredLanguage ? 4 : 0) + (exact ? 2 : 0);
    return { item, score };
  }).filter(Boolean).sort((a, b) => b.score - a.score);
  if (!candidates.length) return { choice: '', reason: 'Brak pewnego dopasowania — wybierz ręcznie' };
  if (candidates[1]?.score === candidates[0].score) return { choice: '', reason: 'Kilka równorzędnych dopasowań — wybierz ręcznie' };
  return { choice: candidates[0].item.uuid, reason: 'Zgodna nazwa, słownik PL–EN lub CoCID' };
}

export async function loadItemCatalog(game) {
  const catalog = [], warnings = [];
  const add = (item, origin, source, uuid) => {
    if (!ITEM_LABELS[item.type]) return;
    const flag = item.flags?.CoC7?.cocidFlag ?? {};
    catalog.push({ uuid, name: item.name, type: item.type, cocid: flag.id ?? '', lang: flag.lang ?? '', origin, source });
  };
  for (const item of game.items ?? []) add(item, 'world', 'Przedmioty świata', item.uuid);
  for (const actor of game.actors ?? []) for (const item of actor.items ?? []) add(item, 'actor', `Aktor: ${actor.name}`, item.uuid);
  for (const pack of game.packs ?? []) {
    if (pack.documentName !== 'Item' || pack.visible === false) continue;
    try {
      const index = await pack.getIndex({ fields: ['type', 'flags.CoC7.cocidFlag'] });
      for (const item of index) add(item, 'pack', pack.metadata.label, pack.getUuid(item._id));
    } catch (error) { warnings.push(`Nie odczytano kompendium ${pack.metadata.label}: ${error.message}`); }
  }
  return { catalog: [...new Map(catalog.filter(i => i.uuid).map(i => [i.uuid, i])).values()], warnings };
}

export function initializeMatches(requests, catalog, aliases) {
  return requests.map(request => ({ ...request, ...matchItem(request, catalog, aliases) }));
}

/** Expand the ready weapon's actual skill references, so even dependencies are reviewable. */
export async function addWeaponDependencies(entry, catalog, aliases, resolveUuid) {
  const previous = new Map(entry.requests.filter(r => r.requiredBy).map(r => [r.key, r]));
  entry.requests = entry.requests.filter(r => !r.requiredBy);
  for (const weapon of entry.requests.filter(r => r.type === 'weapon')) {
    weapon.links = {};
    weapon.sourceSkills = {};
    if (!weapon.choice || weapon.choice === SKIP_ITEM) continue;
    let document;
    try { document = await resolveUuid(weapon.choice); } catch { /* A stale index must remain reviewable. */ }
    if (!document || document.type !== 'weapon') {
      weapon.choice = ''; weapon.reason = 'Wybrana broń nie jest dostępna — wskaż inny wzorzec.';
      continue;
    }
    for (const slot of ['main', 'alternativ']) {
      const reference = document.system.skill?.[slot];
      weapon.sourceSkills[slot] = { id: reference?.id ?? '', name: reference?.name ?? '' };
      if (!reference?.name && !reference?.id) continue;
      // Embedded weapons sometimes only carry the old actor-local skill ID.
      const sourceSkill = reference.id ? document.parent?.items?.get(reference.id) : null;
      const name = reference.name || sourceSkill?.name;
      if (!name) {
        weapon.choice = ''; weapon.reason = `Broń ma nieczytelne powiązanie umiejętności (${slot}) — wskaż inny wzorzec.`;
        break;
      }
      const request = {
        key: `weapon:${weapon.key}:${slot}`, type: 'skill', name, requiredBy: weapon.key,
        sourceWeapon: weapon.choice,
        cocid: name.startsWith('i.skill.') ? name : sourceSkill?.flags?.CoC7?.cocidFlag?.id,
        value: slot === 'main' ? weapon.value : undefined
      };
      weapon.links[slot] = request.key;
      const prior = previous.get(request.key);
      const decision = prior?.sourceWeapon === weapon.choice && prior.name === name && prior.choice
        ? { choice: prior.choice, reason: prior.reason } : matchItem(request, catalog, aliases);
      entry.requests.push({ ...request, ...decision });
    }
  }
}

export function hasPendingItems(entry) {
  return (entry.requests ?? []).some(request => !request.choice ||
    (request.requiredBy && request.choice === SKIP_ITEM && entry.requests.find(r => r.key === request.requiredBy)?.choice !== SKIP_ITEM));
}

function copyItem(document, randomID) {
  const item = structuredClone(document.toObject());
  for (const key of ['_id', 'folder', 'sort', 'ownership', '_stats']) delete item[key];
  item._id = randomID();
  return item;
}

function setSkillValue(item, value) {
  if (value === undefined) return;
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
          throw new Error(`Sprzeczne wartości umiejętności ${item.name}: ${existing.value}% i ${request.value}%. Popraw tekst lub dopasowanie.`);
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
      weapon.system.skill[slot] = { id: skill._id, name: skill.flags?.CoC7?.cocidFlag?.id || skill.name };
    }
  }
  return items;
}
