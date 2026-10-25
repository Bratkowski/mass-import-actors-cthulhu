export const ITEM_LABELS = Object.freeze({ skill: 'Umiejętność', weapon: 'Broń', spell: 'Zaklęcie' });

export function isWorldItemUuid(uuid) {
  return typeof uuid === 'string' && /^Item\.[A-Za-z0-9_-]+$/.test(uuid);
}

/** Deliberately resolve through game.items: actor inventories and compendia are not sources. */
export function resolveWorldItem(game, uuid) {
  if (!isWorldItemUuid(uuid)) throw new Error('Wybierz przedmiot z katalogu Items tego świata.');
  const item = game.items?.get(uuid.slice(5));
  if (!item || item.uuid !== uuid || item.parent || item.actor || item.pack || item.compendium) {
    throw new Error('Przedmiot nie jest już dostępny w katalogu Items tego świata.');
  }
  return item;
}

export function itemFromDrop(data, game, expectedType) {
  if (data?.type !== 'Item') throw new Error('Przeciągnij przedmiot z katalogu Items.');
  const item = resolveWorldItem(game, data.uuid);
  if (!ITEM_LABELS[item.type]) throw new Error('Obsługiwane Items: umiejętności, broń i zaklęcia.');
  if (expectedType && item.type !== expectedType) throw new Error(`Ten wiersz wymaga typu: ${ITEM_LABELS[expectedType] ?? expectedType}.`);
  return item;
}

export function parsePercent(value) {
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?\s*%?$/.test(value.trim())) return undefined;
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  const number = Number(String(value).trim().replace(/%$/, '').trim());
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}
