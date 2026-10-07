import { z } from 'zod'

export const trainingGoals = ['fat-loss', 'muscle', 'strength', 'conditioning', 'posture', 'health'] as const
export const trainingPlaces = ['gym', 'home'] as const
export const homeEquipment = ['mat', 'dumbbells', 'kettlebell', 'bands', 'miniband', 'pullup-bar', 'bench', 'chair', 'step', 'jump-rope'] as const
export const gymEquipment = ['barbell', 'rack', 'cable', 'machines', 'cardio'] as const
export const trainingLevels = ['beginner', 'intermediate', 'advanced'] as const
export const trainingLimitations = ['knees', 'lower-back', 'shoulders', 'wrists', 'hips', 'ankles', 'neck', 'hypertension', 'osteoporosis', 'low-impact'] as const
export const trainingSexes = ['female', 'male', 'unspecified'] as const
export const sessionLengths = [20, 30, 45, 60, 75, 90] as const
export const sessionKinds = [
  'full-a', 'full-b', 'full-c', 'upper-a', 'upper-b', 'lower-a', 'lower-b', 'push', 'pull', 'legs',
  'posture-a', 'posture-b', 'conditioning', 'cardio', 'mobility',
] as const

export type Goal = typeof trainingGoals[number]
export type Place = typeof trainingPlaces[number]
export type HomeEquipment = typeof homeEquipment[number]
export type Equipment = HomeEquipment | typeof gymEquipment[number]
export type Level = typeof trainingLevels[number]
export type Limitation = typeof trainingLimitations[number]
export type Sex = typeof trainingSexes[number]
export type SessionKind = typeof sessionKinds[number]

export const goalLabels: Record<Goal, { title: string; description: string }> = {
  'fat-loss': { title: 'Redukcja tkanki tłuszczowej', description: 'Trening siłowy chroniący mięśnie, obwody i interwały.' },
  muscle: { title: 'Budowa masy mięśniowej', description: 'Więcej serii w zakresie 6–15 powtórzeń i stopniowy wzrost obciążenia.' },
  strength: { title: 'Siła', description: 'Mniej powtórzeń, dłuższe przerwy i ćwiczenia wielostawowe.' },
  conditioning: { title: 'Kondycja i wytrzymałość', description: 'Obwody, interwały i trening tlenowy wspierany siłą.' },
  posture: { title: 'Zdrowy kręgosłup i postawa', description: 'Mięśnie grzbietu i pośladków, stabilizacja tułowia, mobilność.' },
  health: { title: 'Ogólna sprawność i zdrowie', description: 'Siła, ruch tlenowy, równowaga i mobilność w rozsądnych proporcjach.' },
}

export const placeLabels: Record<Place, { title: string; description: string }> = {
  gym: { title: 'Siłownia', description: 'Sztangi, hantle, wyciągi, maszyny i sprzęt cardio.' },
  home: { title: 'Dom lub plener', description: 'Dobierzemy ćwiczenia do sprzętu, który masz — także bez żadnego.' },
}

export const equipmentLabels: Record<HomeEquipment, string> = {
  mat: 'Mata',
  dumbbells: 'Hantle (stałe lub regulowane)',
  kettlebell: 'Kettlebell',
  bands: 'Gumy oporowe z uchwytami lub długie taśmy',
  miniband: 'Mini-bandy (krótkie gumy)',
  'pullup-bar': 'Drążek do podciągania',
  bench: 'Ławka do ćwiczeń',
  chair: 'Stabilne krzesło lub kanapa',
  step: 'Stopień, schody lub stabilny podest',
  'jump-rope': 'Skakanka',
}

export const levelLabels: Record<Level, { title: string; description: string }> = {
  beginner: { title: 'Początkujący', description: 'Nie trenuję regularnie albo trenuję krócej niż 6 miesięcy.' },
  intermediate: { title: 'Średniozaawansowany', description: 'Trenuję regularnie od 6 miesięcy do 2 lat i znam podstawowe ćwiczenia.' },
  advanced: { title: 'Zaawansowany', description: 'Trenuję ponad 2 lata i świadomie zwiększam obciążenia.' },
}

export const limitationLabels: Record<Limitation, string> = {
  knees: 'Ból lub uraz kolan',
  'lower-back': 'Ból dolnego odcinka pleców',
  shoulders: 'Ból lub uraz barków',
  wrists: 'Ból nadgarstków lub łokci',
  hips: 'Ból bioder',
  ankles: 'Ból kostek lub stóp',
  neck: 'Ból szyi',
  hypertension: 'Nadciśnienie (kontrolowane)',
  osteoporosis: 'Osteoporoza lub osteopenia',
  'low-impact': 'Chcę unikać skoków i biegania',
}

export const sexLabels: Record<Sex, string> = {
  female: 'Kobieta',
  male: 'Mężczyzna',
  unspecified: 'Wolę nie podawać',
}

export const weekdayShort = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'] as const
export const weekdayNames = ['poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota', 'niedziela'] as const

const unique = <T>(values: T[]) => new Set(values).size === values.length

export const trainingAnswersSchema = z.object({
  age: z.number().int().min(16).max(99),
  sex: z.enum(trainingSexes),
  goal: z.enum(trainingGoals),
  place: z.enum(trainingPlaces),
  equipment: z.array(z.enum(homeEquipment)).max(homeEquipment.length).refine(unique, 'Sprzęt nie może się powtarzać.'),
  level: z.enum(trainingLevels),
  weekdays: z.array(z.number().int().min(0).max(6)).min(2).max(6).refine(unique, 'Dni nie mogą się powtarzać.'),
  minutes: z.number().int().refine((value) => (sessionLengths as readonly number[]).includes(value), 'Wybierz długość z listy.'),
  limitations: z.array(z.enum(trainingLimitations)).max(trainingLimitations.length).refine(unique, 'Ograniczenia nie mogą się powtarzać.'),
  cautiousStart: z.boolean(),
  healthConsent: z.boolean(),
})

const exerciseId = z.string().regex(/^[a-z0-9-]{2,60}$/)
export const targetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('reps'), min: z.number().int().min(1).max(50), max: z.number().int().min(1).max(50) }),
  z.object({ type: z.literal('time'), seconds: z.number().int().min(5).max(900) }),
  z.object({ type: z.literal('intervals'), rounds: z.number().int().min(1).max(20), work: z.number().int().min(10).max(300), recover: z.number().int().min(0).max(300) }),
  z.object({ type: z.literal('steady'), minutes: z.number().int().min(3).max(90) }),
])
export const planItemSchema = z.object({
  exercise: exerciseId,
  sets: z.number().int().min(1).max(8),
  target: targetSchema,
  rest: z.number().int().min(0).max(300),
  rir: z.number().int().min(0).max(5).nullable(),
  tempo: z.string().max(12).nullable(),
})
export const planBlockSchema = z.object({
  kind: z.enum(['straight', 'superset', 'circuit', 'finisher']),
  rounds: z.number().int().min(1).max(8).nullable(),
  rest: z.number().int().min(0).max(300).nullable(),
  items: z.array(planItemSchema).min(1).max(8),
})
export const planDrillSchema = z.object({ exercise: exerciseId, target: targetSchema })
export const planSessionSchema = z.object({
  key: z.string().regex(/^s[1-6]$/),
  kind: z.enum(sessionKinds),
  weekday: z.number().int().min(0).max(6),
  minutes: z.number().int().min(5).max(150),
  warmup: z.array(planDrillSchema).min(2).max(8),
  blocks: z.array(planBlockSchema).min(1).max(12),
  cooldown: z.array(planDrillSchema).min(2).max(8),
})
export const trainingPlanSchema = z.object({
  version: z.literal(1),
  createdAt: z.iso.datetime(),
  answers: trainingAnswersSchema,
  sessions: z.array(planSessionSchema).min(2).max(6),
}).refine((plan) => plan.sessions.length === plan.answers.weekdays.length
  && plan.sessions.every((session) => plan.answers.weekdays.includes(session.weekday)), {
  message: 'Plan nie zgadza się z wybranymi dniami.',
})
export const trainingStateSchema = z.object({
  onboardingDone: z.boolean(),
  plan: trainingPlanSchema.nullable(),
  unreadable: z.boolean(),
})

export type TrainingAnswers = z.infer<typeof trainingAnswersSchema>
export type Target = z.infer<typeof targetSchema>
export type PlanItem = z.infer<typeof planItemSchema>
export type PlanBlock = z.infer<typeof planBlockSchema>
export type PlanDrill = z.infer<typeof planDrillSchema>
export type PlanSession = z.infer<typeof planSessionSchema>
export type TrainingPlan = z.infer<typeof trainingPlanSchema>
export type TrainingState = z.infer<typeof trainingStateSchema>

export function needsHealthConsent(answers: Pick<TrainingAnswers, 'limitations' | 'cautiousStart'>): boolean {
  return answers.limitations.length > 0 || answers.cautiousStart
}
