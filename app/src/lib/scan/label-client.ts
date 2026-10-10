import { z } from 'zod'
import { KitchenAiError, failure } from '../kitchen/ai-client'

const labelSchema = z.object({
  label: z.object({
    name: z.string().max(120), brand: z.string().max(60), unit: z.enum(['g', 'ml']),
    kcal: z.number().min(0).max(900),
    protein: z.number().min(0).max(100).nullable(), carbs: z.number().min(0).max(100).nullable(),
    fat: z.number().min(0).max(100).nullable(), fiber: z.number().min(0).max(100).nullable(),
    consistent: z.boolean(),
  }),
})
export type LabelReading = z.infer<typeof labelSchema>['label']

export async function readLabel(image: string, token: string, signal?: AbortSignal): Promise<LabelReading> {
  const response = await fetch('/api/meal/label', {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ images: [image] }),
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(90_000)]) : AbortSignal.timeout(90_000),
  })
  if (!response.ok) throw await failure(response)
  const parsed = labelSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new KitchenAiError('Usługa AI zwróciła nieczytelną odpowiedź. Spróbuj ponownie.', 'bad_response')
  return parsed.data.label
}
