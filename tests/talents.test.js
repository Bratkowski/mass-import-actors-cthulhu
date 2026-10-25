import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseActorList } from '../scripts/json-import.js';
import { hasPendingItems, initializeMatches, loadItemCatalog, prepareEmbeddedItems, requestForWorldItem } from '../scripts/item-matching.js';
import { itemFromDrop } from '../scripts/world-items.js';

test('talenty z listy uproszczonej i eksportu są rozpoznawane bez procentów', () => {
  const [entry] = parseActorList(JSON.stringify([{ name: 'BN', talents: ['Talenty fizyczne', { name: 'Talent umysłowy' }], items: [{ name: 'Talent bojowy', type: 'talent', flags: { CoC7: { cocidFlag: { id: 'i.talent.combat-example' } } } }] }]), 'npc');
  assert.deepEqual(entry.errors, []);
  assert.equal(entry.requests.length, 3);
  assert.ok(entry.requests.every(r => r.type === 'talent' && r.value === undefined));
  assert.equal(entry.requests[0].cocid, 'i.talent.combat-example');
  assert.ok(parseActorList('[{"name":"BN","talents":"talent"}]', 'npc')[0].errors.some(e => e.includes('talents')));
});

test('katalog, drop na wiersz i drop na aktora obsługują talent z Items', async () => {
  const item = { uuid: 'Item.t', name: 'Przykładowy talent', type: 'talent', system: {} };
  const { catalog } = await loadItemCatalog({ items: [item] });
  assert.equal(catalog.length, 1);
  const game = { items: new Map([['t', item]]) };
  assert.equal(itemFromDrop({ type: 'Item', uuid: item.uuid }, game, 'talent'), item);
  assert.throws(() => itemFromDrop({ type: 'Item', uuid: item.uuid }, game, 'skill'), /wymaga typu/);
  const entry = { requests: [] };
  const request = requestForWorldItem(entry, item, catalog);
  request.choice = item.uuid;
  assert.equal(hasPendingItems(entry), false);
});

test('talent dopasowuje się przez CoCID lub alias, oddzielnie od zaklęcia o tej samej nazwie', () => {
  const catalog = [{ uuid: 'Item.t', name: 'Example Talent', type: 'talent', cocid: 'i.talent.example' }, { uuid: 'Item.s', name: 'Polski talent', type: 'spell' }];
  const [request] = initializeMatches([{ type: 'talent', name: 'Polski talent', cocid: 'i.talent.example' }], catalog);
  assert.equal(request.choice, 'Item.t');
  const [saved] = initializeMatches([{ type: 'talent', name: 'Polski talent' }], catalog, { 'talent:polski talent': 'Item.t' });
  assert.equal(saved.choice, 'Item.t');
});

test('import talentu zachowuje dane mechaniki i efekty wzorca, bez zmieniania oryginału', async () => {
  const original = { _id: 'old', name: 'Przykładowy talent', type: 'talent', img: 'talent.webp', system: { description: { value: '<p>Opis talentu</p>' }, type: { physical: true }, adjustments: [{ type: 'disableCombatPool', config: { example: true } }] }, effects: [{ name: 'Efekt talentu', changes: [] }] };
  const entry = { requests: [{ key: '0', type: 'talent', name: original.name, choice: 'Item.t' }] };
  const [copy] = await prepareEmbeddedItems(entry, { resolveUuid: async () => ({ type: 'talent', toObject: () => original }), randomID: () => 'newTalentId' });
  assert.equal(copy._id, 'newTalentId');
  assert.deepEqual(copy.system, original.system);
  assert.deepEqual(copy.effects, original.effects);
  copy.system.adjustments[0].config.example = false;
  assert.equal(original.system.adjustments[0].config.example, true);
  assert.equal(original._id, 'old');
});
