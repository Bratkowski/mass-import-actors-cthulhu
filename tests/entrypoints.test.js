import { test } from 'node:test';
import assert from 'node:assert/strict';

test('ustawienia i API najpierw otwierają modal; brak wyboru nie otwiera importera', async () => {
  const callbacks = new Map(), menus = new Map(), settings = new Map();
  let importerRenders = 0;
  class Application {
    constructor(options = {}) { this.options = options; }
    async render() { if (!this.options.modal) importerRenders++; return this; }
    async _prepareContext() { return {}; }
  }
  globalThis.foundry = { applications: { api: { ApplicationV2: Application, HandlebarsApplicationMixin: Base => Base, DialogV2: class extends Application {} } } };
  globalThis.game = {
    user: { isGM: true }, system: { id: 'CoC7', version: '8.16' }, release: { generation: 14, build: 364 },
    folders: [], actors: [], modules: new Map([['mass-import-actors-cthulhu', {}]]),
    settings: { register: (id, key, value) => settings.set(key, value), registerMenu: (id, key, value) => menus.set(key, value) }
  };
  globalThis.ui = { notifications: { error: message => assert.fail(message) } };
  globalThis.Hooks = { once: (name, callback) => callbacks.set(name, callback), on: (name, callback) => callbacks.set(name, callback) };
  try {
    await import('../scripts/main.js');
    callbacks.get('init')(); callbacks.get('ready')();
    const fromApi = await game.modules.get('mass-import-actors-cthulhu').api.open();
    const fromSettings = new (menus.get('importer').type)();
    assert.equal(fromApi.options.modal, true);
    assert.equal(fromSettings.options.modal, true);
    assert.equal(importerRenders, 0);
    await assert.rejects(fromApi.options.buttons[0].callback(null, { form: { elements: { actorType: { value: '' } } } }), /wybierz typ/);
    assert.equal(importerRenders, 0);
    for (const type of ['character', 'npc', 'creature', 'vehicle']) {
      const importer = await fromApi.options.buttons[0].callback(null, { form: { elements: { actorType: { value: type } } } });
      const context = await importer._prepareContext({});
      assert.ok(context.actorTypeLabel);
    }
    assert.equal(importerRenders, 4);
    const { ImporterApplication } = await import('../scripts/importer-app.js');
    assert.throws(() => new ImporterApplication(), /wybierz typ/);
    assert.equal(settings.get('itemAliases').scope, 'world');
  } finally {
    for (const key of ['foundry', 'game', 'ui', 'Hooks']) delete globalThis[key];
  }
});
