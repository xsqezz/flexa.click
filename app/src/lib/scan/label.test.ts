// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { aiLimits, type AiBinding } from '../../../../shared/kitchen/ai'
import { handlePlateRequest } from '../../../../shared/meal-scan/ai'
import { labelPrompt, parseLabelText } from '../../../../shared/meal-scan/label'

const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 2000 }, (_, index) => index % 251)])
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')
type Fetcher = typeof fetch
const rpc = (answer: boolean): Fetcher => vi.fn(async () => new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as Fetcher
const request = (body: unknown, headers: Record<string, string> = { authorization: 'Bearer aaa.bbb.ccc' }) => new Request('https://flexa.test/api/meal/label', {
  method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
})
const deps = (ai: AiBinding | undefined, fetcher: Fetcher = rpc(true)) => ({ ai, supabaseUrl: 'https://project.supabase.co/', supabaseKey: 'sb_publishable_test', fetch: fetcher })
const aiReturning = (...results: unknown[]) => {
  const run = vi.fn()
  for (const result of results) run.mockImplementationOnce(async () => { if (result instanceof Error) throw result; return result })
  return { run } as unknown as AiBinding & { run: ReturnType<typeof vi.fn> }
}

const good = ['product: Jogurt naturalny', 'brand: Bakoma', 'per: 100 g', 'kcal: 61', 'protein: 4,3', 'carbs: 5.0', 'fat: 3.0', 'fiber: -'].join('\n')

describe('parseLabelText', () => {
  it('reads a per-100 table and keeps unknown values unknown', () => {
    expect(parseLabelText(good)).toEqual({ name: 'Jogurt naturalny', brand: 'Bakoma', unit: 'g', kcal: 61, protein: 4.3, carbs: 5, fat: 3, fiber: null, consistent: true })
    expect(parseLabelText('per: 100 ml\nkcal: 42\nprotein: -\ncarbs: 10.6\nfat: 0\nfiber: 0')).toMatchObject({ unit: 'ml', protein: null, carbs: 10.6, name: '', consistent: true })
  })

  it('tolerates list markers, markdown and units after numbers', () => {
    expect(parseLabelText('- **per:** 100 g\n- kcal: 250 kcal\n- protein: 8 g\n- carbs: 30 g\n- fat: 10 g')).toMatchObject({ kcal: 250, protein: 8, carbs: 30, fat: 10 })
  })

  it('refuses unreadable, per-portion or impossible tables', () => {
    expect(parseLabelText('NONE')).toBeNull()
    expect(parseLabelText('per: NONE\nkcal: 100')).toBeNull()
    expect(parseLabelText('per: portion\nkcal: 100\nprotein: 1\ncarbs: 1\nfat: 1')).toBeNull()
    expect(parseLabelText('per: 100 g\nkcal: -\nprotein: 1')).toBeNull()
    expect(parseLabelText('per: 100 g\nkcal: abc')).toBeNull()
    expect(parseLabelText('per: 100 g\nkcal: 1200\nprotein: 1')).toBeNull()
    expect(parseLabelText('per: 100 g\nkcal: 500\nprotein: 60\ncarbs: 40\nfat: 30')).toBeNull()
  })

  it('flags energy that does not match the macros', () => {
    expect(parseLabelText('per: 100 g\nkcal: 610\nprotein: 4.3\ncarbs: 5\nfat: 3')?.consistent).toBe(false)
    expect(parseLabelText('per: 100 g\nkcal: 610')?.consistent).toBe(true)
  })

  it('strips odd characters from the name', () => {
    expect(parseLabelText('product: <b>Mleko</b>\nper: 100 ml\nkcal: 46')?.name).toBe('bMleko/b')
  })
})

describe('label endpoint', () => {
  it('needs a signed-in user, one valid photo and configured AI, all before spending quota', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ response: good })
    expect((await handlePlateRequest(request({ images: [base64(png)] }, {}), deps(ai, fetcher))).status).toBe(401)
    expect((await handlePlateRequest(request({ images: [base64(png)] }), deps(undefined, fetcher))).status).toBe(503)
    for (const bad of [{}, { images: [] }, { images: [base64(png), base64(png)] }, { images: ['x'] }, { images: [base64(png)], prompt: 'x' }]) {
      expect((await handlePlateRequest(request(bad), deps(ai, fetcher))).status).toBe(400)
    }
    expect(fetcher).not.toHaveBeenCalled()
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('spends the shared vision budget and returns the parsed label', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ response: good })
    const response = await handlePlateRequest(request({ images: [base64(png)] }), deps(ai, fetcher))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ label: { name: 'Jogurt naturalny', brand: 'Bakoma', unit: 'g', kcal: 61, protein: 4.3, carbs: 5, fat: 3, fiber: null, consistent: true } })
    const [, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(String(init.body))).toEqual({ p_kind: 'vision', p_limit: aiLimits.vision })
    const input = ai.run.mock.calls[0][1] as { messages: { content: { type: string; text?: string }[] }[] }
    expect(input.messages[0].content.find((part) => part.type === 'text')?.text).toBe(labelPrompt())
  })

  it('answers 422 for an unreadable table, 429 when the limit is spent and 503 without leaking details', async () => {
    const unreadable = await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning({ response: 'NONE' })))
    expect(unreadable.status).toBe(422)
    expect((await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning({ response: good }), rpc(false)))).status).toBe(429)
    const down = await handlePlateRequest(request({ images: [base64(png)] }), deps(aiReturning(new Error('secret /internal/path'), new Error('again'))))
    expect(down.status).toBe(503)
    expect(JSON.stringify(await down.json())).not.toMatch(/secret|internal/)
  })
})
