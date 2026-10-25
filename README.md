# Masowy import aktorów CoC7

Moduł Foundry VTT do importu NPC i stworzeń z tekstu lub **wybranych stron PDF**.

Cel: **Foundry VTT 14.364 + system CoC7 8.16**. Wersja 0.1.0 jest prototypem.
Testy automatyczne nie zastępują testu w działającym Foundry. Nie oznaczamy jeszcze wersji jako `verified` w manifeście.

## Wybór stron PDF

1. Otwórz **Ustawienia gry → Konfiguracja ustawień → Masowy import aktorów CoC7**. Możesz też użyć przycisku w katalogu aktorów.
2. Wybierz lokalny plik PDF. Moduł pokaże liczbę stron.
3. Wpisz zakres, np. `3, 7-9, 12`. Są to **strony pliku liczone od 1**, a nie numeracja wydrukowana w książce. Puste pole oznacza brak wyboru.
4. Kliknij **Odczytaj wybrane strony**. Tylko wskazane strony są odczytywane jako tekst; otwarcie pliku odczytuje strukturę dokumentu.
5. Popraw tekst: pierwsza linia bloku to nazwa, a postacie rozdziel linią `---`. Granica strony nie oznacza nowej postaci. Usuń nagłówki, stopki i popraw układ kolumn.
6. Przygotuj podgląd, sprawdź ostrzeżenia, wybierz postacie i folder, a następnie importuj.

Zmiana pliku lub zakresu unieważnia poprzedni podgląd. Zmiana zakresu po odczycie usuwa również tekst poprzedniego odczytu.
PDF jest przetwarzany w przeglądarce; moduł nie wysyła pliku do zewnętrznej usługi. Skany wymagają wcześniejszego OCR.

## Zakres prototypu

- Typy `npc` i `creature`.
- Cechy PL/EN: `STR / S / SIŁ`, `CON / KON`, `SIZ / BC`, `DEX / ZR`, `APP / WYG`, `INT`, `POW / MOC`, `EDU / WYK`.
- Zasoby: `HP / PW`, `MP / PM`, `SAN / P / POC`, `MOV / Ruch`, `LUCK / Szczęście`.
- Przy jawnych PW i PM wyłącza autoobliczanie ich maksimum.
- Pełny tekst trafia do notatek Strażnika. **Umiejętności, broń, pancerz i zaklęcia nie są jeszcze tworzone jako dane mechaniczne.**
- Brak automatycznej konwersji 6e → 7e. Podawaj wartości 7. edycji.
- Mniej niż 3 rozpoznane cechy lub powtórzone statystyki blokują import bloku.
- Aktorzy o istniejącej nazwie są domyślnie odznaczeni. Import zawsze tworzy nowe dokumenty.
- Raport jest widoczny przy każdej postaci. Ponowienie po błędzie pomija udane wiersze w bieżącym podglądzie.

Przykład (fikcyjne dane, bez treści podręcznika):

```text
Jan Przykładowy
S 50 KON 60 BC 55 ZR 60 WYG 65 INT 70 MOC 60 WYK 75
PW 11 PM 12 P 60 Ruch 8
---
Istota Przykładowa
STR 90 CON 80 SIZ 95 DEX 50 APP 20 INT 40 POW 60 EDU 0
HP 17 MP 12 MOV 7
```

## Przygotowanie paczki

Potrzebny jest Node.js 22+ i polecenie `tar` (Windows 10/11 i Linux). Bez instalowania zależności npm:

```sh
npm test
npm run build
```

Build pobiera przypięte PDF.js 5.4.624 z npm i sprawdza SHA-512. Kolejne buildy używają lokalnego cache.
Gotowy katalog to `dist/mass-import-actors-cthulhu`. Skopiuj go do `<Foundry User Data>/Data/modules/`, a następnie włącz moduł w świecie CoC7.
Pliki PDF, cache, biblioteka dostawcy i paczki wynikowe są pomijane w Git.

GitHub Actions uruchamia testy i przygotowuje artefakt do pobrania. Manifest instalacyjny online i automatyczne aktualizacje pojawią się po pierwszym wydaniu GitHub Release.

## Dalszy rozwój

Następne kroki: test w Foundry 14.364 / CoC7 8.16, import umiejętności i broni, wykrywanie bloków w wielokolumnowych podręcznikach, podgląd stron i obsługa kontynuacji postaci.
Ustalenia techniczne i źródła: [docs/research.md](docs/research.md).
