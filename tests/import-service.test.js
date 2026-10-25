import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importEntries, checkEnvironment } from '../scripts/import-service.js';

const game = { user: { isGM: true }, system: { id: 'CoC7', version: '8.16' }, release: { generation: 14, build: 364 }, folders: [] };
const row = name => ({ actor: { name, type: 'npc' }, selected: true, errors: [], status: '' });

test('raport zawiera częściowy sukces, ponowienie pomija sukcesy i niezaznaczone wiersze', async () => {
  const entries = [row('Jan'), row('Alex'), { ...row('Pomijany'), selected: false }];
  let calls = [];
  await importEntries(entries, { game, ActorClass: { async create(data) {
    calls.push(data.name);
    if (data.name === 'Alex') throw new Error('Błąd serwera');
    return { id: 'actor1' };
  } } });
  assert.deepEqual(calls, ['Jan', 'Alex']);
  assert.equal(entries[0].createdId, 'actor1');
  assert.match(entries[1].status, /Błąd serwera/);
  calls = [];
  await importEntries(entries, { game, ActorClass: { async create(data) { calls.push(data.name); return { id: 'actor2' }; } } });
  assert.deepEqual(calls, ['Alex']);
});

test('uprawnienia, wersje i błędny folder blokują zapis', async () => {
  assert.throws(() => checkEnvironment({ ...game, user: { isGM: false } }), /Mistrza/);
  assert.throws(() => checkEnvironment({ ...game, system: { id: 'dnd5e' } }), /CoC7/);
  assert.throws(() => checkEnvironment({ ...game, system: { id: 'CoC7', version: '8.15' } }), /8.16/);
  assert.throws(() => checkEnvironment({ ...game, release: { generation: 13, build: 364 } }), /14.364/);
  await assert.rejects(importEntries([row('Jan')], { game, folderId: 'missing', ActorClass: { create() { assert.fail('Zapis nie powinien nastąpić'); } } }), /folder/);
});

test('brak dopasowania lub zniknięcie źródła nie tworzy pustego aktora', async () => {
  const pending = { ...row('Jan'), requests: [{ key: '0', type: 'spell', name: 'Czar', choice: '' }] };
  let created = false;
  await importEntries([pending], { game, ActorClass: { create() { created = true; } } });
  assert.equal(created, false);
  assert.match(pending.status, /Rozstrzygnij/);
  pending.requests[0].choice = 'Item.deleted';
  await importEntries([pending], { game, resolveUuid: async () => null, ActorClass: { create() { created = true; } } });
  assert.equal(created, false);
  assert.match(pending.status, /Niedostępny/);
});

test('aktor i komplet przedmiotów powstają w jednym wywołaniu z zachowaniem nowych ID', async () => {
  const entry = { ...row('Jan'), requests: [{ key: '0', type: 'spell', name: 'Czar', choice: 'Item.s' }] };
  await importEntries([entry], { game, randomID: () => 'newEmbeddedId001', resolveUuid: async () => ({ type: 'spell', toObject: () => ({ _id: 'old', type: 'spell', name: 'Czar', system: {} }) }),
    ActorClass: { async create(data, options) {
      assert.equal(options.keepEmbeddedIds, true);
      assert.equal(data.items[0]._id, 'newEmbeddedId001');
      return { id: 'actor' };
    } }
  });
  assert.equal(entry.createdId, 'actor');
});
