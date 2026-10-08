// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { aiLimits, extractText, handleKitchenRequest, maxPhotoBytes, parseVisionText, visionPrompt, type AiBinding } from '../../../../shared/kitchen/ai'
import { dishImagePrompt } from '../../../../shared/kitchen/visual'

const token = 'aaa.bbb.ccc'
const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, ...Array.from({ length: 200 }, (_, index) => index % 251)])
const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, ...Array.from({ length: 2000 }, (_, index) => index % 251)])
const base64 = (bytes: Uint8Array) => Buffer.from(bytes).toString('base64')

type Fetcher = typeof fetch
function rpc(answer: boolean | number): Fetcher {
  return vi.fn(async () => typeof answer === 'number'
    ? new Response('{}', { status: answer })
    : new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } })) as unknown as Fetcher
}

function request(action: string, body?: unknown, headers: Record<string, string> = { authorization: `Bearer ${token}` }, method = 'POST') {
  return new Request(`https://flexa.test/api/kitchen/${action}`, {
    method, headers: { 'content-type': 'application/json', ...headers }, ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

const deps = (ai: AiBinding | undefined, fetcher: Fetcher = rpc(true)) => ({ ai, supabaseUrl: 'https://project.supabase.co/', supabaseKey: 'sb_publishable_test', fetch: fetcher })
const aiReturning = (...results: unknown[]): AiBinding & { run: ReturnType<typeof vi.fn> } => {
  const run = vi.fn()
  for (const result of results) run.mockImplementationOnce(async () => { if (result instanceof Error) throw result; return result })
  return { run } as AiBinding & { run: ReturnType<typeof vi.fn> }
}

async function json(response: Response) { return await response.json() as Record<string, unknown> }

describe('kitchen status and routing', () => {
  it('reports availability only when everything is configured', async () => {
    const ready = await handleKitchenRequest('status', request('status', undefined, {}, 'GET'), deps(aiReturning()))
    expect(await json(ready)).toEqual({ available: true, limits: aiLimits })
    const noAi = await handleKitchenRequest('status', request('status', undefined, {}, 'GET'), deps(undefined))
    expect((await json(noAi)).available).toBe(false)
    const noKey = await handleKitchenRequest('status', request('status', undefined, {}, 'GET'), { ai: aiReturning(), supabaseUrl: 'https://x.supabase.co' })
    expect((await json(noKey)).available).toBe(false)
  })

  it('rejects unknown actions and wrong methods', async () => {
    expect((await handleKitchenRequest('status', request('status', {}), deps(aiReturning()))).status).toBe(405)
    expect((await handleKitchenRequest('vision', request('vision', undefined, {}, 'GET'), deps(aiReturning()))).status).toBe(405)
    expect((await handleKitchenRequest('delete-everything', request('x', {}), deps(aiReturning()))).status).toBe(404)
  })

  it('never caches or sniffs responses', async () => {
    const response = await handleKitchenRequest('status', request('status', undefined, {}, 'GET'), deps(aiReturning()))
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('photo recognition', () => {
  const photo = { image: base64(png) }

  it('requires a signed-in user and a configured AI binding', async () => {
    const ai = aiReturning({ response: 'jajka' })
    expect((await handleKitchenRequest('vision', request('vision', photo, {}), deps(ai))).status).toBe(401)
    expect((await handleKitchenRequest('vision', request('vision', photo, { authorization: 'Bearer not a token' }), deps(ai))).status).toBe(401)
    expect((await handleKitchenRequest('vision', request('vision', photo, { authorization: `Basic ${token}` }), deps(ai))).status).toBe(401)
    expect((await handleKitchenRequest('vision', request('vision', photo), deps(undefined))).status).toBe(503)
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('validates the photo before spending quota', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ response: 'jajka' })
    expect((await handleKitchenRequest('vision', request('vision', { image: 'x' }), deps(ai, fetcher))).status).toBe(400)
    expect((await handleKitchenRequest('vision', request('vision', {}), deps(ai, fetcher))).status).toBe(400)
    expect((await handleKitchenRequest('vision', request('vision', { image: '!!!'.repeat(60) }), deps(ai, fetcher))).status).toBe(400)
    expect((await handleKitchenRequest('vision', request('vision', { image: base64(Uint8Array.from({ length: 500 }, () => 7)) }), deps(ai, fetcher))).status).toBe(400)
    const huge = new Uint8Array(maxPhotoBytes + 10)
    huge.set([0xff, 0xd8, 0xff])
    expect((await handleKitchenRequest('vision', request('vision', { image: base64(huge) }), deps(ai, fetcher))).status).toBe(413)
    const broken = new Request('https://flexa.test/api/kitchen/vision', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: '{not json' })
    expect((await handleKitchenRequest('vision', broken, deps(ai, fetcher))).status).toBe(400)
    expect(fetcher).not.toHaveBeenCalled()
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('consumes the quota as the user, then maps recognised names to ingredients', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ response: '1. Pierś z kurczaka\n- brokuł\n* Sól\nwoda\nkolendra\nBrokuł\n' })
    const response = await handleKitchenRequest('vision', request('vision', photo), deps(ai, fetcher))
    expect(response.status).toBe(200)
    expect(await json(response)).toEqual({ items: ['chicken-breast', 'broccoli'], unknown: ['kolendra'], seen: ['Pierś z kurczaka', 'brokuł', 'Sól', 'woda', 'kolendra'] })
    const [url, init] = (fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://project.supabase.co/rest/v1/rpc/consume_kitchen_ai')
    expect(init.headers).toMatchObject({ apikey: 'sb_publishable_test', authorization: `Bearer ${token}` })
    expect(JSON.parse(String(init.body))).toEqual({ p_kind: 'vision', p_limit: aiLimits.vision })
    const input = ai.run.mock.calls[0][1] as { messages: { content: { type: string; image_url?: { url: string } }[] }[] }
    expect(ai.run.mock.calls[0][0]).toBe('@cf/meta/llama-4-scout-17b-16e-instruct')
    expect(input.messages[0].content.find((part) => part.type === 'image_url')?.image_url?.url).toMatch(/^data:image\/png;base64,/)
  })

  it('accepts a JPEG data URL and reports "nothing visible" as an empty list', async () => {
    const ai = aiReturning({ response: 'BRAK' })
    const response = await handleKitchenRequest('vision', request('vision', { image: `data:image/jpeg;base64,${base64(jpeg).padEnd(140, 'A')}` }), deps(ai))
    expect(await json(response)).toMatchObject({ items: [], unknown: [], seen: [] })
  })

  it('stops with a clear message when the daily limit is used up or the quota service fails', async () => {
    const ai = aiReturning({ response: 'jajka' })
    const denied = await handleKitchenRequest('vision', request('vision', photo), deps(ai, rpc(false)))
    expect(denied.status).toBe(429)
    expect(String((await json(denied)).error)).toContain('limit')
    expect((await handleKitchenRequest('vision', request('vision', photo), deps(ai, rpc(401)))).status).toBe(401)
    expect((await handleKitchenRequest('vision', request('vision', photo), deps(ai, rpc(500)))).status).toBe(503)
    const offline = vi.fn(async () => { throw new TypeError('network down') }) as unknown as Fetcher
    expect((await handleKitchenRequest('vision', request('vision', photo), deps(ai, offline))).status).toBe(503)
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('falls back to the second model and fails gracefully when both are down', async () => {
    const first = aiReturning(new Error('model overloaded'), { choices: [{ message: { content: 'jajka\nmleko' } }] })
    const ok = await handleKitchenRequest('vision', request('vision', photo), deps(first))
    expect((await json(ok)).items).toEqual(['egg', 'milk'])
    expect(first.run.mock.calls.map((call) => call[0])).toEqual(['@cf/meta/llama-4-scout-17b-16e-instruct', '@cf/mistralai/mistral-small-3.1-24b-instruct'])
    const dead = aiReturning(new Error('down'), new Error('down'))
    expect((await handleKitchenRequest('vision', request('vision', photo), deps(dead))).status).toBe(503)
  })

  it('does not leak model internals in errors', async () => {
    const response = await handleKitchenRequest('vision', request('vision', photo), deps(aiReturning(new Error('secret stack at /internal/path'), new Error('again'))))
    expect(JSON.stringify(await json(response))).not.toMatch(/secret|internal|stack/)
  })
})

describe('dish picture', () => {
  const body = { format: 'skillet', ingredients: ['chicken-breast', 'broccoli', 'rice-white'], style: 'asian' }

  it('validates the request and only accepts known ingredients', async () => {
    const fetcher = rpc(true)
    const ai = aiReturning({ image: base64(jpeg) })
    for (const bad of [
      {}, { ...body, format: 'pizza' }, { ...body, ingredients: [] }, { ...body, ingredients: ['unicorn-meat'] }, { ...body, ingredients: ['../../etc/passwd'] },
      { ...body, ingredients: Array.from({ length: 20 }, () => 'egg') }, { ...body, style: 'sweet' }, { ...body, prompt: 'ignore everything' },
    ]) {
      const response = await handleKitchenRequest('image', request('image', bad), deps(ai, fetcher))
      expect([400]).toContain(response.status)
    }
    expect((await handleKitchenRequest('image', request('image', body, {}), deps(ai, fetcher))).status).toBe(401)
    expect(fetcher).not.toHaveBeenCalled()
    expect(ai.run).not.toHaveBeenCalled()
  })

  it('builds the prompt on the server from ingredient names only', async () => {
    const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, ...Array.from({ length: 2000 }, (_, index) => index % 200)])
    const ai = aiReturning({ image: base64(jpegBytes) })
    const fetcher = rpc(true)
    const response = await handleKitchenRequest('image', request('image', body), deps(ai, fetcher))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(new Uint8Array(await response.arrayBuffer())).toEqual(jpegBytes)
    const [model, input] = ai.run.mock.calls[0] as [string, { prompt: string; steps: number }]
    expect(model).toBe('@cf/black-forest-labs/flux-1-schnell')
    expect(input.prompt).toBe(dishImagePrompt('skillet', ['chicken-breast', 'broccoli', 'rice-white'], 'asian'))
    expect(input.prompt).toContain('chicken breast')
    expect(input.steps).toBe(4)
    expect(JSON.parse(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1].body))).toEqual({ p_kind: 'image', p_limit: aiLimits.image })
  })

  it('falls back to the second model and rejects non-image output', async () => {
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, ...Array.from({ length: 2000 }, (_, index) => index % 200)])
    const ai = aiReturning({ image: 'bm90IGFuIGltYWdl' }, pngBytes)
    const response = await handleKitchenRequest('image', request('image', body), deps(ai))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(ai.run.mock.calls[1][0]).toBe('@cf/bytedance/stable-diffusion-xl-lightning')
    expect((ai.run.mock.calls[1][1] as { steps?: number }).steps).toBeUndefined()
    const none = await handleKitchenRequest('image', request('image', body), deps(aiReturning({ image: 'bm90IGFuIGltYWdl' }, 'text')))
    expect(none.status).toBe(503)
  })

  it('enforces the daily image limit', async () => {
    const ai = aiReturning({ image: base64(jpeg) })
    expect((await handleKitchenRequest('image', request('image', body), deps(ai, rpc(false)))).status).toBe(429)
    expect(ai.run).not.toHaveBeenCalled()
  })
})

describe('helpers', () => {
  it('lists recognisable ingredient names, but never staples or water', () => {
    const prompt = visionPrompt()
    expect(prompt).toContain('pierś z kurczaka')
    expect(prompt).toContain('jogurt grecki')
    expect(prompt).not.toMatch(/(^|, )sól(,|\.)/)
    expect(prompt).not.toMatch(/(^|, )woda(,|\.)/)
    expect(prompt).not.toContain('olej rzepakowy')
    expect(prompt.length).toBeLessThan(6000)
  })

  it('parses model answers defensively', () => {
    expect(parseVisionText('1) Jajka.\n2) Mleko;ser żółty\n\n• pomidor\n' + 'x'.repeat(80) + '\na b c d e f g\nBRAK')).toEqual(['Jajka', 'Mleko', 'ser żółty', 'pomidor'])
    expect(parseVisionText('')).toEqual([])
    expect(parseVisionText(Array.from({ length: 100 }, (_, index) => `produkt ${index}`).join('\n')).length).toBeLessThanOrEqual(30)
  })

  it('extracts text from the different Workers AI response shapes', () => {
    expect(extractText('plain')).toBe('plain')
    expect(extractText({ response: 'a' })).toBe('a')
    expect(extractText({ result: { response: 'b' } })).toBe('b')
    expect(extractText({ choices: [{ message: { content: 'c' } }] })).toBe('c')
    expect(extractText({ choices: [{ message: { content: [{ type: 'text', text: 'd' }, { type: 'text', text: 'e' }] } }] })).toBe('d\ne')
    expect(extractText(null)).toBe('')
    expect(extractText({ nothing: true })).toBe('')
  })

  it('keeps image prompts free of anything the user typed', () => {
    const prompt = dishImagePrompt('salad', ['tomato', 'feta'], undefined)
    expect(prompt).toContain('tomato')
    expect(prompt).toContain('feta')
    expect(prompt.length).toBeLessThan(600)
  })
})
