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
