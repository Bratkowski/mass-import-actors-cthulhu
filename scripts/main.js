import { ImporterApplication } from './importer-app.js';
import { checkEnvironment, MODULE_ID } from './import-service.js';

let application;
function openImporter() {
  try {
    checkEnvironment(game);
    application ??= new ImporterApplication();
    return application.render({ force: true });
  } catch (error) {
    ui.notifications.error(error.message);
  }
}

Hooks.once('init', () => {
  game.settings.registerMenu(MODULE_ID, 'importer', {
    name: 'Masowy import aktorów CoC7', label: 'Otwórz importer',
    hint: 'Wklej bloki statystyk lub odczytaj wybrane strony PDF.',
    icon: 'fas fa-file-import', type: ImporterApplication, restricted: true
  });
});

Hooks.once('ready', () => {
  game.modules.get(MODULE_ID).api = Object.freeze({ open: openImporter });
});

Hooks.on('renderActorDirectory', (_app, element) => {
  if (!game.user.isGM || game.system.id !== 'CoC7') return;
  const root = element instanceof HTMLElement ? element : element?.[0];
  if (!root || root.querySelector('[data-coc-mass-import]')) return;
  const header = root.querySelector('.directory-header');
  if (!header) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.cocMassImport = '';
  button.textContent = 'Masowy import CoC7';
  button.addEventListener('click', openImporter);
  header.append(button);
});
