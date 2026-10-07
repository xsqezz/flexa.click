export type ExerciseVideo = { id: string; title: string; channel: string; lang: string }

const CONSENT_KEY = 'flexa:youtube'

const video = (id: string, title: string, channel: string, lang = 'pl'): ExerciseVideo => ({ id, title, channel, lang })
const jumpingJacks = video('yC15l7aqXx0', 'Pajacyki - zobacz, jak prawidłowo wykonywać to popularne ćwiczenie', 'Drużyna Energii')
const catCow = video('ffxz83LANnY', 'Kocie grzbiety / Cat Cow', 'Trener Paweł Pakuła')
const deadBug = video('e2Rt8jqO3HY', 'SILNA PRO | Dead Bug | technika i wykonanie', 'Karolina Kałuża')
const dumbbellRow = video('Ihtkzra1nFk', 'Wiosłowanie w podparciu hantlem', 'Myfitweb')
const hipThrust = video('ezEQkeQWMPM', 'HIP THRUST - Podstawowe ćwiczenie na pośladki', 'ProFi Academy')

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
  'bulgarian-split-squat': video('HX6t_XgWDgs', 'Shark Training - przygotowanie motoryczne: PRZYSIAD BUŁGARSKI Z HANTLAMI', 'Shark Training'),
  'reverse-lunge-weighted': video('erih7EpsuH4', 'Wykroki w tył z hantlami / zakroki', 'Kobieta Na Bombie'),
  'reverse-lunge': video('9aj-cIXDuR8', 'Wykrok to tyłu z hantlami - FitNOW.pl', 'FitNOWtraining'),
  'rdl-db': video('cC-JQVoXkWc', 'Rumuński martwy ciąg z hantlami na dwugłowe uda | Hamstring Dumbbell RDL – technika krok po kroku', 'Jacek Lewiński'),
  'rdl-kb': video('6ydWzKgN7CY', 'Rumuński martwy ciąg z hantlami | Dumbbell Romanian Deadlift | (dwugłowe, pośladki)', 'Patryk Konicki'),
  'single-leg-rdl-weighted': video('v0oBi8aOVV8', '#12 Nogi - Martwy ciąg na jednej nodze z hantlem', 'Train Me Now'),
  'single-leg-rdl': video('hBPoprhxFRQ', 'MARTWY CIĄG NA JEDNEJ NODZE - POPRAWNA TECHNIKA', 'ProFi Academy'),
  'hip-thrust-db': video('Ewi3TgWS7pE', 'Wypychanie bioder z hantlą | Dumbbell Hip Thrust | (pośladki)', 'Patryk Konicki'),
  'hip-thrust-couch': hipThrust,
  'hip-thrust-bb': hipThrust,
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
