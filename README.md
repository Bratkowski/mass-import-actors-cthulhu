# Masowy import aktorów CoC7

Moduł Foundry VTT do masowego importu aktorów z tekstu lub **wybranych stron PDF**, z przypisywaniem gotowych umiejętności, broni i zaklęć.

Cel: **Foundry VTT 14.364 + system CoC7 8.16**. Wersja 0.2.1 jest wersją rozwojową.
Testy automatyczne nie zastępują testu w działającym Foundry. Nie oznaczamy jeszcze wersji jako `verified` w manifeście.

## Instalacja w Forge Bazaar

1. Otwórz **Bazaar → Install from Manifest** (instalacja własnego modułu).
2. Wklej ten adres do pola **Manifest URL**:

   ```text
   https://github.com/Bratkowski/mass-import-actors-cthulhu/releases/latest/download/module.json
   ```

3. Kliknij **Install**. Użyj instalacji z podanego manifestu, jeżeli Forge proponuje zamiast niej instalację wersji z katalogu Bazaar.
4. Uruchom świat z systemem CoC7 8.16. W **Zarządzaniu modułami / Manage Modules** włącz **CoC7 — Masowy import aktorów** i zapisz zmiany.

Ten sam adres działa w standardowym Foundry: **Add-on Modules → Install Module → Manifest URL**.
Link do głównej strony repozytorium GitHub służy do przeglądania kodu; do instalacji używa się powyższego linku do manifestu. Paczka ZIP zawiera już bibliotekę PDF.js.

To instalacja własnego modułu przez Bazaar. Moduł nie został jeszcze zgłoszony do publicznej wyszukiwarki pakietów Forge/Foundry.
Przy aktualizacjach używaj sprawdzania aktualizacji modułów; stały adres manifestu wskazuje najnowsze opublikowane wydanie.

## Instrukcja obsługi

1. Otwórz **Ustawienia gry → Konfiguracja ustawień → Masowy import aktorów CoC7**. Możesz też użyć przycisku w katalogu aktorów.
2. **W pierwszym oknie modalnym wybierz typ aktorów**. Nie ma domyślnie wybranego typu. Zamknięcie okna anuluje rozpoczęcie importu. Typ dotyczy całej partii:

   | Wybór w oknie | Typ CoC7 | Dane |
   | --- | --- | --- |
   | Postacie graczy (Badacze) | `character` | Cechy, zasoby, przedmioty |
   | BN — bohaterowie niezależni | `npc` | Cechy, zasoby, przedmioty |
   | Potwory i stworzenia | `creature` | Cechy, zasoby, przedmioty |
   | Pojazdy | `vehicle` | PW, Ruch, Krzepa, Pancerz, przedmioty |

3. Kliknij **Dalej — wybierz PDF i strony**. Wybierz plik przyciskiem albo upuść jeden PDF w oznaczonym obszarze. Moduł pokaże nazwę pliku i liczbę stron.
4. Wpisz zakres, np. `3, 7-9, 12`. Są to **strony pliku liczone od 1**, a nie numeracja wydrukowana w książce. Puste pole nie wybiera żadnej strony. Jeśli wydrukowana strona 10 jest stroną 14 pliku, wpisz `14`.
5. Kliknij **Odczytaj wybrane strony**. Tylko te strony trafią do ekstrakcji tekstu. Otwarcie PDF odczytuje też strukturę dokumentu.
6. Sprawdź tekst. Pierwsza linia każdego bloku musi być nazwą aktora. Oddziel aktorów linią `---`. Granica strony nie oznacza nowego aktora. Usuń nagłówki i stopki, popraw kolejność kolumn, a sekcje uporządkuj według przykładu poniżej.
7. Wybierz folder docelowy. Kliknij **Przygotuj podgląd**. Odczyt katalogu dużych kompendiów może chwilę potrwać.
8. Sprawdź cechy, ostrzeżenia oraz wszystkie dopasowania **nazwa z PDF → gotowy przedmiot**. Nierozpoznane nazwy rozstrzygnij przyciskiem **Wybierz / zmień / pomiń**; szczegóły w następnej sekcji.
9. Zaznacz aktorów do importu i kliknij **Importuj zaznaczone postacie**. Nierozstrzygnięte przedmioty zaznaczonych aktorów blokują rozpoczęcie zapisu. Możesz odznaczyć aktora i zaimportować pozostałych.
10. Wynik pojawi się przy każdym aktorze. Przy częściowym błędzie można ponowić import w tym samym podglądzie — już utworzeni aktorzy są pomijani.

Aby zmienić typ aktorów, zamknij importer i rozpocznij nową partię. Możesz też wkleić tekst ręcznie bez wybierania PDF. Jeśli plik jest już wczytany, najpierw trzeba odczytać jego wybrane strony.

Zmiana pliku lub zakresu unieważnia poprzedni podgląd. Zmiana zakresu po odczycie usuwa również tekst poprzedniego odczytu.
PDF jest przetwarzany w przeglądarce; moduł nie wysyła pliku do zewnętrznej usługi. Skany wymagają wcześniejszego OCR.

## Polskie nazwy w PDF, angielskie umiejętności i broń

Przy podglądzie importer buduje katalog z **Przedmiotów świata**, przedmiotów już istniejących aktorów oraz dostępnych kompendiów typu Item. Nie musisz wcześniej importować całego kompendium do świata.

Dopasowanie działa w tej kolejności:

1. Zapamiętane przez Ciebie wskazanie konkretnego przedmiotu (UUID).
2. Zgodna nazwa, wbudowany słownik najczęstszych umiejętności PL–EN albo wspólny CoCID. Pomijamy różnice wielkości liter i polskich znaków. Przykładowo `Spostrzegawczość` pasuje do `Spot Hidden`, a `Nasłuchiwanie` do `Listen`.
3. Gdy nie ma pewnego wyniku lub jest kilka równorzędnych — wybór ręczny. Przedmioty świata mają pierwszeństwo przed kompendiami i kopiami u aktorów. Flagi języka preferują angielskie umiejętności i broń oraz polskie zaklęcia.

**CoCID** to identyfikator CoC7, np. `i.skill.spot-hidden`; może łączyć polską i angielską wersję tego samego przedmiotu. Ogólne CoCID-y typu `language-any` nie wystarczają do utożsamienia różnych języków.

### Jak nauczyć moduł własnej pary nazw

1. Przy pozycji z PDF, np. `Rewolwer .38`, kliknij **Wybierz / zmień / pomiń**.
2. Wyszukaj angielską nazwę, np. `Revolver`. Lista pokazuje nazwę i źródło przedmiotu; zawęź wyszukiwanie, jeśli wyników jest dużo.
3. Wybierz właściwy model, sprawdź kaliber i wariant. Dla polskich zaklęć szukaj polskiej nazwy.
4. Pozostaw zaznaczone **Zapamiętaj tę parę nazw w tym świecie** i zastosuj dopasowanie. Kolejne podglądy użyją tego wskazania. Aby poprawić parę, wybierz inny przedmiot i ponownie ją zapamiętaj.

Jeśli nie masz właściwego przedmiotu, wybierz **Pomiń — zachowaj tylko w notatkach**. To pominięcie dotyczy bieżącego podglądu. Możesz też zamknąć importer, przygotować przedmiot w świecie i rozpocząć nowy podgląd.

Moduł nie tłumaczy automatycznie całej książki ani nie zgaduje wariantu broni na podstawie podobieństwa nazw. Nie ma pełnego słownika wszystkich nazw zaklęć. Ręczne wskazania uzupełniają różnice tłumaczeń i nazwy własne używane w Twoim świecie.

### Co jest kopiowane

Umiejętności, broń i zaklęcia są kopiowane jako osadzone przedmioty aktora, z opisami, grafikami i mechaniką wzorca. Oryginały pozostają bez zmian. Wartość bazowa umiejętności jest ustawiana z procentu w PDF, bez dodawania punktów doświadczenia poprzedniego właściciela.

Broń musi wskazywać umiejętność **nowego aktora**. W podglądzie pojawią się dodatkowe wiersze umiejętności wymaganych przez wybrany wzorzec broni. Rozstrzygnij również te wiersze. Nie można pominąć wymaganej umiejętności i jednocześnie importować korzystającej z niej broni.

Wartość procentowa ataku z PDF trafia do głównej umiejętności broni. Dwie różne wartości przypisane tej samej umiejętności powodują błąd zamiast cichego nadpisania. **Obrażenia, zasięgi, amunicja i koszty zaklęć pochodzą z gotowego wzorca**; podane w PDF szczegóły ataku pozostają w notatkach do porównania.

## Zakres prototypu

- Typy `character`, `npc`, `creature` i `vehicle`; `container` nie jest częścią tego importera.
- Cechy PL/EN: `STR / S / SIŁ`, `CON / KON`, `SIZ / BC`, `DEX / ZR`, `APP / WYG`, `INT`, `POW / MOC`, `EDU / WYK`.
- Zasoby: `HP / PW`, `MP / PM`, `SAN / P / POC`, `MOV / Ruch`, `LUCK / Szczęście`.
- Przy jawnych PW i PM wyłącza autoobliczanie ich maksimum.
- Pełny tekst trafia do notatek Strażnika. Umiejętności, broń i zaklęcia są kopiowane po dopasowaniu. Pancerz pojazdu trafia do `stats.armor`; pancerz postaci, liczba ataków, utrata Poczytalności oraz pozostałe nierozpoznane pola pozostają w notatkach.
- Brak automatycznej konwersji 6e → 7e. Podawaj wartości 7. edycji.
- Mniej niż 3 rozpoznane cechy lub powtórzone statystyki blokują import postaci/stworzenia. Pojazd wymaga co najmniej jednego obsługiwanego parametru.
- Aktorzy o istniejącej nazwie są domyślnie odznaczeni. Import zawsze tworzy nowe dokumenty.
- Raport jest widoczny przy każdej postaci. Ponowienie po błędzie pomija udane wiersze w bieżącym podglądzie.

Przykład (fikcyjne dane, bez treści podręcznika):

```text
Jan Przykładowy
S 50 KON 60 BC 55 ZR 60 WYG 65 INT 70 MOC 60 WYK 75
PW 11 PM 12 P 60 Ruch 8
Umiejętności: Spostrzegawczość 60%, Nasłuchiwanie 50%, Broń Palna (Krótka) 55%
Walka
Rewolwer .38 55% (27/11), obrażenia 1K10
Unik 30%
Zaklęcia: Znak Starszych Bogów; Ochrona ciała
---
Istota Przykładowa
STR 90 CON 80 SIZ 95 DEX 50 APP 20 INT 40 POW 60 EDU 0
HP 17 MP 12 MOV 7
```

Sekcje `Umiejętności`, `Walka`/`Broń` i `Zaklęcia` mogą mieć angielskie odpowiedniki `Skills`, `Combat`/`Weapons`, `Spells`. Umiejętności podawaj jako `Nazwa 50%`, rozdzielone przecinkiem, średnikiem lub nową linią. Każdy atak lub broń umieść w osobnym wierszu. Zaklęcia rozdziel przecinkiem, średnikiem lub nową linią. Nazwy zaklęć zawierające przecinki ujmij w proste cudzysłowy, np. `"Nazwa, wariant"`.

Pojazdy importuj w osobnej partii, np.:

```text
Samochód Przykładowy
PW 30 Ruch 10 Krzepa 2 Pancerz 3
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

GitHub Actions uruchamia testy i przygotowuje artefakt do pobrania. Na GitHubie otwórz **Actions → Check and package → zakończony przebieg → Artifacts → mass-import-actors-cthulhu**. Rozpakuj artefakt tak, aby `module.json` znajdował się bezpośrednio w `Data/modules/mass-import-actors-cthulhu/`.

Gotowe paczki i manifesty są także dostępne w [GitHub Releases](https://github.com/Bratkowski/mass-import-actors-cthulhu/releases). Uruchomienie w świecie wymaga konta GM. Wersja rozwojowa obsługuje dokładnie CoC7 8.16.

Publikacja następnej wersji: zaktualizuj wersję w `module.json` i `package.json`, adres `download` oraz `docs/release-notes.md`, a następnie wypchnij tag `vX.Y.Z`. Workflow wydania uruchomi testy, zbuduje i sprawdzi paczkę, a potem opublikuje `module.json` i `module.zip` w GitHub Release.

## Rozwiązywanie problemów

| Objaw | Co zrobić |
| --- | --- |
| Brak tekstu na wybranej stronie | PDF może być skanem. Przygotuj warstwę OCR poza modułem. |
| Wczytano tekst z niewłaściwej strony | Sprawdź numer strony pliku, a nie numer wydrukowany w książce. |
| Powtórzona cecha, np. STR | Oddziel postacie linią `---` lub usuń zduplikowaną tabelę statystyk. |
| Brak dopasowania polskiej nazwy | Wyszukaj przedmiot ręcznie, wskaż właściwy wzorzec i zapamiętaj parę nazw. |
| Zapamiętany przedmiot nie jest już dostępny | Jego UUID się zmienił lub źródło usunięto. Wskaż nowy przedmiot. |
| Broń nie może być zaimportowana | Sprawdź dodatkowe wiersze wymaganych umiejętności i sprzeczne wartości procentowe. |
| Import utworzył część aktorów | Popraw wskazane błędy i ponów w tym samym podglądzie. Nowy podgląd to nowa partia i może utworzyć duplikaty. |
| Brak PDF.js | Użyj gotowego artefaktu lub wykonaj build. Sam kod pobrany z repo nie zawiera biblioteki PDF.js. |

## Dalszy rozwój

Następne kroki: test w Foundry 14.364 / CoC7 8.16, automatyczne wykrywanie bloków w wielokolumnowych podręcznikach, podgląd stron, rozbudowa słownika i edycja pozostałych parametrów statystyk.
Ustalenia techniczne i źródła: [docs/research.md](docs/research.md).
