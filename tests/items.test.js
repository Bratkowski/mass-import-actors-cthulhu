import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addWeaponDependencies, aliasKey, hasPendingItems, initializeMatches, loadItemCatalog, matchItem, prepareEmbeddedItems, requestForWorldItem, SKIP_ITEM } from '../scripts/item-matching.js';
import { itemFromDrop, parsePercent, resolveWorldItem } from '../scripts/world-items.js';

const candidate = (uuid, name, type = 'skill', cocid = '', lang = 'en') => ({ uuid, name, type, cocid, lang, source: 'Items' });
const document = (id, name, type, system, cocid = '') => ({ uuid: `Item.${id}`, type, name, system, toObject: () => ({ _id: id, folder: 'oldFolder', ownership: { default: 3 }, name, type, img: 'test.webp', system, flags: { CoC7: { cocidFlag: { id: cocid } } } }) });

test('słownik PL–EN, nazwy zaklęć oraz nierozstrzygnięte warianty broni', () => {
  const catalog = [candidate('Item.listen', 'Listen', 'skill', 'i.skill.listen'), candidate('Item.spell', 'Znak Starszych Bogów', 'spell', '', 'pl'), candidate('Item.knife1', 'Knife, Small', 'weapon'), candidate('Item.knife2', 'Knife, Large', 'weapon')];
  assert.equal(matchItem({ type: 'skill', name: 'Nasłuchiwanie' }, catalog).choice, 'Item.listen');
  assert.equal(matchItem({ type: 'spell', name: 'znak starszych bogow' }, catalog).choice, 'Item.spell');
  assert.equal(matchItem({ type: 'weapon', name: 'Nóż' }, catalog).choice, '');
});

test('stare aliasy aktorów i kompendiów nie wracają do dopasowań', () => {
  const request = { type: 'skill', name: 'Nasłuchiwanie' };
  const catalog = [candidate('Actor.a.Item.listen', 'Listen'), candidate('Compendium.test.skills.Item.listen', 'Listen')];
  assert.equal(matchItem(request, catalog).choice, '');
  assert.equal(matchItem(request, catalog, { [aliasKey(request)]: 'Actor.a.Item.listen' }).choice, '');
  assert.equal(matchItem(request, [candidate('Item.listen', 'Listen')], { [aliasKey(request)]: 'Item.listen' }).choice, 'Item.listen');
});

test('ogólny CoCID nie utożsamia różnych języków; równorzędne wyniki wymagają wyboru', () => {
  const catalog = [candidate('Item.fr', 'Język (Francuski)', 'skill', 'i.skill.language-any', 'pl'), candidate('Item.de', 'Language (German)', 'skill', 'i.skill.language-any')];
  assert.equal(matchItem({ type: 'skill', name: 'Język (Francuski)' }, catalog).choice, 'Item.fr');
  assert.equal(matchItem({ type: 'skill', name: 'Język (Francuski)' }, catalog.slice(1)).choice, '');
  assert.equal(matchItem({ type: 'skill', name: 'Listen' }, [candidate('Item.a', 'Listen'), candidate('Item.b', 'Listen')]).choice, '');
});

test('katalog korzysta tylko z Items, bez dotykania ekwipunku aktorów i kompendiów', async () => {
  const game = { items: [{ uuid: 'Item.a', name: 'Listen', type: 'skill' }, { uuid: 'Actor.a.Item.b', name: 'Embedded', type: 'skill' }] };
  Object.defineProperty(game, 'actors', { get() { assert.fail('Nie wolno czytać przedmiotów aktorów'); } });
  Object.defineProperty(game, 'packs', { get() { assert.fail('Nie wolno czytać kompendiów'); } });
  const { catalog } = await loadItemCatalog(game);
  assert.deepEqual(catalog.map(i => i.uuid), ['Item.a']);
});

test('drop przyjmuje Item świata i odrzuca inne źródło, typ lub usunięty przedmiot', () => {
  const item = document('s', 'Listen', 'skill', {});
  const game = { items: new Map([['s', item]]) };
  assert.equal(itemFromDrop({ type: 'Item', uuid: 'Item.s' }, game, 'skill'), item);
  assert.throws(() => itemFromDrop({ type: 'Item', uuid: 'Item.s' }, game, 'weapon'), /wymaga typu/);
  for (const uuid of ['Actor.a.Item.s', 'Compendium.test.skills.Item.s', 'Item.missing']) assert.throws(() => itemFromDrop({ type: 'Item', uuid }, game, 'skill'));
  assert.throws(() => itemFromDrop({ type: 'Actor', uuid: 'Actor.a' }, game, 'skill'));
  item.parent = {};
  assert.throws(() => resolveWorldItem(game, 'Item.s'));
});

test('kopie broni i zaklęcia zachowują mechanikę, nowa umiejętność ma procent z listy', async () => {
  const skill = document('skill', 'Firearms (Handgun)', 'skill', { base: '20', adjustments: { base: 20, experience: 50 } }, 'i.skill.firearms-handgun');
  const gun = document('gun', 'Revolver', 'weapon', { skill: { main: { id: 'oldSkill', name: 'i.skill.firearms-handgun' } }, range: { normal: { damage: '1D10' } } });
  const spell = document('spell', 'Znak Starszych Bogów', 'spell', { description: { value: '<p>Opis</p>' }, costs: { magicPoints: '5' } });
  const catalog = [candidate('Item.skill', skill.name, 'skill', 'i.skill.firearms-handgun'), candidate('Item.gun', gun.name, 'weapon'), candidate('Item.spell', spell.name, 'spell')];
  const docs = { 'Item.skill': skill, 'Item.gun': gun, 'Item.spell': spell };
  const resolveUuid = async id => docs[id];
  const entry = { requests: initializeMatches([{ key: '0', type: 'weapon', name: 'Revolver', value: 55 }, { key: '1', type: 'spell', name: spell.name }], catalog) };
  await addWeaponDependencies(entry, catalog, {}, resolveUuid);
  assert.equal(hasPendingItems(entry), false);
  let counter = 0;
  const items = await prepareEmbeddedItems(entry, { resolveUuid, randomID: () => `new${++counter}` });
  const newSkill = items.find(i => i.type === 'skill'), newGun = items.find(i => i.type === 'weapon');
  assert.equal(newSkill.system.adjustments.base, 55);
  assert.equal(newSkill.system.adjustments.experience, 0);
  assert.equal(newGun.system.skill.main.id, newSkill._id);
  assert.equal(newGun.system.range.normal.damage, '1D10');
  assert.equal(items.find(i => i.type === 'spell').system.costs.magicPoints, '5');
  assert.equal(skill.system.adjustments.experience, 50);
  assert.equal(gun.system.skill.main.id, 'oldSkill');
  assert.equal(newGun.folder, undefined);
});

test('brak procentu i pominięcie wymaganej umiejętności blokują zapis', async () => {
  assert.equal(hasPendingItems({ requests: [{ key: 's', type: 'skill', name: 'Listen', choice: 'Item.s' }] }), true);
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Revolver', choice: 'Item.gun', links: { main: 's' } }, { key: 's', type: 'skill', name: 'Handgun', choice: SKIP_ITEM }] };
  assert.equal(hasPendingItems(entry), true);
  await assert.rejects(prepareEmbeddedItems(entry, {}), /Rozstrzygnij/);
});

test('wybór i uzupełniony procent zależności przetrwają odświeżenie', async () => {
  const gun = document('gun', 'Test', 'weapon', { skill: { main: { name: 'Custom' } } });
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Test', choice: 'Item.gun' }] };
  await addWeaponDependencies(entry, [], {}, async () => gun);
  entry.requests[1].choice = 'Item.custom'; entry.requests[1].value = 45;
  await addWeaponDependencies(entry, [], {}, async () => gun);
  assert.equal(entry.requests[1].choice, 'Item.custom');
  assert.equal(entry.requests[1].value, 45);
});

test('zniknięcie broni pozostawia wiersz do poprawienia, a źródła aktorów nie są rozwiązywane', async () => {
  const entry = { requests: [{ key: '0', type: 'weapon', name: 'Revolver', choice: 'Item.deleted' }] };
  await addWeaponDependencies(entry, [], {}, async () => null);
  assert.equal(entry.requests[0].choice, '');
  const other = { requests: [{ key: '0', type: 'weapon', name: 'X', choice: 'Actor.a.Item.weapon' }] };
  await addWeaponDependencies(other, [], {}, () => assert.fail('Nie rozwiązuj ekwipunku aktora'));
  assert.equal(other.requests[0].choice, '');
});

test('sprzeczne wartości tej samej umiejętności nie są nadpisywane', async () => {
  const skill = document('s', 'Listen', 'skill', {}, 'i.skill.listen');
  const entry = { requests: [{ key: 'a', type: 'skill', name: 'Listen', value: 50, choice: 'Item.s' }, { key: 'b', type: 'skill', name: 'Listen', value: 75, choice: 'Item.s' }] };
  await assert.rejects(prepareEmbeddedItems(entry, { resolveUuid: async () => skill, randomID: () => 'new' }), /Sprzeczne/);
});

test('procenty obsługują zero i liczby ponad 100, bez zgadywania formuł', () => {
  for (const [input, expected] of [[0, 0], [120, 120], ['60%', 60], [' 45 ', 45]]) assert.equal(parsePercent(input), expected);
  for (const input of ['', null, true, -5, 'DEX/2', '60abc', Infinity]) assert.equal(parsePercent(input), undefined);
});

test('drop na aktora wykorzystuje procent z listy albo dodaje nową pozycję bez procentu wzorca', () => {
  const source = document('listen', 'Listen', 'skill', { adjustments: { base: 99 } }, 'i.skill.listen');
  const catalog = [candidate(source.uuid, source.name, 'skill', 'i.skill.listen')];
  const entry = { requests: [{ key: '0', name: 'Nasłuchiwanie', type: 'skill', value: 60 }] };
  assert.equal(requestForWorldItem(entry, source, catalog).value, 60);
  assert.equal(entry.requests.length, 1);
  const empty = { requests: [] };
  const added = requestForWorldItem(empty, source, catalog);
  assert.equal(added.value, undefined);
  assert.equal(empty.requests.length, 1);
  assert.equal(requestForWorldItem(empty, source, catalog), added);
});
