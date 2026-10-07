export type ExerciseVideo = { id: string; title: string; channel: string; lang: string }

const CONSENT_KEY = 'flexa:youtube'

const video = (id: string, title: string, channel: string, lang = 'pl'): ExerciseVideo => ({ id, title, channel, lang })
const jumpingJacks = video('yC15l7aqXx0', 'Pajacyki - zobacz, jak prawidłowo wykonywać to popularne ćwiczenie', 'Drużyna Energii')
const catCow = video('ffxz83LANnY', 'Kocie grzbiety / Cat Cow', 'Trener Paweł Pakuła')
const deadBug = video('e2Rt8jqO3HY', 'SILNA PRO | Dead Bug | technika i wykonanie', 'Karolina Kałuża')
const dumbbellRow = video('Ihtkzra1nFk', 'Wiosłowanie w podparciu hantlem', 'Myfitweb')
const hipThrust = video('ezEQkeQWMPM', 'HIP THRUST - Podstawowe ćwiczenie na pośladki', 'ProFi Academy')
const bodyweightSquat = video('dpGBAZBzCo0', 'Przysiady z ciężarem własnego ciała', 'Karta MultiSport')
const splitSquat = video('cxdcy6u0G24', 'Przysiad wykroczny / Split Squat', 'Trener Paweł Pakuła')
const stepUp = video('kwPsKLaM5vM', 'Wejścia na stopień z obciążeniem.', 'TI FITNESS')
const calfRaise = video('B7wWr1RGadg', 'Wspięcia na palce stojąc / Calf raises', 'Trener Paweł Pakuła')
const hipHinge = video('RFXwyfzrpsM', 'Hip Hinge (zawias biodrowy) – podstawowe ćwiczenie dla początkujących i sportowców', 'Centrum Ruchu Perfecto')
const pullThrough = video('jxM-QhknE-o', 'BAND PULL THROUGH - Wypychanie miednicy stojąc z gumą', 'TRAINERON')
const gluteBridge = video('6DMwHvSngWQ', 'Mostek biodrowy / Glute Bridge', 'Trener Paweł Pakuła')

/**
 * Instructional videos, each verified with YouTube oEmbed (the video exists and allows embedding).
 * Variants of the same movement intentionally share one demonstration.
 */
export const exerciseVideos: Record<string, ExerciseVideo> = {
  'jumping-jacks': jumpingJacks,
  'wu-jumping-jack': jumpingJacks,
  'cat-cow': catCow,
  'wu-cat-cow': catCow,
  'dead-bug': deadBug,
  'wu-dead-bug': deadBug,
  'goblet-squat-db': video('ESeQVOgVORc', 'Przysiad z hantlem (goblet squat)', 'Karta MultiSport'),
  'goblet-squat-kb': video('Yx2yaznmPHc', 'Goblet squat – przysiad z kettlem lub hantelką', 'Fit Expert'),
  'bulgarian-split-squat-db': video('a8W5GnRKiQM', 'Przysiad bułgarski z hantlami | Bulgarian Split Squat | (czworogłowe, pośladki)', 'Patryk Konicki'),
  'bulgarian-split-squat': video('ugdepxAT2cw', 'Przysiad bułgarski - poprawna technika - Atlas ćwiczeń', 'FitRepublic'),
  'reverse-lunge-weighted': video('erih7EpsuH4', 'Wykroki w tył z hantlami / zakroki', 'Kobieta Na Bombie'),
  'reverse-lunge': video('-Wk_WZiW8G8', 'Jak wykonać wypad w tył | Reverse Lunge', 'Męski Balans'),
  'chair-squat': video('5zj0_-hSUt8', 'Przysiad do krzesła z hantlem 🍑🔥 Technika krok po kroku!', 'fitfuriapo40 (FIT-POL)'),
  'bodyweight-squat': bodyweightSquat,
  'wu-squat': bodyweightSquat,
  'miniband-squat': video('gM8IAQq51uU', 'Przysiad z gumą na kolanach / Air Squat with mini band', 'Body Condition Center - Trening Personalny'),
  'band-squat': video('Oom0fy-gTLU', 'Przysiad z gumą', 'Fit Expert'),
  'sumo-squat': video('50VuZYrP3i0', 'Sumo Przysiad z Hantlem | Dumbbell Sumo Squat | anthletic.com', 'Anthletic- Ewelina Skorczyk'),
  'pause-squat': video('W0fXQ8YUylk', '#3 Pause Squat + Breathing Squat / Przysiad z Pauzą Technika Wykonanie', 'StudioMocy'),
  'wall-sit': video('91_-eD07ShI', 'Krzesełko przy ścianie / Wall sit exercise', 'Daniel Pytel'),
  'leg-press': video('NIj3jH-mIag', 'Wypychanie nogami na suwnicy, technika #fitporady #sports #gymtips', 'CezaryP'),
  'back-squat-bb': video('WCg1tUgfWOo', 'Przysiad ze sztangą trzymaną na plecach', 'Fit Expert'),
  'front-squat-bb': video('9uaVqRQhWCg', 'Barbell Front Squat | Przysiad przedni ze sztangą', 'Any Fitness Coach'),
  'split-squat': splitSquat,
  'split-squat-db': splitSquat,
  'step-up': stepUp,
  'step-up-db': stepUp,
  'walking-lunge-db': video('B9mC1FQhoQs', 'Wykroki chodzone z hantlami', 'Myfitweb'),
  'lateral-lunge': video('ArjcIG24tic', 'Jak wykonać wykrok boczny | Lateral Lunge', 'Męski Balans'),
  'calf-raise': calfRaise,
  'calf-raise-step': calfRaise,
  'calf-raise-db': calfRaise,
  'calf-raise-machine': video('5LPGlQykNFU', 'Maszyna do wspięć na palce', 'Karta MultiSport'),
  'single-leg-stand': video('3Usyo9UDCE0', 'Ćwiczenie wzmacniające kończyny dolne. Stanie na jednej nodze - dr Marian Majchrzycki', 'dr Marian Majchrzycki - osteopata'),
  'tandem-walk': video('_P6hykdXx_U', 'Tandem Walk Exercise | Fall Prevention & Balance Training in 1 Minute', 'Sehat Te Physiotherapy', 'en'),
  'hip-hinge': hipHinge,
  'wu-hinge': hipHinge,
  'pull-through-band': pullThrough,
  'pull-through-cable': pullThrough,
  'good-morning-band': video('0h-ODIvYtms', '„Dzień dobry” z gumą | Banded Good Morning | (mięśnie dwugłowe)', 'Patryk Konicki'),
  'kb-deadlift': video('g1ZPsxzDsnI', 'PODSTAWY KETTLEBELL | Jak poprawnie wykonać martwy ciąg z kettlem?', 'Faster Setup'),
  'kb-swing': video('v3wnrSluDcw', 'How to Do a Kettlebell Swing PROPERLY | Complete Beginner Tutorial', 'Move Like Human', 'en'),
  'rdl-bb': video('LFSz_gdW-pw', 'Rumuński Martwy Ciąg - PRAWIDŁOWA Technika (Przestań Popełniać Te Błędy)', "Piotr 'Szmexy' Tomaszewski"),
  'deadlift-bb': video('zc3ozITlEro', 'Klasyczny martwy ciąg - poprawna technika wykonania', 'FitRepublic'),
  'back-extension': video('Nqa7o8iUNqE', 'WYPROSTY TUŁOWIA NA ŁAWCE RZYMSKIEJ 🍑 WYJAŚNIJMY w końcu WSZYSTKIE WĄTPLIWOŚCI!', 'Trener Do Celu z Pasją Przemysław Wójcik'),
  'glute-bridge': gluteBridge,
  'glute-bridge-miniband': gluteBridge,
  'wu-bridge': gluteBridge,
  'single-leg-bridge': video('rMYeYyZnpJ8', 'Mostki biodrowe jednonóż / Single leg glute bridge #instruktaż #glutebridge', 'Daniel Pytel'),
  'lateral-band-walk': video('M4cT7TysaQg', 'Chodzenie z mini bandem - do boku - zgięte kolana', 'GETBETTER GYM'),
  clamshell: video('sbDKTNeEknM', 'Muszelka mini band /Clam shell mini band', 'Body Condition Center - Trening Personalny'),
  'hip-abduction-machine': video('I98WsAdt5fQ', 'Odwodzenie nóg na maszynie', 'Fit Expert'),
  'leg-curl-machine': video('fz7VgLKlbcA', 'Uginanie Nóg Na Maszynie Leżąc - Poprawna Technika', 'Dawid Kumala'),
  'towel-leg-curl': video('lJt9GDCd7n0', "Slider leg curl - Uginanie nóg ze slide'ami", '_julia.coach_'),
  'rdl-db': video('cC-JQVoXkWc', 'Rumuński martwy ciąg z hantlami na dwugłowe uda | Hamstring Dumbbell RDL – technika krok po kroku', 'Jacek Lewiński'),
  'rdl-kb': video('6ydWzKgN7CY', 'Rumuński martwy ciąg z hantlami | Dumbbell Romanian Deadlift | (dwugłowe, pośladki)', 'Patryk Konicki'),
  'single-leg-rdl-weighted': video('v0oBi8aOVV8', '#12 Nogi - Martwy ciąg na jednej nodze z hantlem', 'Train Me Now'),
  'single-leg-rdl': video('hBPoprhxFRQ', 'MARTWY CIĄG NA JEDNEJ NODZE - POPRAWNA TECHNIKA', 'ProFi Academy'),
  'hip-thrust-db': video('Ewi3TgWS7pE', 'Wypychanie bioder z hantlą | Dumbbell Hip Thrust | (pośladki)', 'Patryk Konicki'),
  'hip-thrust-couch': hipThrust,
  'hip-thrust-bb': video('O5VbakL1hXw', 'Hip thrust ze sztangą', 'Karta MultiSport'),
  'push-up': video('0rgpUIoFBWU', 'Push-ups / Pompki - Jak robić pompkę? Technika krok po kroku', 'Oskar Krawczyk'),
  'push-up-handles': video('E3h46-Xql9E', 'Jak prawidłowo robić pompki?', 'FitnessPlatinium'),
  'floor-press-db': video('pEX4ycQ29HU', 'DUMBBELL FLOOR PRESS - Wyciskanie hantli na podłodze', 'TRAINERON'),
  'standing-db-press': video('32rybj05WRY', 'Wyciskanie hantli nad głowę stojąc', 'Sebastian Chmielecki Trener Personalny'),
  'seated-db-press': video('ZHH6hV6vhPo', 'Jak wykonać wyciskanie hantli nad głowę | Technika ćwiczenia', 'Męski Balans'),
  'db-row': dumbbellRow,
  'kb-row': dumbbellRow,
  'backpack-row': dumbbellRow,
  'band-seated-row': video('3TYtXgb9kzY', 'Wiosłowanie gumą siedząc', 'Jan Słoniewicz'),
  'side-plank': video('G3Jm3SUJzqI', 'Deska boczna - jak wykonać side plank?', 'Medicover GO'),
  'side-plank-knees': video('3Nf9xCLLm9Y', 'BOCZNA DESKA | Od Czego Zacząć? | Poznaj Prawidłową Technikę', 'Fitness bez Ściemy'),
  burpee: video('SgKiiyf12O0', 'Burpees - Ćwiczenie / Prawidłowa Technika', 'FITMADE'),
}

export function videoFor(exerciseId: string): ExerciseVideo | null {
  return exerciseVideos[exerciseId] ?? null
}

export function embedUrl(id: string, autoplay: boolean): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&playsinline=1${autoplay ? '&autoplay=1' : ''}`
}

export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} jak wykonać`)}`
}

export function videosAllowed(): boolean {
  try { return localStorage.getItem(CONSENT_KEY) === 'on' } catch { return false }
}

export function allowVideos(value: boolean): void {
  try {
    if (value) localStorage.setItem(CONSENT_KEY, 'on')
    else localStorage.removeItem(CONSENT_KEY)
  } catch { /* The choice then lasts only for this view. */ }
}
