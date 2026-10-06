# Supabase Auth i weryfikacja e-mail przez Brevo

Ta instrukcja i szablon nie oznaczają, że zewnętrzny projekt lub SMTP
są już uruchomione. Konfiguracja wymaga istniejącego projektu Flexa.
Nie używaj backendu innej aplikacji bez decyzji jego właściciela.

## Projekt Supabase

Utwórz osobny projekt Free w regionie europejskim. Hasło bazy ustaw bezpośrednio
w Supabase i zachowaj w swoim menedżerze haseł, nie w repozytorium ani na czacie.
Pozostaw Data API włączone, wyłącz automatyczne udostępnianie nowych tabel
i włącz automatyczne RLS. Następnie zastosuj migrację z instrukcji DEPLOYMENT.md.

W Authentication > Providers > Email pozostaw rejestrację i potwierdzanie
adresu włączone. Nie wyłączaj potwierdzenia, żeby ominąć brak działającej poczty.

## SMTP Brevo

W Brevo otwórz Settings > SMTP & API > SMTP. Supabase potrzebuje danych SMTP,
nie ogólnego klucza API Brevo:

| Pole w Supabase | Wartość |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | dokładny login SMTP pokazany przez Brevo |
| Password | klucz SMTP, zapisany wyłącznie w konfiguracji serwera |
| Sender email | adres zweryfikowanego nadawcy Brevo |
| Sender name | `Flexa` |

Nie zakładaj, że login SMTP to adres, którym logujesz się do panelu.
Nie umieszczaj hasła SMTP w zmiennych `VITE_*`, GitHub Pages ani plikach Git.

Zweryfikowanie nadawcy nie zastępuje uwierzytelnienia domeny. Adres Gmail
nie daje właścicielowi aplikacji kontroli nad DNS Gmaila i może powodować
ostrzeżenia lub problemy z dostarczalnością. Do produkcji użyj własnego adresu
i ustaw DKIM oraz DMARC zgodnie z rzeczywistymi rekordami podanymi przez Brevo.
Nie dodawaj rekordów dla domeny, której nie kontrolujesz.

## Treść i linki potwierdzenia

Polski szablon: `supabase/templates/confirmation.html`.
Poczta celowo używa systemowego fontu i rozmiarów w pikselach dla zgodności
z klientami pocztowymi, zamiast przenosić webowy układ i jego skalę typografii.
W Supabase Authentication > Email Templates > Confirm signup ustaw temat:
`Potwierdź adres e-mail we Flexa`, a zawartość skopiuj z szablonu.
Zachowaj `{{ .ConfirmationURL }}`: Supabase tworzy właściwy link z tokenem.
Nie wpisuj na sztywno tokenów, adresu `/demo` ani cudzej domeny.

Site URL i dozwolone redirecty muszą wskazywać działającą aplikację z kontami,
nie obecny build demonstracyjny Pages. Wersja z kontami używa normalnego
builda aplikacji, publicznego klucza Supabase oraz poprawnie uzupełnionych
danych administratora prywatności. Klucz service-role pozostaje na serwerze.

## Potwierdzenie działania

Po zapisaniu SMTP wykonaj pojedynczą autoryzowaną rejestrację testową:
wiadomość powinna pojawić się w logach transakcyjnych Brevo, dotrzeć do
odbiorcy, a po kliknięciu potwierdzenia konto powinno móc się zalogować.
Sprawdź również folder spam i dokładny adres przekierowania.
Sam zapis ustawień nie jest potwierdzeniem wysłania lub dostarczenia.

Limity poczty w Supabase dopasuj do rzeczywistego planu Brevo i interwału
ponownego wysyłania. Nie kupuj wyższego planu ani nie zwiększaj limitów bez
decyzji właściciela.
