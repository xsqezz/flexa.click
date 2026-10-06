# Podstawowy katalog produktów

150 pozycji w `shared/polish-catalog.ts` to zakres wymagany przez użytkownika,
nie potwierdzony ranking popularności Fitatu. Po 25 pozycji przypada na nabiał,
mięso/ryby, pieczywo/zboża, przekąski, napoje i dodatki.

Rekordy z kodami i wartościami pochodzą z Open Food Facts, nie z bazy Fitatu.
Podstawą jest ograniczony eksport produktów oznaczonych `en:poland` z oficjalnego
[Open Food Facts Query](https://query.openfoodfacts.org/docs). Wybrane luki mogą
być uzupełnione wynikami nazw z publicznego API, również dla innych rynków.
Polskie rekordy są preferowane. Kod nigdy nie jest dopasowywany do podobnego
produktu ani wymyślany dla produktu ogólnego.

`app/public/data/polish-products.json` jest publicznym eksportem adaptowanej
bazy na **ODbL 1.0**, z atrybucją **Open Food Facts contributors**, źródłem
i datą pobrania w samym pliku. Warunki:
https://opendatacommons.org/licenses/odbl/1-0/
Nie pobieramy zdjęć. Źródłowa baza pozostaje społecznościowa, niepełna
i nie jest certyfikowanym źródłem medycznym.

Aktualizacja z zapisanego, źródłowego eksportu:

```powershell
node scripts\import-polish-catalog.mjs C:\path\to\official-export.json
```

Importer raportuje oddzielnie pokrycie 150 pozycji, liczbę prawdziwych kodów
i liczbę rekordów z energią. Nieznanych wartości nie zastępuje zerem.
Obsługiwane są starsze `nutriments` i nowa struktura `nutrition.aggregated_set`.
Do zestawu per 100 g / 100 ml nie trafiają wartości per porcję lub po
przygotowaniu. Wartości źródłowo szacunkowe są oznaczone.

Katalog nie obiecuje wszystkich opakowań i smaków danej marki. Rekord bez
energii można rozpoznać, ale przed wpisem do dziennika trzeba uzupełnić etykietę.
Produkty spoza katalogu nadal korzystają z zapytania online. Własne produkty
użytkownika mają pierwszeństwo i nie są publikowane.
