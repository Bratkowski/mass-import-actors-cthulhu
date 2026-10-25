export const ACTOR_TYPES = Object.freeze([
  { id: 'character', label: 'Postacie graczy (Badacze)' },
  { id: 'npc', label: 'BN — bohaterowie niezależni' },
  { id: 'creature', label: 'Potwory i stworzenia' },
  { id: 'vehicle', label: 'Pojazdy' }
]);

export function requireActorType(type) {
  if (!ACTOR_TYPES.some(t => t.id === type)) throw new Error('Najpierw wybierz typ aktorów.');
  return type;
}
