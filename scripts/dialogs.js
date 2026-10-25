import { ACTOR_TYPES, requireActorType } from './actor-types.js';
import { checkEnvironment } from './import-service.js';
import { escapeHtml } from './html.js';
import { itemFromDrop } from './world-items.js';
import { ITEM_LABELS, normalizeName, SKIP_ITEM } from './item-matching.js';

export function actorTypeDialogOptions(onChoose) {
  return {
    window: { title: 'Jakiego typu aktorów importujesz?' }, modal: true,
    content: `<p>Wybierz jeden typ dla tej partii importu.</p><label>Typ aktorów
      <select name="actorType" required><option value="">— Wybierz typ —</option>
      ${ACTOR_TYPES.map(t => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('')}</select></label>`,
    buttons: [{ action: 'continue', label: 'Dalej — wczytaj listę JSON', callback: async (_event, button) => {
      checkEnvironment(game);
      return onChoose(requireActorType(button.form.elements.actorType.value));
    } }]
  };
}

export async function chooseItem(request, catalog, remember = true) {
  const candidates = catalog.filter(i => i.type === request.type).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  return foundry.applications.api.DialogV2.prompt({
    window: { title: `${ITEM_LABELS[request.type]}: ${request.name}` },
    position: { width: 650 }, modal: false, rejectClose: false,
    content: `<p>Wskaż gotowy przedmiot z katalogu Items tego świata. Możesz przeciągnąć go z zakładki Items na poniższe pole.</p>
      <div data-item-choice-drop style="border:2px dashed #9d7e46;padding:1rem;margin:0.5rem 0">Przeciągnij tutaj przedmiot z Items</div>
      <label>Szukaj nazwy PL/EN <input name="search" type="search" autocomplete="off"></label>
      <label>Gotowy przedmiot <select name="choice" required></select></label>
      <p data-match-count></p><label><input type="checkbox" name="remember" ${remember ? 'checked' : ''}> Zapamiętaj tę parę nazw w tym świecie</label>
      <p>Talenty i zaklęcia zachowują dane wzorca; nie wymagają procentów. Pominięcie umiejętności wymaganej przez broń blokuje import tej broni.</p>`,
    render: (_event, dialog) => {
      const select = dialog.element.querySelector('[name="choice"]');
      const search = dialog.element.querySelector('[name="search"]');
      const populate = forcedChoice => {
        const previous = forcedChoice || select.value || request.choice;
        const query = normalizeName(search.value);
        const found = candidates.filter(i => normalizeName(`${i.name} ${i.cocid} ${i.source}`).includes(query));
        const visible = found.slice(0, 150);
        const chosen = candidates.find(i => i.uuid === previous);
        if (chosen && !visible.includes(chosen)) visible.unshift(chosen);
        const option = (value, label) => { const element = document.createElement('option'); element.value = value; element.textContent = label; return element; };
        select.replaceChildren(option('', '— Wybierz przedmiot —'), option(SKIP_ITEM, 'Pomiń ten przedmiot'),
          ...visible.map(i => option(i.uuid, `${i.name} — ${i.source}`)));
        select.value = previous || '';
        dialog.element.querySelector('[data-match-count]').textContent = `Znaleziono: ${found.length}. Wyświetlono maks. 150; zawęź wyszukiwanie, aby znaleźć pozostałe.`;
      };
      search.addEventListener('input', () => populate()); populate();
      const dropZone = dialog.element.querySelector('[data-item-choice-drop]');
      dropZone.addEventListener('dragover', event => event.preventDefault());
      dropZone.addEventListener('drop', event => {
        event.preventDefault(); event.stopPropagation();
        try {
          const data = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
          const item = itemFromDrop(data, game, request.type);
          if (!candidates.some(i => i.uuid === item.uuid)) candidates.push({ uuid: item.uuid, name: item.name, source: 'Items' });
          search.value = ''; populate(item.uuid); dropZone.textContent = `Wybrano: ${item.name}`;
        } catch (error) { ui.notifications.warn(error.message); }
      });
    },
    ok: { label: 'Zastosuj dopasowanie', callback: (_event, button) => ({
      choice: button.form.elements.choice.value, remember: button.form.elements.remember.checked
    }) }
  });
}
