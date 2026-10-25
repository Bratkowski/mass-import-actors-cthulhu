import { extractSelectedPages, openPdf } from './pdf.js';
import { parsePageRanges } from './page-ranges.js';
import { parseActors } from './parser.js';
import { checkEnvironment, importEntries, MODULE_ID } from './import-service.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ImporterApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: MODULE_ID,
    classes: ['coc-mass-importer'],
    window: { title: 'CoC7 — Masowy import aktorów', resizable: true },
    position: { width: 800, height: 760 }
  };

  static PARTS = { main: { template: `modules/${MODULE_ID}/templates/importer.hbs` } };

  #pdf = null;
  #listeners;
  #busy = false;
  #fileName = '';
  #ranges = '';
  #text = '';
  #type = 'npc';
  #folder = '';
  #entries = [];
  #source = null;

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    return Object.assign(context, {
      fileName: this.#fileName, pageCount: this.#pdf?.numPages,
      ranges: this.#ranges, text: this.#text,
      npc: this.#type === 'npc', creature: this.#type === 'creature',
      folders: game.folders.filter(f => f.type === 'Actor').map(f => ({ id: f.id, name: f.name, selected: f.id === this.#folder })),
      entries: this.#entries.map((entry, index) => ({
        ...entry, index, disabled: !!entry.createdId || !!entry.errors.length,
        summary: Object.entries(entry.actor.system.characteristics).map(([key, stat]) => `${key.toUpperCase()} ${stat.value}`).join(' · ')
      })),
      hasEntries: this.#entries.length > 0,
      canImport: this.#entries.some(e => e.selected && !e.createdId && !e.errors.length),
      source: this.#source ? `PDF: ${this.#source.fileName}; strony pliku: ${this.#source.pages.join(', ')}` : 'Tekst wklejony ręcznie'
    });
  }

  _onRender(context, options) {
    super._onRender(context, options);
    this.#listeners?.abort();
    this.#listeners = new AbortController();
    const listenerOptions = { signal: this.#listeners.signal };
    this.element.addEventListener('change', event => {
      if (event.target.name === 'pdf') void this.#run(() => this.#loadPdf(event.target.files[0]));
      if (event.target.name === 'actorType') {
        this.#capture(); this.#entries = []; this.render();
      }
      if (event.target.name === 'folder') this.#folder = event.target.value;
      if (event.target.dataset.entry !== undefined) {
        this.#entries[Number(event.target.dataset.entry)].selected = event.target.checked;
        const button = this.element.querySelector('[data-command="import"]');
        button.disabled = !this.#entries.some(e => e.selected && !e.createdId && !e.errors.length);
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
    this.element.addEventListener('click', event => {
      const button = event.target.closest('[data-command]');
      if (!button || button.disabled) return;
      const command = button.dataset.command;
      void this.#run(async () => {
        this.#capture();
        if (command === 'extract') await this.#extract();
        if (command === 'preview') this.#preview();
        if (command === 'import') await this.#import();
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
    this.#type = root.querySelector('[name="actorType"]').value;
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

  #preview() {
    this.#entries = parseActors(this.#text, this.#type).map(entry => {
      const duplicate = game.actors.some(actor => actor.name === entry.name);
      if (duplicate) entry.warnings.push('Aktor o tej nazwie już istnieje. Zaznacz go świadomie, jeśli chcesz utworzyć kolejną kopię.');
      if (this.#source) entry.actor.flags = { [MODULE_ID]: { source: structuredClone(this.#source) } };
      return { ...entry, selected: !duplicate && !entry.errors.length, status: '' };
    });
  }

  async #import() {
    if (!this.#entries.some(e => e.selected && !e.createdId && !e.errors.length)) throw new Error('Najpierw przygotuj podgląd i zaznacz postacie.');
    await importEntries(this.#entries, { game, ActorClass: CONFIG.Actor.documentClass, folderId: this.#folder || null });
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
