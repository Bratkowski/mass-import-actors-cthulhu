import { requireActorType } from './actor-types.js';
import { ITEM_LABELS, parsePercent } from './world-items.js';
import { normalizeName, stableCoCID } from './item-matching.js';
import { escapeHtml } from './html.js';

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function assertSafeData(value) {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw new Error(`Niedozwolone pole JSON: ${key}.`);
    assertSafeData(child);
  }
}

function exportedSkillValue(item) {
  if (item.value !== undefined) return parsePercent(item.value);
  const system = item.system ?? {};
  if (object(system.adjustments) && Object.keys(system.adjustments).length) {
    const values = Object.values(system.adjustments).map(v => v === '' || v === null ? 0 : Number(v));
    if (values.every(Number.isFinite)) return parsePercent(values.reduce((a, b) => a + b, 0));
    return undefined;
  }
  if (system.value !== undefined && system.value !== null && system.value !== -1) return parsePercent(system.value);
  return parsePercent(system.base);
}

function compactSystem(source, type) {
  const system = {};
  if (type === 'vehicle') {
    if (object(source.stats)) system.stats = structuredClone(source.stats);
  } else {
    if (object(source.characteristics)) {
      system.characteristics = Object.fromEntries(Object.entries(source.characteristics).map(([key, value]) => [key, object(value) ? structuredClone(value) : { value }]));
    }
    if (object(source.attribs)) {
      system.attribs = Object.fromEntries(Object.entries(source.attribs).map(([key, value]) => [key, object(value) ? structuredClone(value) : { value }]));
      for (const key of ['hp', 'mp']) if (system.attribs[key]?.value !== undefined && !object(source.attribs[key])) {
        Object.assign(system.attribs[key], { max: system.attribs[key].value, auto: false });
      }
      for (const key of ['mov', 'san']) if (system.attribs[key] && !object(source.attribs[key])) system.attribs[key].auto = false;
    }
  }
  if (source.notes !== undefined) system.description = { keeper: `<p>${escapeHtml(source.notes).replace(/\n/g, '<br>')}</p>` };
  return system;
}

function normalizeActor(source, type, index) {
  const errors = [], warnings = [];
  if (!object(source)) return { name: `Wiersz ${index + 1}`, actor: { type, system: {} }, requests: [], errors: ['Aktor musi być obiektem JSON.'], warnings };
  const name = typeof source.name === 'string' ? source.name.trim() : '';
  if (!name) errors.push('Podaj niepustą nazwę aktora w polu name.');
  if (source.type && source.type !== type) errors.push(`Typ ${source.type} nie odpowiada wybranemu typowi ${type}. Importuj te typy w osobnych partiach.`);
  if (source.system !== undefined && !object(source.system)) errors.push('Pole system musi być obiektem.');
  const actor = { name, type, system: object(source.system) ? structuredClone(source.system) : compactSystem(source, type) };
  if (typeof source.img === 'string') actor.img = source.img;
  const requests = [];
  const add = (item, itemType, sourceIndex) => {
    if (typeof item === 'string') item = { name: item };
    if (!object(item) || typeof item.name !== 'string' || !item.name.trim()) { errors.push(`Nieprawidłowa nazwa przedmiotu ${itemType} (${sourceIndex + 1}).`); return; }
    if (!ITEM_LABELS[itemType]) { errors.push(`Nieobsługiwany typ przedmiotu: ${itemType}. Obsługiwane: skill, weapon, spell.`); return; }
    const value = itemType === 'skill' ? exportedSkillValue(item) : item.value === undefined ? undefined : parsePercent(item.value);
    if (item.value !== undefined && value === undefined) errors.push(`Nieprawidłowy procent dla „${item.name}”. Podaj liczbę nieujemną.`);
    requests.push({ key: String(requests.length), type: itemType, name: item.name.trim(), value,
      sourceId: item._id, cocid: item.cocid ?? item.flags?.CoC7?.cocidFlag?.id,
      originalSkill: item.system?.skill ? structuredClone(item.system.skill) : undefined,
      skillName: item.skill, sourceLinks: {} });
  };
  for (const field of ['items', 'skills', 'weapons', 'spells']) if (source[field] !== undefined && !Array.isArray(source[field])) errors.push(`Pole ${field} musi być tablicą.`);
  for (const [i, item] of (Array.isArray(source.items) ? source.items : []).entries()) add(item, item?.type, i);
  for (const [field, itemType] of [['skills', 'skill'], ['weapons', 'weapon'], ['spells', 'spell']]) {
    for (const [i, item] of (Array.isArray(source[field]) ? source[field] : []).entries()) add(item, itemType, i);
  }
  const sourceIds = requests.map(r => r.sourceId).filter(Boolean);
  if (new Set(sourceIds).size !== sourceIds.length) errors.push('Powtórzone ID przedmiotów w JSON aktora.');
  for (const weapon of requests.filter(r => r.type === 'weapon')) {
    for (const slot of ['main', 'alternativ']) {
      const reference = weapon.originalSkill?.[slot];
      const id = reference?.id;
      const wanted = reference?.name || (slot === 'main' ? weapon.skillName : undefined);
      let candidates = requests.filter(r => r.type === 'skill' && id && r.sourceId === id);
      if (!candidates.length && wanted) candidates = requests.filter(r => r.type === 'skill' &&
        ((stableCoCID(wanted) && r.cocid === wanted) || normalizeName(r.name) === normalizeName(wanted)));
      if (candidates.length === 1) {
        weapon.sourceLinks[slot] = candidates[0].key;
      }
    }
  }
  if (source.effects?.length) errors.push('Eksport zawiera efekty aktora. Ta wersja nie przenosi efektów; usuń je z listy dopiero po sprawdzeniu ich wpływu na statystyki.');
  return { name: name || `Wiersz ${index + 1}`, actor, requests, errors, warnings };
}

/** A batch can be an array, {actors: [...]}, or one unmodified Foundry Actor export. */
export function parseActorList(input, type) {
  requireActorType(type);
  let data;
  try { data = JSON.parse(String(input).replace(/^\uFEFF/, '')); }
  catch { throw new Error('Nieprawidłowy JSON. Wklej tablicę aktorów albo wczytaj plik .json.'); }
  assertSafeData(data);
  const actors = Array.isArray(data) ? data : object(data) && Array.isArray(data.actors) ? data.actors : object(data) && typeof data.name === 'string' ? [data] : null;
  if (!actors?.length) throw new Error('Lista musi zawierać co najmniej jednego aktora: [...] lub {"actors":[...]}.');
  return actors.map((source, index) => normalizeActor(source, type, index));
}
