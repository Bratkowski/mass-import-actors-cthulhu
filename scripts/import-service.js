export const MODULE_ID = 'mass-import-actors-cthulhu';

export function checkEnvironment(game) {
  if (!game.user?.isGM) throw new Error('Import aktorów jest dostępny tylko dla Mistrza Gry.');
  if (game.system?.id !== 'CoC7') throw new Error('Wymagany jest system CoC7.');
  if (game.system.version !== '8.16') throw new Error('Ta wersja modułu obsługuje CoC7 8.16.');
  if (game.release?.generation !== 14 || Number(game.release.build) < 364) throw new Error('Wymagane jest Foundry VTT 14.364 lub nowsze wydanie 14.');
}

/** Import sequentially and keep a per-row result. Successfully imported rows cannot be retried. */
export async function importEntries(entries, { game, ActorClass, folderId = null, onProgress = () => {} }) {
  checkEnvironment(game);
  if (folderId && !game.folders?.some(f => f.id === folderId && f.type === 'Actor')) throw new Error('Wybrany folder aktorów nie istnieje.');
  const pending = entries.filter(e => e.selected && !e.createdId && !e.errors.length);
  for (const [index, entry] of pending.entries()) {
    try {
      const actor = await ActorClass.create({ ...structuredClone(entry.actor), folder: folderId }, { renderSheet: false });
      if (!actor?.id) throw new Error('Foundry nie potwierdziło utworzenia aktora.');
      entry.createdId = actor.id;
      entry.status = 'Zaimportowano';
    } catch (error) {
      entry.status = `Błąd: ${error.message}`;
    }
    onProgress(index + 1, pending.length);
  }
  return entries;
}
