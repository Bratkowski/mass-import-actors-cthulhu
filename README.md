# Masowy import aktorów CoC7 — JSON i Items

Moduł importuje **listę aktorów JSON**. Gotowe umiejętności, bronie i zaklęcia przypisujesz z zakładki **Items / Przedmioty** przez wyszukiwarkę albo przeciąganie. Procenty umiejętności pochodzą z danych konkretnego aktora.

Wersja **0.3.0**, cel: Foundry VTT **14.364+ w linii 14** i system **CoC7 8.16**. Import wykonuje GM. Testy automatyczne nie zastępują weryfikacji w uruchomionym Foundry.

## Instalacja na Forge

W **Bazaar → Install from Manifest** wklej:

```text
https://github.com/Bratkowski/mass-import-actors-cthulhu/releases/latest/download/module.json
```

Po instalacji lub aktualizacji uruchom świat CoC7, włącz moduł w **Manage Modules / Zarządzaniu modułami** i odśwież stronę gry. Ten sam manifest działa w instalatorze standardowego Foundry.

## Instrukcja obsługi

1. Przygotuj gotowe wzorce w zakładce **Items / Przedmioty**. Jeżeli są w kompendium, najpierw zaimportuj je do Items.
2. Otwórz **Masowy import CoC7** z katalogu aktorów albo przez **Ustawienia → Konfiguracja ustawień → Masowy import aktorów CoC7**.
3. W obowiązkowym oknie modalnym wybierz typ całej partii: postacie graczy (`character`), BN (`npc`), potwory (`creature`) lub pojazdy (`vehicle`).
4. Wklej listę JSON do pola tekstowego albo wczytaj/upuść plik `.json`. Obsługiwane są tablica aktorów, obiekt `{"actors":[...]}` i pojedynczy eksport Actor z Foundry.
5. Wybierz folder docelowy i kliknij **Przygotuj podgląd listy**.
6. Dla każdej umiejętności, broni lub zaklęcia sprawdź dopasowanie. Możesz przeciągnąć wzorzec z zakładki Items bezpośrednio na odpowiedni wiersz. Przedmiot musi być właściwego typu. Możesz też upuścić Item na pole **Dodaj lub przypisz Item temu aktorowi**: moduł wykorzysta pasującą pozycję listy z jej procentem lub doda nową pozycję. Dla nowej umiejętności bez wartości w JSON uzupełnij procent w podglądzie.
7. Alternatywnie kliknij **Wyszukaj w Items / zmień / pomiń**. Okno pozwala wyszukiwać nazwy PL/EN i również ma pole do przeciągania z Items.
8. Procenty są już wypełnione z JSON. Jeśli ich brakuje, uzupełnij pole **Wartość dla tego aktora (%)**. Nie zmienia to wzorca ani wartości innych aktorów.
9. Sprawdź dodatkowe umiejętności wymagane przez broń. Gdy JSON eksportu zawiera stare ID powiązań, moduł wykorzysta te relacje; dla prostszej listy wskaż pole `skill` albo umieść procent ataku w `weapons[].value`.
10. Zaznacz aktorów i kliknij **Importuj zaznaczonych aktorów**. Błędy są pokazane przy każdym wierszu. Ponowienie w tym samym podglądzie pomija już utworzonych aktorów.

Zmiana tekstu JSON usuwa poprzedni podgląd. Nowy podgląd rozpoczyna nową partię i może utworzyć kolejne kopie aktorów. Istniejące nazwy są domyślnie odznaczone.

## Format listy — uproszczony JSON

Gotowy przykład: [examples/actors.json](examples/actors.json). Nazwy mogą być po polsku, a wzorce w Items po angielsku.

```json
[
  {
    "name": "Jan",
    "characteristics": { "str": 50, "con": 60, "siz": 55 },
    "attribs": { "hp": 11, "mp": 12 },
    "skills": [
      { "name": "Nasłuchiwanie", "value": 60 },
      { "name": "Broń Palna (Krótka)", "value": 55 }
    ],
    "weapons": [
      { "name": "Rewolwer .38", "skill": "Broń Palna (Krótka)" }
    ],
    "spells": ["Znak Starszych Bogów"],
    "notes": "Notatka Strażnika"
  },
  {
    "name": "Anna",
    "skills": [{ "name": "Nasłuchiwanie", "value": 80 }]
  }
]
```

Po przypisaniu tego samego Item `Listen` Jan otrzyma 60%, a Anna 80%. Wartość wzorca `Listen` w Items pozostanie bez zmian.

- `name` jest obowiązkowe. Typ wybierasz przed otwarciem importera; opcjonalne `type` w JSON musi być z nim zgodne.
- `characteristics` i `attribs` używają nazw pól CoC7: `str`, `con`, `siz`, `dex`, `app`, `int`, `pow`, `edu` oraz `hp`, `mp`, `san`, `mov`, `lck`. Pominięte pola inicjalizuje system.
- `skills` zawiera nazwy i nieujemne liczby `value` (również 0). Można wpisać np. `"60%"` zamiast liczby 60.
- `weapons` zawiera nazwy wzorców. `skill` wskazuje nazwę umiejętności z listy tego aktora. Zamiast tego można podać `value`, np. `{"name":"Rewolwer .38","value":55}` — importer poprosi o wzorzec umiejętności wymaganej przez wybraną broń.
- `spells` to lista nazw lub obiektów `{"name":"..."}`. Koszty i opis zaklęcia pochodzą ze wzorca.
- `notes` trafia do notatek Strażnika.
- Dla pojazdu użyj `stats`, np. `{"name":"Samochód","stats":{"hp":30,"mov":10,"build":{"value":2,"current":2},"armor":{"value":3}}}`.

## Lista pełnych eksportów Foundry

Możesz umieścić zawartość plików eksportu aktorów w jednej tablicy:

```json
[
  {
    "name": "BN Przykładowy",
    "type": "npc",
    "img": "icons/svg/mystery-man.svg",
    "system": { "characteristics": { "str": { "value": 50 } } },
    "items": [
      {
        "_id": "oldSkillId",
        "name": "Listen",
        "type": "skill",
        "system": { "adjustments": { "base": 20, "experience": 40 } }
      }
    ]
  }
]
```

Importer zachowa `system` i `img` aktora. Procent umiejętności odczyta z sumy `system.adjustments` (w przykładzie: 60%), a dla starszych danych z `system.value` albo liczbowego `system.base`. Zawartość `items` jest listą żądanych przedmiotów: do ich utworzenia przypisujesz wzorce z Items świata. Nie są przeszukiwane ekwipunki istniejących aktorów.

Stare `_id` służą tylko do odtworzenia relacji broń–umiejętność. Nowi aktorzy i ich przedmioty dostają nowe ID. Nie przenosimy starego folderu, ownership, prototypeToken, metadanych ani flag wyboru arkusza. Niepuste efekty aktora oraz typy przedmiotów inne niż `skill`, `weapon`, `spell` blokują taki wiersz zamiast ginąć po cichu.

## Dopasowania i przeciąganie

- Źródłem jest wyłącznie **Items danego świata**. Przeciągnięcie przedmiotu z arkusza aktora lub bezpośrednio z kompendium zostanie odrzucone. Najpierw dodaj wzorzec do Items.
- Automatyczne sugestie korzystają ze zgodnej nazwy, CoCID oraz ograniczonego słownika najczęstszych umiejętności PL–EN. Wyniki niejednoznaczne wymagają wyboru.
- Zaznaczone **Zapamiętuj dopasowania nazw po przeciągnięciu przedmiotu** zapisuje parę nazwa → Item w tym świecie. Zapamiętywany jest wzorzec, **nigdy procent aktora**.
- Każdy aktor ma własne kopie umiejętności i osobne procenty. Stare przyrosty doświadczenia wzorca nie są dodawane do wartości z JSON.
- Broń i zaklęcia zachowują mechanikę, obrażenia, zasięgi, koszty, opis i grafikę wskazanego wzorca. Broń otrzymuje nowe ID odpowiedniej umiejętności aktora.
- Brakującej wartości procentowej nie odgadujemy. Można ją uzupełnić w podglądzie lub w JSON. Sprzeczne wartości tej samej umiejętności blokują zapis danego aktora.
- Przycisk **Pomiń ten przedmiot** świadomie wyłącza jego import. Wymaganej umiejętności broni nie można pominąć, jeśli broń nadal ma być importowana.

## Budowanie i publikacja

Potrzebny jest Node.js 22+. Moduł nie wymaga instalowania zależności ani pobierania bibliotek.

```sh
npm test
npm run build
```

Gotowy katalog: `dist/mass-import-actors-cthulhu`. Skopiuj go do `Data/modules/` lub pobierz paczkę z [GitHub Releases](https://github.com/Bratkowski/mass-import-actors-cthulhu/releases).

Publikacja: zaktualizuj wersję w `module.json` i `package.json`, adres `download` i notatki wydania; wypchnij tag `vX.Y.Z`. Workflow uruchomi testy, zbuduje paczkę i opublikuje manifest oraz ZIP pod stałym adresem instalacyjnym.

## Rozwiązywanie problemów

| Problem | Rozwiązanie |
| --- | --- |
| Nieprawidłowy JSON | Użyj podwójnych cudzysłowów i tablicy `[...]`; usuń komentarze oraz przecinki po ostatniej pozycji. |
| Inny typ aktora niż w modalu | Rozdziel listę na partie jednego typu i wybierz odpowiedni typ. |
| Nie ma przedmiotu w wyszukiwarce | Dodaj gotowy przedmiot do Items świata, a potem otwórz wyszukiwarkę ponownie. |
| Przeciąganie jest odrzucone | Przeciągaj z zakładki Items, wybierając ten sam typ, którego wymaga wiersz. |
| Brak procentu | Podaj `skills[].value`, odpowiednie dane eksportu albo uzupełnij pole w podglądzie. |
| Broń wymaga umiejętności | Wskaż wzorzec umiejętności i wartość dla tego aktora. |
| Część importu się nie udała | Popraw przypisania i ponów w tym samym podglądzie; udane wiersze nie zostaną powielone. |
