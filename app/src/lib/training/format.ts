import {
  equipmentLabels, goalLabels, limitationLabels, placeLabels, weekdayNames,
  type Goal, type PlanBlock, type PlanItem, type PlanSession, type SessionKind, type Target, type TrainingAnswers,
} from '../../../../shared/training'
import type { Workout } from '../../../../shared/domain'
import { ageBand, strengthKinds } from './generator'
import { findExercise, type Exercise } from './library'

const sessionNames: Record<SessionKind, string> = {
  'full-a': 'Całe ciało A', 'full-b': 'Całe ciało B', 'full-c': 'Całe ciało C',
  'upper-a': 'Góra ciała A', 'upper-b': 'Góra ciała B', 'lower-a': 'Dół ciała A', 'lower-b': 'Dół ciała B',
  push: 'Wypychanie: klatka, barki, triceps', pull: 'Przyciąganie: plecy i biceps', legs: 'Nogi i pośladki',
  'posture-a': 'Postawa A: plecy i pośladki', 'posture-b': 'Postawa B: stabilizacja i mobilność',
  conditioning: 'Kondycja: obwód i interwały', cardio: 'Trening tlenowy i równowaga', mobility: 'Mobilność i regeneracja',
}
const goalSuffix: Record<Goal, string> = {
  'fat-loss': 'siła i spalanie', muscle: 'budowa mięśni', strength: 'siła',
  conditioning: 'siła i wytrzymałość', posture: 'postawa', health: 'sprawność',
}

export function sessionTitle(session: PlanSession, index: number, goal: Goal): string {
  const name = sessionNames[session.kind]
  const suffix = strengthKinds.has(session.kind) && !session.kind.startsWith('posture') ? ` — ${goalSuffix[goal]}` : ''
  return `Dzień ${index + 1}: ${name}${suffix}`
}

export function sessionShortName(kind: SessionKind): string {
  return sessionNames[kind].split(':')[0]
}

const plural = (count: number, one: string, few: string, many: string) => {
  if (count === 1) return one
  const tens = count % 100
  const units = count % 10
  return units >= 2 && units <= 4 && (tens < 12 || tens > 14) ? few : many
}

export function duration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest ? `${minutes} min ${rest} s` : `${minutes} min`
}

export function formatTarget(target: Target, exercise?: Exercise): string {
  const side = exercise?.perSide ? ` ${exercise.sideLabel ?? 'na stronę'}` : ''
  switch (target.type) {
    case 'reps': {
      const range = target.min === target.max ? `${target.min}` : `${target.min}–${target.max}`
      return exercise?.unit === 'steps' ? `${range} ${plural(target.max, 'krok', 'kroki', 'kroków')}${side}` : `${range} powt.${side}`
    }
    case 'time': return exercise?.perSide && exercise.measure !== 'cardio' ? `${duration(target.seconds)}${side}` : duration(target.seconds)
    case 'intervals': return `${target.rounds} × (${duration(target.work)} szybciej + ${duration(target.recover)} spokojnie)`
    case 'steady': return `${target.minutes} min`
  }
}

export function setsLabel(count: number): string {
  return `${count} ${plural(count, 'seria', 'serie', 'serii')}`
}

export function roundsLabel(count: number): string {
  return `${count} ${plural(count, 'runda', 'rundy', 'rund')}`
}

export function itemDetails(item: PlanItem, block: PlanBlock): string[] {
  const exercise = findExercise(item.exercise)
  const target = formatTarget(item.target, exercise)
  const details: string[] = []
  if (item.target.type === 'intervals' || item.target.type === 'steady') details.push(target)
  else if (block.kind === 'straight') details.push(`${setsLabel(item.sets)} × ${target}`, `przerwa ${duration(item.rest)}`)
  else details.push(target)
  if (item.rir !== null) details.push(`zostaw ${item.rir} ${plural(item.rir, 'powtórzenie', 'powtórzenia', 'powtórzeń')} w zapasie`)
  if (item.tempo) details.push(item.tempo.startsWith('pauza') ? item.tempo : `tempo ${item.tempo}`)
  return details
}

export function blockHeading(block: PlanBlock, letter: string): string {
  if (block.kind === 'superset') return `Blok ${letter}: superseria · ${roundsLabel(block.rounds ?? 1)}, przerwa ${duration(block.rest ?? 0)} po każdej rundzie`
  if (block.kind === 'circuit') return `Blok ${letter}: obwód · ${roundsLabel(block.rounds ?? 1)}, przerwa ${duration(block.rest ?? 0)} po każdym obwodzie`
  if (block.kind === 'finisher') return `Blok ${letter}: ${block.items[0].target.type === 'intervals' ? 'interwały' : 'trening tlenowy'}`
  return `Blok ${letter}`
}

export function blockHint(block: PlanBlock): string | null {
  if (block.kind === 'superset') return `Wykonaj ćwiczenia jedno po drugim z ok. ${duration(block.items[0].rest)} na zmianę stanowiska, potem odpocznij.`
  if (block.kind === 'circuit') return `Przechodź kolejno przez wszystkie ćwiczenia z ok. ${duration(block.items[0].rest)} na zmianę stanowiska.`
  if (block.kind === 'finisher' && block.items[0].target.type === 'intervals') return 'Szybsze odcinki mają być wymagające, ale bez sprintu na maksimum. Spokojne odcinki służą do wyrównania oddechu.'
  if (block.kind === 'finisher') return 'Tempo, w którym możesz mówić pełnymi zdaniami, ale nie śpiewać.'
  return null
}

export function scheduleLabel(answers: TrainingAnswers): string {
  return answers.weekdays.map((day) => weekdayNames[day]).join(', ')
}

export function planSummary(answers: TrainingAnswers): string {
  const count = answers.weekdays.length
  const place = answers.place === 'gym' ? 'siłownia'
    : answers.equipment.length ? `dom: ${answers.equipment.map((item) => equipmentLabels[item].toLocaleLowerCase('pl-PL')).join(', ')}`
      : 'dom, bez sprzętu'
  return `${goalLabels[answers.goal].title} · ${count} ${plural(count, 'trening', 'treningi', 'treningów')} w tygodniu po ok. ${answers.minutes} min · ${place}`
}

export function progressionSteps(answers: TrainingAnswers): { title: string; text: string }[] {
  const band = ageBand(answers.age)
  const deload = answers.level !== 'beginner'
  const steps = [
    { title: 'Tygodnie 1–2: technika', text: 'Dobierz ciężar lub wariant tak, aby kończyć serie z zapasem podanym przy ćwiczeniu. Ucz się ruchu i zapisuj ciężary.' },
    { title: deload ? 'Tygodnie 3–6: progresja' : 'Tygodnie 3–8: progresja', text: answers.goal === 'conditioning' || answers.goal === 'fat-loss'
      ? 'Gdy wszystkie serie wychodzą w górnym zakresie powtórzeń, zwiększ ciężar o najmniejszy możliwy krok albo skróć przerwę o 10–15 s. W interwałach dodaj jedną rundę co 1–2 tygodnie.'
      : 'Stosuj podwójną progresję: najpierw dobijaj do górnej granicy powtórzeń we wszystkich seriach, potem zwiększ ciężar o ok. 2–5% i wróć do dolnej granicy.' },
  ]
  if (deload) steps.push({ title: 'Tydzień 7: lżejszy tydzień', text: 'Zmniejsz liczbę serii o około jedną trzecią i zostaw więcej powtórzeń w zapasie. To czas na regenerację przed kolejnym cyklem.' })
  steps.push({ title: deload ? 'Po 7 tygodniach' : 'Po 8 tygodniach', text: 'Zaktualizuj odpowiedzi i wygeneruj nowy plan albo kontynuuj z trudniejszymi wariantami. Bez postępu przez 3 tygodnie? Sprawdź sen, jedzenie i regenerację.' })
  if (band === 'teen') steps[1].text += ' Nie testuj ciężaru maksymalnego — technika jest ważniejsza niż liczba na sztandze.'
  return steps
}

export function goalNotes(answers: TrainingAnswers): string[] {
  const notes: Record<Goal, string[]> = {
    'fat-loss': ['O utracie tkanki tłuszczowej decyduje głównie bilans energii; trening siłowy pomaga zachować mięśnie.', 'Codzienny ruch poza treningiem, np. spacery, zwiększa wydatek energii bez obciążania regeneracji.'],
    muscle: ['Mięśnie rosną dzięki stopniowemu zwiększaniu obciążenia, wystarczającej ilości białka i snu.', 'Zapisuj ciężary i powtórzenia — progres widać w dzienniku treningowym, a nie tylko w lustrze.'],
    strength: ['Najważniejsze są ćwiczenia główne — wykonuj je wypoczęty, z pełnymi przerwami.', 'Siła rośnie także dzięki technice; jedna czysta seria jest lepsza niż ciężka seria z błędami.'],
    conditioning: ['Większość treningu tlenowego wykonuj w tempie konwersacyjnym; intensywne interwały uzupełniają bazę.', 'Mierz postęp czasem, dystansem albo tętnem przy tej samej prędkości.'],
    posture: ['Postawa to nawyk: regularne krótkie sesje i przerwy od siedzenia działają lepiej niż jeden długi trening.', 'Ćwiczenia wykonuj powoli i bez bólu — czucie pracy mięśni jest ważniejsze niż ciężar.'],
    health: ['WHO zaleca dorosłym 150–300 min umiarkowanej aktywności tygodniowo i ćwiczenia wzmacniające co najmniej 2 dni w tygodniu.', 'Dni bez treningu to dobry moment na spacer lub krótką mobilność.'],
  }
  const result = [...notes[answers.goal]]
  if (ageBand(answers.age) === 'senior') result.push('Po 65. roku życia WHO zaleca także ćwiczenia równowagi co najmniej 3 dni w tygodniu — znajdziesz je w planie.')
  if (ageBand(answers.age) === 'teen') result.push('WHO zaleca młodzieży średnio 60 minut aktywności dziennie. Plan siłowy uzupełnia, a nie zastępuje sport i zabawę.')
  return result
}

export function safetyNotes(answers: TrainingAnswers): string[] {
  const band = ageBand(answers.age)
  const notes = [
    'Ostry, kłujący lub promieniujący ból oznacza koniec ćwiczenia. Zwykłe zmęczenie i pieczenie mięśni są normalne.',
    'Przerwij trening i skontaktuj się z lekarzem przy bólu w klatce piersiowej, duszności nieadekwatnej do wysiłku, zawrotach głowy lub kołataniu serca.',
    'Plan to ogólne wskazówki treningowe, a nie porada medyczna ani fizjoterapeutyczna.',
  ]
  if (band === 'teen') notes.push('Osoby niepełnoletnie powinny ćwiczyć z obciążeniem pod okiem dorosłego lub trenera, szczególnie na początku.')
  if (band === 'older' || band === 'senior') notes.push('Rozgrzewka jest dłuższa, a ćwiczenia równowagi wykonuj zawsze przy stabilnej podporze.')
  if (answers.cautiousStart) notes.push('Wybrano łagodny start: trzymaj się zaleceń lekarza i zwiększaj trudność dopiero po kilku tygodniach bez dolegliwości.')
  for (const limitation of answers.limitations) {
    const text: Record<string, string> = {
      knees: 'Kolana: pominęliśmy skoki i najgłębsze przysiady. Pracuj w zakresie bez bólu, kolano prowadź nad stopą.',
      'lower-back': 'Plecy: pominęliśmy martwe ciągi i duże obciążenie kręgosłupa. Priorytet: neutralne plecy i napięty brzuch.',
      shoulders: 'Barki: pominęliśmy wyciskania nad głowę i podciągania. Unoś ręce tylko w zakresie bez bólu.',
      wrists: 'Nadgarstki: zamiast podporów na dłoniach są warianty z neutralnym chwytem. Możesz też oprzeć się na pięściach.',
      hips: 'Biodra: pominęliśmy szerokie i najgłębsze pozycje. Zatrzymuj ruch przed bólem w pachwinie.',
      ankles: 'Kostki i stopy: plan nie zawiera skoków ani biegu. Ćwicz w stabilnym obuwiu.',
      neck: 'Szyja: unikaj zadzierania głowy; w ćwiczeniach leżących podłóż ręcznik pod czoło lub głowę.',
      hypertension: 'Nadciśnienie: nie wstrzymuj oddechu, zostawiaj co najmniej 2 powtórzenia w zapasie i unikaj długich napięć izometrycznych.',
      osteoporosis: 'Osteoporoza: pominęliśmy skłony z zaokrąglaniem pleców i skoki. Ćwiczenia siłowe i równowagi wykonuj w spokojnym tempie.',
      'low-impact': 'Bez skoków: wszystkie ćwiczenia kondycyjne mają warianty bez fazy lotu.',
    }
    notes.push(text[limitation])
  }
  return notes
}

export function limitationSummary(answers: TrainingAnswers): string {
  const parts: string[] = answers.limitations.map((item) => limitationLabels[item])
  if (answers.cautiousStart) parts.unshift('Łagodny start po konsultacji z lekarzem')
  return parts.length ? parts.join(', ') : 'Brak zgłoszonych ograniczeń'
}

export function placeSummary(answers: TrainingAnswers): string {
  if (answers.place === 'gym') return placeLabels.gym.title
  return answers.equipment.length ? answers.equipment.map((item) => equipmentLabels[item]).join(', ') : 'Bez sprzętu'
}

export function weekdayIndex(date: string): number {
  return (new Date(`${date}T12:00:00`).getDay() + 6) % 7
}

export function plannedWorkout(session: PlanSession, index: number, goal: Goal): { name: string; kind: Workout['kind']; minutes: number } {
  const main = session.blocks[0]?.items[0]?.exercise
  const kind: Workout['kind'] = session.kind === 'cardio'
    ? main === 'bike' ? 'ride' : main === 'brisk-walk' || main === 'incline-walk' ? 'walk' : 'other'
    : session.kind === 'conditioning' || session.kind === 'mobility' ? 'other' : 'strength'
  return { name: sessionTitle(session, index, goal).slice(0, 120), kind, minutes: session.minutes }
}
