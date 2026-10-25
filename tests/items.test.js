import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractItemReferences } from '../scripts/item-references.js';
import { addWeaponDependencies, aliasKey, hasPendingItems, initializeMatches, loadItemCatalog, matchItem, prepareEmbeddedItems, SKIP_ITEM } from '../scripts/item-matching.js';
import { parseBlock } from '../scripts/parser.js';

const candidate = (uuid, name, type = 'skill', cocid = '', origin = 'world', lang = 'en') => ({ uuid, name, type, cocid, origin, lang, source: 'Test' });
const document = (name, type, system, cocid = '') => ({ type, system, toObject: () => ({ _id: 'oldItem', folder: 'oldFolder', ownership: { default: 3 }, name, type, img: 'test.webp', system, flags: { CoC7: { cocidFlag: { id: cocid } } } }) });

test('sekcje PL: procenty umiejętności, ataki i polskie zaklęcia', () => {
  const result = extractItemReferences('Jan\nS 50 KON 60 BC 55\nAtaki w rundzie: 1\nUmiejętności: Spostrzegawczość 60% (30/12), Nauka (Biologia) 45%\nWalka\nRewolwer .38 55% (27/11), obrażenia 1K10\nUnik 30%\nZaklęcia: Znak Starszych Bogów; Ochrona ciała');
  assert.equal(result.requests.length, 6);
  assert.deepEqual(result.requests.slice(0, 2).map(r => [r.name, r.value]), [['Spostrzegawczość', 60], ['Nauka (Biologia)', 45]]);
  assert.equal(result.requests[2].type, 'weapon');
  assert.equal(result.requests[3].type, 'skill');
  assert.equal(result.requests[4].name, 'Znak Starszych Bogów');
  assert.ok(result.statText.includes('Ataki w rundzie: 1'));
  assert.equal(result.warnings.length, 0);
});

test('słownik PL–EN, nazwa PL zaklęcia oraz brak zgadywania wariantu broni', () => {
  const catalog = [candidate('Item.listen', 'Listen', 'skill', 'i.skill.listen'), candidate('Item.spell', 'Znak Starszych Bogów', 'spell', '', 'world', 'pl'), candidate('Item.knife1', 'Knife, Small', 'weapon'), candidate('Item.knife2', 'Knife, Large', 'weapon')];
  assert.equal(matchItem({ type: 'skill', name: 'Nasłuchiwanie' }, catalog).choice, 'Item.listen');
  assert.equal(matchItem({ type: 'spell', name: 'znak starszych bogow' }, catalog).choice, 'Item.spell');
  assert.equal(matchItem({ type: 'weapon', name: 'Nóż' }, catalog).choice, '');
});

test('zapisana para UUID jest nadrzędna, ale zniknięcie źródła wymaga ponownego wyboru', () => {
  const request = { type: 'weapon', name: 'Rewolwer .38' };
  const catalog = [candidate('Item.gun', '.38 or 9mm Revolver', 'weapon')];
  assert.equal(matchItem(request, catalog, { [aliasKey(request)]: 'Item.gun' }).choice, 'Item.gun');
  assert.equal(matchItem(request, catalog, { [aliasKey(request)]: 'Item.deleted' }).choice, '');
});

test('CoCID łączy języki, ale ogólny CoCID języka nie łączy francuskiego z niemieckim', () => {
  const catalog = [candidate('Actor.old.Item.pl', 'Nasłuchiwanie', 'skill', 'i.skill.listen', 'actor', 'pl'), candidate('Item.en', 'Listen', 'skill', 'i.skill.listen'), candidate('Item.fr', 'Język (Francuski)', 'skill', 'i.skill.language-any', 'world', 'pl'), candidate('Item.de', 'Language (German)', 'skill', 'i.skill.language-any')];
  assert.equal(matchItem({ type: 'skill', name: 'Nasłuchiwanie' }, catalog).choice, 'Item.en');
  assert.equal(matchItem({ type: 'skill', name: 'Język (Francuski)' }, catalog).choice, 'Item.fr');
  assert.equal(matchItem({ type: 'skill', name: 'Język (Francuski)' }, catalog.filter(i => i.uuid !== 'Item.fr')).choice, '');
});

test('równorzędne wyniki wymagają wyboru zamiast arbitralnego pierwszego elementu', () => {
  assert.equal(matchItem({ type: 'skill', name: 'Listen' }, [candidate('Item.a', 'Listen'), candidate('Item.b', 'Listen')]).choice, '');
});

test('katalog czyta indeks kompendium, zgłasza błąd źródła i obejmuje przedmioty aktorów', async () => {
  const { catalog, warnings } = await loadItemCatalog({
    items: [{ uuid: 'Item.a', name: 'Listen', type: 'skill' }],
    actors: [{ name: 'Test', items: [{ uuid: 'Actor.a.Item.b', name: 'Polski czar', type: 'spell' }] }],
    packs: [{ documentName: 'Item', metadata: { label: 'Test' }, async getIndex(options) {
      assert.ok(options.fields.includes('flags.CoC7.cocidFlag'));
      return [{ _id: 'c', name: 'Revolver', type: 'weapon' }];
    }, getUuid: id => `Compendium.test.items.Item.${id}` }, { documentName: 'Item', metadata: { label: 'Broken' }, async getIndex() { throw new Error('offline'); } }]
  });
  assert.equal(catalog.length, 3);
  assert.equal(warnings.length, 1);
});

test('broń wiąże nowe ID umiejętności, a wartości PDF nie zmieniają oryginału', async () => {
  const skill = document('Firearms (Handgun)', 'skill', { base: '20', adjustments: { base: 20, experience: 50 } }, 'i.skill.firearms-handgun');
  const gun = document('Revolver', 'weapon', { skill: { main: { id: 'oldSkill', name: 'i.skill.firearms-handgun' }, alternativ: { id: '', name: '' } }, range: { normal: { damage: '1D10' } } });
  const spell = document('Znak Starszych Bogów', 'spell', { description: { value: '<p>Opis</p>' }, costs: { magicPoints: '5' } });
  const catalog = [candidate('Item.skill', 'Firearms (Handgun)', 'skill', 'i.skill.firearms-handgun'), candidate('Item.gun', 'Revolver', 'weapon'), candidate('Item.spell', 'Znak Starszych Bogów', 'spell')];
  const docs = { 'Item.skill': skill, 'Item.gun': gun, 'Item.spell': spell };
  const resolveUuid = async id => docs[id];
  const entry = { requests: initializeMatches([{ key: '0', type: 'weapon', name: 'Revolver', value: 55 }, { key: '1', type: 'spell', name: 'Znak Starszych Bogów' }], catalog) };
  await addWeaponDependencies(entry, catalog, {}, resolveUuid);
  assert.equal(hasPendingItems(entry), false);
  let counter = 0;
  const items = await prepareEmbeddedItems(entry, { resolveUuid, randomID: () => `new${++counter}` });
  const newSkill = items.find(i => i.type === 'skill'), newGun = items.find(i => i.type === 'weapon');
  assert.equal(newSkill.system.adjustments.base, 55);
  assert.equal(newSkill.system.adjustments.experience, 0);
  assert.equal(newGun.system.skill.main.id, newSkill._id);
  assert.notEqual(newSkill._id, 'oldSkill');
  assert.equal(newGun.system.range.normal.damage, '1D10');
  assert.equal(skill.system.adjustments.experience, 50);
  assert.equal(gun.system.skill.main.id, 'oldSkill');
  assert.equal(items.find(i => i.type === 'spell').system.costs.magicPoints, '5');
  assert.equal(newGun.folder, undefined);
});

test('manualne dopasowanie zależności bez zapamiętania przetrwa odświeżenie', async () => {
  const gun = document('Test', 'weapon', { skill: { main: { name: 'Nieznana umiejętność' } } });
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Test', choice: 'Item.gun' }] };
  await addWeaponDependencies(entry, [], {}, async () => gun);
  entry.requests[1].choice = 'Item.custom';
  await addWeaponDependencies(entry, [], {}, async () => gun);
  assert.equal(entry.requests[1].choice, 'Item.custom');
});

test('nierozstrzygnięte i pominięte wymagane umiejętności blokują import broni', async () => {
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Revolver', choice: 'Item.gun' }, { key: 'dep', type: 'skill', name: 'Handgun', requiredBy: '0', choice: SKIP_ITEM }] };
  assert.equal(hasPendingItems(entry), true);
  await assert.rejects(prepareEmbeddedItems(entry, {}), /Rozstrzygnij/);
});

test('zniknięcie broni między indeksem a podglądem pozostawia wiersz do poprawienia', async () => {
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Revolver', choice: 'Item.deleted' }] };
  await addWeaponDependencies(entry, [], {}, async () => null);
  assert.equal(entry.requests[0].choice, '');
  assert.equal(hasPendingItems(entry), true);
});

test('przecinek wewnątrz nazwy zaklęcia w cudzysłowie nie dzieli przedmiotu', () => {
  const { requests } = extractItemReferences('Jan\nZaklęcia: "Znak, wariant"; Ochrona ciała');
  assert.deepEqual(requests.map(r => r.name), ['Znak, wariant', 'Ochrona ciała']);
});

test('sprzeczne wartości tej samej umiejętności nie nadpisują się po cichu', async () => {
  const skill = document('Listen', 'skill', {}, 'i.skill.listen');
  const entry = { requests: [{ key: 'a', type: 'skill', name: 'Listen', value: 50, choice: 'Item.s' }, { key: 'b', type: 'skill', name: 'Listen', value: 75, choice: 'Item.s' }] };
  await assert.rejects(prepareEmbeddedItems(entry, { resolveUuid: async () => skill, randomID: () => 'new' }), /Sprzeczne/);
});

test('postacie graczy i pojazdy używają odpowiednich pól modeli CoC7', () => {
  assert.equal(parseBlock('Badacz\nS 50 KON 60 BC 55', 'character').actor.type, 'character');
  const vehicle = parseBlock('Samochód\nPW 30 Ruch 10 Krzepa 2 Pancerz 3', 'vehicle');
  assert.deepEqual(vehicle.errors, []);
  assert.deepEqual(vehicle.actor.system.stats, { hp: 30, mov: 10, build: { value: 2, current: 2 }, armor: { value: 3 } });
  assert.equal(vehicle.actor.system.characteristics, undefined);
  assert.ok(parseBlock('Pusty pojazd', 'vehicle').errors.length);
});
