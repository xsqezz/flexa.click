export type ChangelogEntry = { date: string; title: string; points: string[] }

/** Newest first. Keep entries factual: what a user can now do, not internal work. */
export const changelog: ChangelogEntry[] = [
  {
    date: '2026-10-11',
    title: 'Same kcal i powtórz dzień',
    points: [
      'W „Dodaj posiłek” → „Same kcal” zapiszesz posiłek, o którym znasz tylko kalorie (np. z menu restauracji). Makroskładniki są opcjonalne.',
      'W Posiłkach, gdy dzień jest pusty, „Powtórz dzień” kopiuje cały wcześniejszy dzień — do poprawienia, jeśli było trochę inaczej.',
    ],
  },
  {
    date: '2026-10-11',
    title: 'Szybki wpis',
    points: [
      'Napisz lub podyktuj, co zjadłeś („dwa jajka sadzone, 200 g ryżu i szklanka mleka”) — Flexa zamieni to na listę z kaloriami do sprawdzenia i zapisania w Posiłkach.',
      'Działa bez AI i bez wysyłania tekstu: zdanie jest rozkładane na Twoim urządzeniu, a słowa spoza bazy są wyraźnie zgłaszane.',
    ],
  },
  {
    date: '2026-10-10',
    title: 'Android: udostępnianie zdjęć do Skanu',
    points: [
      'W aplikacji na Androida (1.3.0) wybierz zdjęcie w galerii, dotknij „Udostępnij” i Flexa, a Skan posiłku otworzy się z tym zdjęciem.',
      'Zdjęcie jest zmniejszane i pozbawiane danych lokalizacji na telefonie, a Flexa go nie zapisuje.',
    ],
  },
  {
    date: '2026-10-09',
    title: 'Trend wagi, plan tygodnia i lista zakupów',
    points: [
      'W Celach zobaczysz podsumowanie cyklu oraz propozycję małej korekty kalorii, gdy trend wagi odbiega od założeń. Nic nie zmienia się bez Twojego zatwierdzenia.',
      'Plan tygodnia: rozplanuj posiłki z zapisanych zestawów i zapisz cały dzień w dzienniku jednym dotknięciem.',
      'Lista zakupów: dodawaj brakujące składniki z przepisów Smart Kuchni albo własne pozycje; działa bez internetu.',
      'Najczęstsze produkty są na górze listy przy dodawaniu posiłku, a Skan pamięta Twoje zwykłe porcje.',
      'W historii ćwiczeń pojawiły się rekordy osobiste i spokojne podpowiedzi na następny trening.',
    ],
  },
  {
    date: '2026-10-09',
    title: 'Nowy wygląd i nawigacja',
    points: [
      'Zakładki: Cele, Posiłki, Kuchnia, Dodaj, Treningi, Ruch i Postępy. Dzisiaj zastąpiły Cele.',
      'Zaokrąglone kafelki, pastelowe kolory i łagodne animacje. Flexa ma teraz jeden, jasny motyw (bez trybu ciemnego).',
    ],
  },
  {
    date: '2026-10-08',
    title: 'Skan posiłku',
    points: [
      'Zdjęcie tacy lub talerza zamienia się w listę pozycji z kaloriami w zakresie. Baza ma ponad 8 700 pozycji, w tym menu McDonald\'s, Burger King i KFC w Polsce.',
    ],
  },
]