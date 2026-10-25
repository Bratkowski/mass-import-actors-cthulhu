import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseActorList } from '../scripts/json-import.js';
import { addWeaponDependencies, hasPendingItems, initializeMatches, prepareEmbeddedItems } from '../scripts/item-matching.js';

const input = actor => JSON.stringify([actor]);

test('tablica, wrapper i pojedynczy eksport są akceptowane; typ wybiera modal', () => {
  for (const value of [[{ name: 'Jan' }], { actors: [{ name: 'Jan' }] }, { name: 'Jan' }]) {
    const [entry] = parseActorList(JSON.stringify(value), 'npc');
    assert.equal(entry.actor.name, 'Jan'); assert.equal(entry.actor.type, 'npc'); assert.deepEqual(entry.errors, []);
  }
  assert.throws(() => parseActorList(input({ name: 'Jan' })), /wybierz typ/);
  assert.ok(parseActorList(input({ name: 'Jan', type: 'character' }), 'npc')[0].errors.length);
});

test('nieprawidłowa struktura nie uruchamia zgadywania danych', () => {
  for (const data of ['', 'Jan STR 50', '[]', '{"actors":[]}', 'null']) assert.throws(() => parseActorList(data, 'npc'));
  assert.throws(() => parseActorList('[{"name":"Jan","system":{"__proto__":{}}}]', 'npc'), /Niedozwolone/);
  const [entry] = parseActorList(input({ name: 'Jan', skills: 'Listen' }), 'npc');
  assert.ok(entry.errors.some(e => e.includes('tablicą')));
  assert.ok(parseActorList('[null]', 'npc')[0].errors.length);
});

test('eksport zachowuje system i grafikę, nie kopiuje ID, ownership ani arkusza źródła', () => {
  const source = { name: 'Jan', type: 'npc', _id: 'oldActor', folder: 'oldFolder', ownership: { default: 3 }, img: 'portrait.webp', flags: { core: { sheetClass: 'old' } }, system: { characteristics: { pow: { value: 165 } }, attribs: { mp: { value: 200, max: 200, auto: false } }, description: { keeper: '<p>Notatka</p>' } }, items: [] };
  const [entry] = parseActorList(input(source), 'npc');
  assert.deepEqual(entry.actor.system, source.system);
  assert.equal(entry.actor.img, source.img);
  for (const key of ['_id', 'folder', 'ownership', 'flags']) assert.equal(entry.actor[key], undefined);
});

test('umiejętności z eksportu używają sumy adjustments, z obsługą starego value i base', () => {
  const [entry] = parseActorList(input({ name: 'Jan', items: [
    { _id: 'a', name: 'Listen', type: 'skill', system: { value: 99, adjustments: { base: 20, experience: 40 } } },
    { _id: 'b', name: 'Dodge', type: 'skill', system: { value: 35 } },
    { _id: 'c', name: 'Occult', type: 'skill', system: { base: '50' } },
    { _id: 'd', name: 'Unknown', type: 'skill', system: { base: '@dex/2' } }
  ] }), 'npc');
  assert.deepEqual(entry.requests.map(r => r.value), [60, 35, 50, undefined]);
});

test('relacja starego ID broni wybiera właściwą umiejętność, bez duplikowania zależności', async () => {
  const [entry] = parseActorList(input({ name: 'Jan', type: 'npc', system: {}, items: [
    { _id: 'oldSkill', name: 'Broń Palna (Krótka)', type: 'skill', system: { adjustments: { base: 20, experience: 35 } } },
    { _id: 'oldGun', name: 'Rewolwer', type: 'weapon', system: { skill: { main: { id: 'oldSkill', name: 'Bardzo stara nazwa' } } } }
  ] }), 'npc');
  const sourceSkill = { type: 'skill', toObject: () => ({ name: 'Firearms (Handgun)', type: 'skill', system: { adjustments: { base: 20, experience: 70 } }, flags: { CoC7: { cocidFlag: { id: 'i.skill.firearms-handgun' } } } }) };
  const sourceGun = { type: 'weapon', system: { skill: { main: { name: 'i.skill.firearms-handgun', id: 'oldTemplateId' } } }, toObject() { return { name: 'Revolver', type: 'weapon', system: this.system }; } };
  const catalog = [{ uuid: 'Item.s', type: 'skill', name: 'Firearms (Handgun)', cocid: 'i.skill.firearms-handgun' }, { uuid: 'Item.w', type: 'weapon', name: 'Revolver' }];
  entry.requests = initializeMatches(entry.requests, catalog, { 'weapon:rewolwer': 'Item.w' });
  const resolveUuid = async id => id === 'Item.s' ? sourceSkill : sourceGun;
  await addWeaponDependencies(entry, catalog, {}, resolveUuid);
  assert.equal(entry.requests.length, 2);
  assert.equal(entry.requests[1].links.main, entry.requests[0].key);
  assert.equal(hasPendingItems(entry), false);
  let counter = 0;
  const items = await prepareEmbeddedItems(entry, { resolveUuid, randomID: () => `new${++counter}` });
  assert.equal(items[0].system.adjustments.base, 55);
  assert.equal(items[1].system.skill.main.id, items[0]._id);
});

test('ten sam przeciągnięty wzorzec ma inne procenty u różnych aktorów', async () => {
  const entries = parseActorList(JSON.stringify([{ name: 'Jan', skills: [{ name: 'Nasłuchiwanie', value: 60 }] }, { name: 'Anna', skills: [{ name: 'Nasłuchiwanie', value: 80 }] }]), 'npc');
  const original = { name: 'Listen', type: 'skill', system: { base: '20', adjustments: { base: 20, experience: 75 } } };
  const source = { type: 'skill', toObject: () => original };
  const percentages = [];
  for (const entry of entries) {
    entry.requests[0].choice = 'Item.listen';
    const [item] = await prepareEmbeddedItems(entry, { resolveUuid: async () => source, randomID: () => 'fresh' });
    percentages.push(item.system.adjustments.base);
  }
  assert.deepEqual(percentages, [60, 80]);
  assert.equal(original.system.adjustments.experience, 75);
});

test('uproszczone pola mapują się na modele postaci i pojazdu; notatki są tekstem', () => {
  const [npc] = parseActorList(input({ name: 'Jan', characteristics: { str: 50 }, attribs: { hp: 11, mov: 8 }, notes: '<script>test</script>' }), 'npc');
  assert.deepEqual(npc.actor.system.characteristics.str, { value: 50 });
  assert.deepEqual(npc.actor.system.attribs.hp, { value: 11, max: 11, auto: false });
  assert.match(npc.actor.system.description.keeper, /&lt;script&gt;/);
  const [vehicle] = parseActorList(input({ name: 'Samochód', stats: { hp: 30, mov: 10 } }), 'vehicle');
  assert.deepEqual(vehicle.actor.system.stats, { hp: 30, mov: 10 });
});

test('nieobsługiwane przedmioty, efekty i błędne procenty są zgłaszane', () => {
  const [entry] = parseActorList(input({ name: 'Jan', skills: [{ name: 'Listen', value: -1 }], items: [{ name: 'Book', type: 'book' }], effects: [{ name: 'Effect' }] }), 'npc');
  assert.equal(entry.errors.length, 3);
});

test('pominięcie umiejętności wskazanej przez eksport nie pozwala importować broni', async () => {
  const [entry] = parseActorList(input({ name: 'Jan', skills: [{ name: 'Firearms', value: 50 }], weapons: [{ name: 'Gun', skill: 'Firearms' }] }), 'npc');
  entry.requests[0].choice = '__skip__'; entry.requests[1].choice = 'Item.gun';
  const gun = { type: 'weapon', system: { skill: { main: { name: 'Firearms' } } } };
  await addWeaponDependencies(entry, [], {}, async () => gun);
  assert.equal(hasPendingItems(entry), true);
});
