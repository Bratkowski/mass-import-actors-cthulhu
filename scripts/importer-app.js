import { parseActorList } from './json-import.js';
import { checkEnvironment, importEntries, MODULE_ID } from './import-service.js';
import { ACTOR_TYPES, requireActorType } from './actor-types.js';
import { addWeaponDependencies, aliasKey, hasPendingItems, initializeMatches, loadItemCatalog, requestForWorldItem, SKIP_ITEM } from './item-matching.js';
import { ITEM_LABELS, itemFromDrop, parsePercent, resolveWorldItem } from './world-items.js';
import { chooseItem } from './dialogs.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ImporterApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID, classes: ['coc-mass-importer'],
    window: { title: 'CoC7 — Masowy import aktorów z JSON', resizable: true },
    position: { width: 880, height: 800 }
  };
  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/importer.hbs` } };

  #listeners;
  #busy = false;
  #fileName = '';
  #text = '';
  #type;
  #folder = '';
  #entries = [];
  #catalog = [];
  #remember = true;

  constructor({ actorType, ...options } = {}) {
    super(options);
    this.#type = requireActorType(actorType);
  }

  #canImport(entry) { return entry.selected && !entry.createdId && !entry.errors.length && !hasPendingItems(entry); }
  #resolve = uuid => resolveWorldItem(game, uuid);

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      fileName: this.#fileName, text: this.#text, remember: this.#remember,
      actorTypeLabel: ACTOR_TYPES.find(t => t.id === this.#type).label,
      catalogCount: this.#catalog.length,
      folders: game.folders.filter(f => f.type === 'Actor').map(f => ({ id: f.id, name: f.name, selected: f.id === this.#folder })),
      entries: this.#entries.map((entry, index) => ({
        ...entry, index, disabled: !!entry.createdId || !!entry.errors.length, pending: hasPendingItems(entry),
        summary: this.#type === 'vehicle' ? `PW ${entry.actor.system.stats?.hp ?? '—'} · Ruch ${entry.actor.system.stats?.mov ?? '—'}`
          : Object.entries(entry.actor.system.characteristics ?? {}).map(([key, stat]) => `${key.toUpperCase()} ${stat?.value ?? '—'}`).join(' · '),
        requests: entry.requests.map(request => {
          const item = this.#catalog.find(i => i.uuid === request.choice);
          return { ...request, entryIndex: index, typeLabel: ITEM_LABELS[request.type], isSkill: request.type === 'skill',
            hasValue: request.value !== undefined, locked: !!entry.createdId,
            matchedName: item?.name ?? (request.choice === SKIP_ITEM ? 'Pominięto' : 'Przeciągnij przedmiot z Items lub wyszukaj') };
        })
      })),
      hasEntries: this.#entries.length > 0,
      canImport: this.#entries.some(entry => this.#canImport(entry))
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#listeners?.abort(); this.#listeners = new AbortController();
    const listenerOptions = { signal: this.#listeners.signal };
    this.element.addEventListener('change', event => {
      if (event.target.name === 'jsonFile') {
        const file = event.target.files[0]; void this.#run(() => this.#loadJson(file));
      }
      if (event.target.name === 'folder') this.#folder = event.target.value;
      if (event.target.name === 'rememberMatches') this.#remember = event.target.checked;
      if (event.target.dataset.entry !== undefined) {
        this.#entries[Number(event.target.dataset.entry)].selected = event.target.checked; this.#updateImportButton();
      }
      if (event.target.dataset.percentRequest !== undefined) {
        const entry = this.#entries[Number(event.target.dataset.actor)];
        const request = entry?.requests.find(r => r.key === event.target.dataset.percentRequest);
        if (request && !entry.createdId) {
          request.value = parsePercent(event.target.value); entry.status = ''; this.#updateImportButton();
          void this.render({ force: true });
        }
      }
    }, listenerOptions);
    this.element.addEventListener('input', event => {
      if (event.target.name !== 'jsonText') return;
      this.#text = event.target.value; this.#entries = [];
      this.element.querySelector('[data-preview]')?.replaceChildren(); this.#updateImportButton();
    }, listenerOptions);
    this.element.addEventListener('dragover', event => {
      if (event.target.closest('[data-json-drop], [data-item-drop], [data-actor-item-drop]')) event.preventDefault();
    }, listenerOptions);
    this.element.addEventListener('drop', event => {
      const itemTarget = event.target.closest('[data-item-drop]');
      const actorTarget = event.target.closest('[data-actor-item-drop]');
      if (itemTarget || actorTarget) {
        event.preventDefault(); event.stopPropagation();
        const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
        void this.#run(async () => {
          this.#capture();
          const entry = this.#entries[Number((itemTarget || actorTarget).dataset.actor)];
          if (!entry || entry.createdId) return;
          let request = itemTarget ? entry.requests.find(r => r.key === itemTarget.dataset.request) : null;
          if (itemTarget && !request) return;
          const item = itemFromDrop(data, game, request?.type);
          if (!request) {
            this.#catalog = (await loadItemCatalog(game)).catalog;
            request = requestForWorldItem(entry, item, this.#catalog, game.settings.get(MODULE_ID, 'itemAliases'));
          }
          await this.#setChoice(entry, request, { choice: item.uuid, remember: this.#remember });
        });
      } else if (event.target.closest('[data-json-drop]')) {
        event.preventDefault();
        const files = [...event.dataTransfer.files];
        if (files.length !== 1) { ui.notifications.warn('Upuść jeden plik JSON zawierający listę aktorów.'); return; }
        void this.#run(() => this.#loadJson(files[0]));
      }
    }, listenerOptions);
    this.element.addEventListener('click', event => {
      const button = event.target.closest('[data-command]');
      if (!button || button.disabled) return;
      void this.#run(async () => {
        this.#capture();
        if (button.dataset.command === 'preview') await this.#preview();
        if (button.dataset.command === 'import') await this.#import();
        if (button.dataset.command === 'match') await this.#match(Number(button.dataset.actor), button.dataset.request);
      });
    }, listenerOptions);
  }

  #updateImportButton() {
    const button = this.element.querySelector('[data-command="import"]');
    if (button) button.disabled = !this.#entries.some(entry => this.#canImport(entry));
  }

  #capture() {
    this.#text = this.element.querySelector('[name="jsonText"]').value;
    this.#folder = this.element.querySelector('[name="folder"]').value;
    this.#remember = this.element.querySelector('[name="rememberMatches"]').checked;
  }

  async #run(action) {
    if (this.#busy) return;
    this.#busy = true;
    this.element.querySelector('.importer-body')?.querySelectorAll('button,input,textarea,select').forEach(e => { e.disabled = true; });
    try { checkEnvironment(game); await action(); }
    catch (error) { ui.notifications.error(error.message); console.error(`${MODULE_ID}:`, error); }
    finally { this.#busy = false; await this.render({ force: true }); }
  }

  async #loadJson(file) {
    if (!file) return;
    if (!/\.json$/i.test(file.name)) throw new Error('Wybierz plik .json z listą aktorów.');
    this.#capture(); this.#entries = []; this.#text = await file.text(); this.#fileName = file.name;
  }

  async #preview() {
    const parsed = parseActorList(this.#text, this.#type);
    this.#catalog = (await loadItemCatalog(game)).catalog;
    const aliases = game.settings.get(MODULE_ID, 'itemAliases');
    this.#entries = [];
    for (const entry of parsed) {
      const duplicate = game.actors.some(actor => actor.name === entry.name);
      if (duplicate) entry.warnings.push('Aktor o tej nazwie już istnieje. Import utworzy kolejną kopię.');
      entry.requests = initializeMatches(entry.requests, this.#catalog, aliases);
      await addWeaponDependencies(entry, this.#catalog, aliases, this.#resolve);
      this.#entries.push({ ...entry, selected: !duplicate && !entry.errors.length, status: '' });
    }
  }

  async #match(index, key) {
    const entry = this.#entries[index];
    if (!entry || entry.createdId) return;
    const request = entry.requests.find(r => r.key === key);
    if (!request) return;
    this.#catalog = (await loadItemCatalog(game)).catalog;
    const result = await chooseItem(request, this.#catalog, this.#remember);
    if (result?.choice) await this.#setChoice(entry, request, result);
  }

  async #setChoice(entry, request, result) {
    if (result.choice !== SKIP_ITEM) {
      const item = this.#resolve(result.choice);
      if (item.type !== request.type) throw new Error('Nieprawidłowy typ przedmiotu.');
    }
    this.#catalog = (await loadItemCatalog(game)).catalog;
    request.choice = result.choice; request.reason = 'Wskazany przedmiot z Items'; entry.status = '';
    if (result.remember && result.choice !== SKIP_ITEM) {
      const aliases = { ...game.settings.get(MODULE_ID, 'itemAliases'), [aliasKey(request)]: result.choice };
      await game.settings.set(MODULE_ID, 'itemAliases', aliases);
      for (const other of this.#entries) for (const ref of other.requests) {
        if (!other.createdId && !ref.choice && aliasKey(ref) === aliasKey(request)) ref.choice = result.choice;
      }
    }
    for (const other of this.#entries.filter(e => !e.createdId)) {
      await addWeaponDependencies(other, this.#catalog, game.settings.get(MODULE_ID, 'itemAliases'), this.#resolve);
    }
  }

  async #import() {
    if (!this.#entries.some(entry => this.#canImport(entry))) throw new Error('Przygotuj podgląd, wskaż przedmioty i uzupełnij procenty umiejętności.');
    if (this.#entries.some(e => e.selected && !e.createdId && hasPendingItems(e))) throw new Error('Rozstrzygnij przedmioty i procenty wszystkich zaznaczonych aktorów lub odznacz ich.');
    await importEntries(this.#entries, { game, ActorClass: CONFIG.Actor.documentClass, folderId: this.#folder || null,
      resolveUuid: this.#resolve, randomID: foundry.utils.randomID });
    const created = this.#entries.filter(e => e.createdId).length;
    const failed = this.#entries.filter(e => e.status.startsWith('Błąd:')).length;
    ui.notifications.info(`Zaimportowano: ${created}. Błędy: ${failed}. Szczegóły w tabeli.`);
  }

  async close(options) {
    if (this.#busy) { ui.notifications.warn('Poczekaj na zakończenie bieżącej operacji.'); return this; }
    this.#listeners?.abort(); return super.close(options);
  }
}
