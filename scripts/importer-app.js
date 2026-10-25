import { extractSelectedPages, openPdf } from './pdf.js';
import { parsePageRanges } from './page-ranges.js';
import { parseActors } from './parser.js';
import { checkEnvironment, importEntries, MODULE_ID } from './import-service.js';
import { ACTOR_TYPES, requireActorType } from './actor-types.js';
import { addWeaponDependencies, aliasKey, hasPendingItems, initializeMatches, ITEM_LABELS, loadItemCatalog, SKIP_ITEM } from './item-matching.js';
import { chooseItem } from './dialogs.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ImporterApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: ['coc-mass-importer'],
    window: { title: 'CoC7 — Masowy import aktorów', resizable: true },
    position: { width: 860, height: 800 }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/importer.hbs` } };

  #pdf = null;
  #listeners;
  #busy = false;
  #fileName = '';
  #ranges = '';
  #text = '';
  #type;
  #folder = '';
  #entries = [];
  #source = null;
  #catalog = null;
  #catalogWarnings = [];

  constructor({ actorType, ...options } = {}) {
    super(options);
    this.#type = requireActorType(actorType);
  }

  #canImport(entry) { return entry.selected && !entry.createdId && !entry.errors.length && !hasPendingItems(entry); }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      fileName: this.#fileName, pageCount: this.#pdf?.numPages,
      ranges: this.#ranges, text: this.#text,
      actorTypeLabel: ACTOR_TYPES.find(t => t.id === this.#type).label,
      catalogCount: this.#catalog?.length, catalogWarnings: this.#catalogWarnings,
      folders: game.folders.filter(f => f.type === 'Actor').map(f => ({ id: f.id, name: f.name, selected: f.id === this.#folder })),
      entries: this.#entries.map((entry, index) => ({
        ...entry, index, disabled: !!entry.createdId || !!entry.errors.length,
        pending: hasPendingItems(entry),
        summary: this.#type === 'vehicle' ? `PW ${entry.actor.system.stats.hp ?? '—'} · Ruch ${entry.actor.system.stats.mov ?? '—'}`
          : Object.entries(entry.actor.system.characteristics).map(([key, stat]) => `${key.toUpperCase()} ${stat.value}`).join(' · '),
        requests: entry.requests.map(request => {
          const item = this.#catalog?.find(i => i.uuid === request.choice);
          return { ...request, entryIndex: index, typeLabel: ITEM_LABELS[request.type],
            hasValue: request.value !== undefined, locked: !!entry.createdId,
            matchedName: item ? `${item.name} — ${item.source}` : request.choice === SKIP_ITEM ? 'Pominięto — tylko notatki' : 'Wymaga wyboru' };
        })
      })),
      hasEntries: this.#entries.length > 0,
      canImport: this.#entries.some(entry => this.#canImport(entry)),
      source: this.#source ? `PDF: ${this.#source.fileName}; strony pliku: ${this.#source.pages.join(', ')}` : 'Tekst wklejony ręcznie'
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#listeners?.abort();
    this.#listeners = new AbortController();
    const listenerOptions = { signal: this.#listeners.signal };
    this.element.addEventListener('change', event => {
      if (event.target.name === 'pdf') {
        const file = event.target.files[0];
        void this.#run(() => this.#loadPdf(file));
      }
      if (event.target.name === 'folder') this.#folder = event.target.value;
      if (event.target.dataset.entry !== undefined) {
        this.#entries[Number(event.target.dataset.entry)].selected = event.target.checked;
        const button = this.element.querySelector('[data-command="import"]');
        button.disabled = !this.#entries.some(entry => this.#canImport(entry));
      }
    }, listenerOptions);
    this.element.addEventListener('input', event => {
      if (event.target.name === 'text') {
        this.#text = event.target.value;
        this.#invalidatePreview();
      }
      if (event.target.name === 'ranges') {
        this.#ranges = event.target.value;
        if (this.#source) {
          this.#source = null; this.#text = '';
          this.element.querySelector('[name="text"]').value = '';
        }
        this.#invalidatePreview();
      }
    }, listenerOptions);
    this.element.addEventListener('dragover', event => {
      if (event.target.closest('[data-pdf-drop]')) event.preventDefault();
    }, listenerOptions);
    this.element.addEventListener('drop', event => {
      if (!event.target.closest('[data-pdf-drop]')) return;
      event.preventDefault();
      const files = [...event.dataTransfer.files];
      if (files.length !== 1) { ui.notifications.warn('Upuść jeden plik PDF.'); return; }
      void this.#run(() => this.#loadPdf(files[0]));
    }, listenerOptions);
    this.element.addEventListener('click', event => {
      const button = event.target.closest('[data-command]');
      if (!button || button.disabled) return;
      const command = button.dataset.command;
      void this.#run(async () => {
        this.#capture();
        if (command === 'extract') await this.#extract();
        if (command === 'preview') await this.#preview();
        if (command === 'import') await this.#import();
        if (command === 'match') await this.#match(Number(button.dataset.actor), button.dataset.request);
      });
    }, listenerOptions);
  }

  #invalidatePreview() {
    this.#entries = [];
    this.element.querySelector('[data-preview]')?.replaceChildren();
    const button = this.element.querySelector('[data-command="import"]');
    if (button) button.disabled = true;
  }

  #capture() {
    const root = this.element;
    this.#text = root.querySelector('[name="text"]').value;
    this.#ranges = root.querySelector('[name="ranges"]').value;
    this.#folder = root.querySelector('[name="folder"]').value;
  }

  async #run(action) {
    if (this.#busy) return;
    this.#busy = true;
    this.element.querySelectorAll('button,input,textarea,select').forEach(e => { e.disabled = true; });
    try {
      checkEnvironment(game);
      await action();
    } catch (error) {
      ui.notifications.error(error.message);
      console.error(`${MODULE_ID}:`, error);
    } finally {
      this.#busy = false;
      await this.render({ force: true });
    }
  }

  async #loadPdf(file) {
    if (!file) return;
    if (!/\.pdf$/i.test(file.name) && file.type !== 'application/pdf') throw new Error('Wybierz plik PDF.');
    this.#capture();
    this.#entries = []; this.#text = ''; this.#source = null; this.#ranges = ''; this.#fileName = '';
    const previous = this.#pdf;
    this.#pdf = null;
    await previous?.destroy();
    this.#pdf = await openPdf(file);
    this.#fileName = file.name;
  }

  async #extract() {
    if (!this.#pdf) throw new Error('Najpierw wybierz plik PDF.');
    const pages = parsePageRanges(this.#ranges, this.#pdf.numPages);
    this.#entries = []; this.#text = ''; this.#source = null;
    const extracted = await extractSelectedPages(this.#pdf, this.#ranges);
    const empty = extracted.filter(p => !p.text).map(p => p.number);
    this.#text = extracted.map(p => p.text).join('\n\n');
    this.#source = { fileName: this.#fileName, pages };
    if (empty.length) ui.notifications.warn(`Brak tekstu na stronach: ${empty.join(', ')}. Skan wymaga OCR poza tym modułem.`);
  }

  async #preview() {
    if (this.#pdf && !this.#source) throw new Error('Odczytaj wybrane strony PDF przed przygotowaniem podglądu.');
    const parsed = parseActors(this.#text, this.#type);
    const { catalog, warnings } = await loadItemCatalog(game);
    this.#catalog = catalog; this.#catalogWarnings = warnings;
    const aliases = game.settings.get(MODULE_ID, 'itemAliases');
    this.#entries = [];
    for (const entry of parsed) {
      const duplicate = game.actors.some(actor => actor.name === entry.name);
      if (duplicate) entry.warnings.push('Aktor o tej nazwie już istnieje. Zaznacz go świadomie, jeśli chcesz utworzyć kolejną kopię.');
      if (this.#source) entry.actor.flags = { [MODULE_ID]: { source: structuredClone(this.#source) } };
      entry.requests = initializeMatches(entry.requests, catalog, aliases);
      await addWeaponDependencies(entry, catalog, aliases, fromUuid);
      this.#entries.push({ ...entry, selected: !duplicate && !entry.errors.length, status: '' });
    }
  }

  async #match(index, key) {
    const entry = this.#entries[index];
    if (!entry || entry.createdId) return;
    const request = entry.requests.find(r => r.key === key);
    if (!request) return;
    const result = await chooseItem(request, this.#catalog);
    if (!result || !result.choice) return;
    if (result.choice !== SKIP_ITEM && !this.#catalog.some(i => i.uuid === result.choice && i.type === request.type)) throw new Error('Nieprawidłowy przedmiot.');
    request.choice = result.choice; request.reason = 'Wybór użytkownika';
    if (result.remember && result.choice !== SKIP_ITEM) {
      const aliases = { ...game.settings.get(MODULE_ID, 'itemAliases'), [aliasKey(request)]: result.choice };
      await game.settings.set(MODULE_ID, 'itemAliases', aliases);
      for (const other of this.#entries) for (const ref of other.requests) {
        if (!other.createdId && !ref.choice && aliasKey(ref) === aliasKey(request)) ref.choice = result.choice;
      }
    }
    for (const other of this.#entries.filter(e => !e.createdId)) {
      await addWeaponDependencies(other, this.#catalog, game.settings.get(MODULE_ID, 'itemAliases'), fromUuid);
    }
  }

  async #import() {
    if (!this.#entries.some(entry => this.#canImport(entry))) throw new Error('Przygotuj podgląd i rozstrzygnij dopasowania zaznaczonych postaci.');
    if (this.#entries.some(e => e.selected && !e.createdId && hasPendingItems(e))) throw new Error('Rozstrzygnij wszystkie zaznaczone wiersze lub odznacz je.');
    await importEntries(this.#entries, { game, ActorClass: CONFIG.Actor.documentClass, folderId: this.#folder || null,
      resolveUuid: fromUuid, randomID: foundry.utils.randomID });
    const created = this.#entries.filter(e => e.createdId).length;
    const failed = this.#entries.filter(e => e.status.startsWith('Błąd:')).length;
    ui.notifications.info(`Zaimportowano: ${created}. Błędy: ${failed}. Szczegóły w tabeli.`);
  }

  async close(options) {
    if (this.#busy) {
      ui.notifications.warn('Poczekaj na zakończenie bieżącej operacji.');
      return this;
    }
    this.#listeners?.abort();
    await this.#pdf?.destroy();
    this.#pdf = null;
    return super.close(options);
  }
}
