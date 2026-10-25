# Ustalenia techniczne — 25.10.2026

## Wersje docelowe

- [Foundry VTT 14.364](https://foundryvtt.com/releases/14.364) to Stable 6 z 10.06.2026.
- [CoC7 8.16](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/releases/tag/8.16) zostało wydane 05.10.2026. Informacja o wydaniu wskazuje koniec wsparcia Foundry 12 po tej wersji.
- [Manifest systemu w tagu 8.16](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/static/system.json): identyfikator `CoC7`, minimum Foundry 12, verified 14. Aktorzy: `character`, `container`, `creature`, `npc`, `vehicle`.

CoC7 to system gry; świat Foundry jest osobnym kontenerem danych korzystającym z tego systemu.

## Moduł

Korzystamy z [manifestu modułu i esmodules](https://foundryvtt.com/article/module-development/), [ApplicationV2](https://foundryvtt.com/api/classes/foundry.applications.api.ApplicationV2.html) i HandlebarsApplicationMixin. Identyfikator modułu musi odpowiadać nazwie katalogu instalacyjnego.
Nie wpisujemy `compatibility.verified` przed testem w docelowym Foundry.

Zapis następuje przez `CONFIG.Actor.documentClass.create`, po podglądzie, wyłącznie dla GM. To [klasa dokumentu Actor](https://foundryvtt.com/api/classes/foundry.documents.Actor.html) zapewnia integrację z modelem systemu i cyklem dokumentów. Import jest sekwencyjny, aby raportować wynik każdego aktora. Nie ma automatycznego rollbacku całej partii.

## Modele CoC7

Pola sprawdzone w tagu 8.16:

- [global-system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/actor/global-system.js): `system.characteristics.<str|con|siz|dex|app|int|pow|edu>.value`, `system.attribs.<hp|mp|san|mov|lck>`. HP i MP mają `value`, `max`, `auto`.
- [npc-system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/actor/npc-system.js): `system.description.keeper` i model NPC.
- [creature-system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/actor/creature-system.js): dziedziczy model NPC.
- [character-system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/actor/character-system.js): postać gracza również korzysta ze wspólnych cech i zasobów; pozostałe dane postaci inicjalizuje CoC7.
- [vehicle-system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/actor/vehicle-system.js): pojazd ma osobne `system.stats.hp`, `mov`, `build.value/current` i `armor.value`.

## Gotowe przedmioty i nazwy PL–EN

Wersja 0.2.0 wymaga wyboru jednego z czterech typów w modalnym DialogV2 przed otwarciem importera. `container` pozostaje poza zakresem.

Przejrzano lokalny przykładowy eksport BN dostarczony przez użytkownika. Eksport potwierdza osadzone `items`, flagi `flags.CoC7.cocidFlag` oraz broń wskazującą umiejętność przez `system.skill.main.id` i `name`. Pliku użytkownika ani jego opisów nie kopiujemy do repozytorium.

[Model umiejętności](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/item/skill-system.js) wylicza wartość z sumy `system.adjustments`. Przy wpisanym procencie ustawiamy `base` i `adjustments.base`, a pozostałe przyrosty zerujemy. [Model broni](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/item/weapon-system.js) wskazuje główną i alternatywną umiejętność przez `skill.main` i `skill.alternativ`.

Katalog obejmuje świat, osadzone przedmioty aktorów i indeksy kompendiów. Dopasowanie używa zapisanych UUID, zgodnych nazw, ograniczonego słownika PL–EN i stabilnych CoCID. Ogólnych CoCID typu `language-any` nie używamy do łączenia różnych specjalizacji. Niejednoznaczne wyniki wymagają wyboru. Wskazania są zapisywane lokalnie w ustawieniu świata `itemAliases`; nie korzystamy z usług tłumaczenia.

Przed zapisem przygotowywane są wszystkie kopie przedmiotów. Dostają nowe ID, a broń jest przepinana na ID właściwych umiejętności. Jedno wywołanie Actor.create otrzymuje gotowe `items` i `keepEmbeddedIds: true`, zgodnie z [DatabaseCreateOperation](https://foundryvtt.com/api/interfaces/foundry.abstract.types.DatabaseCreateOperation.html). Opisy, obrażenia i koszty pochodzą z wzorców. Nie zmieniamy oryginałów.

## Istniejący importer

CoC7 zawiera [actor-importer.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/apps/actor-importer.js) oraz [parser PL/EN i innych języków](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/apps/actor-importer-regexp.js). Importuje pojedynczą postać, obsługuje przedmioty i konwersję edycji, ma tryb `testMode`.

W sprawdzonych plikach [init](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/hooks/init.js) i [system.js](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/system.js) importer nie jest wystawiony jako publiczne API dla modułów. Nie zakładamy, że pliki źródłowe `coc7/apps` są dostępne w zbudowanej instalacji. W prototypie używamy własnego, ograniczonego parsera i adaptera danych. Integracja pełnego importera wymaga uzgodnionego API lub świadomego wydzielenia zależności i uwzględnienia licencji GPL-3.0.

## PDF i wybór stron

[PDF.js](https://mozilla.github.io/pdf.js/examples/) udostępnia dokument, stronę przez `getPage(n)` i ekstrakcję tekstu. Biblioteka i worker są dołączane do paczki lokalnie. Użytkownik jawnie wybiera zakres stron pliku, np. `3, 7-9, 12`; parser odrzuca puste, odwrócone i nieistniejące zakresy. Tylko wybrane strony trafiają do ekstrakcji.

Ekstrakcja nie gwarantuje kolejności czytania kolumn. Użytkownik sprawdza tekst i stawia separator `---` między postaciami. Skany bez warstwy tekstowej wymagają OCR poza prototypem. Nie wysyłamy podręczników do usług zewnętrznych.

## Weryfikacja przed oznaczeniem kompatybilności

1. Włączyć moduł w testowym świecie Foundry 14.364 / CoC7 8.16 jako GM.
2. Sprawdzić otwarcie okna z ustawień i katalogu aktorów.
3. PDF z postaciami na kilku stronach: wybrać nieciągły zakres i sprawdzić, że tekst z pozostałych stron nie trafił do podglądu.
4. Sprawdzić wszystkie cztery typy: postać gracza, BN, stworzenie i pojazd, w tym obowiązkowy modal i anulowanie wyboru.
5. Zmienić zakres po odczycie, sprawdzić unieważnienie danych i blokadę importu bez nowego podglądu.
6. Sprawdzić duplikat nazwy i częściowy błąd zapisu; ponowienie ma ominąć udane wiersze.
7. Dopasować polską umiejętność i broń do angielskich wzorców, polskie zaklęcie do polskiego wzorca; sprawdzić kopie opisów i mechaniki oraz poprawność ID umiejętności broni.
8. Sprawdzić zapamiętanie i zmianę pary nazw, pominięcie przedmiotu, usunięty wzorzec, kilka równorzędnych dopasowań i sprzeczne wartości jednej umiejętności.

Testy jednostkowe obejmują zakresy, ekstrakcję na atrapach PDF, parser i zapis na atrapach Foundry. Test w uruchomionym Foundry pozostaje osobnym krokiem.
