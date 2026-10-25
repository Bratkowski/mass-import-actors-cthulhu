# Import JSON i katalog Items — CoC7 8.16

Moduł obsługuje `character`, `npc`, `creature` i `vehicle`, zgodnie z [manifestem CoC7 8.16](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/static/system.json). Typ partii wybiera użytkownik w modalnym DialogV2.

## Dane wejściowe

Tablica eksportów Actor zachowuje pola `name`, `img` i `system`. Kopiujemy system jako dane CoC7, bez odgadywania statystyk. Nie przenosimy identyfikatorów, folderu, ownership, metadanych, prototypeToken ani flag wyboru arkusza starego aktora. Niepuste efekty aktora są zgłaszane jako błąd zamiast pomijania ich po cichu.

Osadzone `items` eksportu są listą żądanych umiejętności, broni i zaklęć. Wzorce pochodzą z Items świata. Procent umiejętności wyliczamy z sumy `system.adjustments`, tak jak [model skill-system](https://github.com/Miskatonic-Investigative-Society/CoC7-FoundryVTT/blob/8.16/coc7/models/item/skill-system.js), z obsługą starszego `system.value` i liczbowego `system.base`. Uproszczona lista używa jawnego `value`.

## Źródła przedmiotów

Jedynym źródłem wzorców jest `game.items`. Wyszukiwarka i przeciąganie akceptują wyłącznie UUID `Item.<id>`. Odrzucamy UUID osadzonych przedmiotów aktorów i kompendiów także na etapie zapisu, a nie tylko w interfejsie. Do odczytu danych przeciągania używamy [TextEditor.getDragEventData](https://foundryvtt.com/api/classes/foundry.applications.ux.TextEditor.html).

Kopie mają nowe ID i zachowują mechanikę wybranego wzorca. Wartość umiejętności pochodzi z danych aktora, nigdy z przyrostów poprzedniego właściciela. Powiązania `system.skill.main` i `alternativ` broni odtwarzamy przez relacje starych ID w JSON oraz nowe ID kopii umiejętności. Identyczne wzorce mogą mieć różne procenty u różnych aktorów.

Zapis wszystkich przedmiotów aktora następuje wraz z Actor.create przy `keepEmbeddedIds: true`. Wszystkie wzorce i powiązania są sprawdzane przed utworzeniem aktora. Udany wiersz nie jest ponawiany w tym samym podglądzie.

Przykładowy eksport użytkownika służy wyłącznie do lokalnej weryfikacji; nie jest częścią repozytorium ani paczki.
