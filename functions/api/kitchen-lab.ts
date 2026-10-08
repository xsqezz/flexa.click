import type { AiBinding } from '../../shared/kitchen/ai.ts'

type Env = { AI?: AiBinding }

const supabaseUrl = 'https://mqstshfuijthzrwlzcjd.supabase.co'
const supabaseKey = 'sb_publishable_pdojXHn2IdqX-P1YP1HjXQ_fSpNyxih'
const labUser = 'b39b938f-5629-4af2-b64b-7871a8b67ae0'

const reply = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } })

export const onRequestPost = async ({ request, env }: { request: Request; env: Env }): Promise<Response> => {
  const token = /^Bearer (\S+)$/.exec(request.headers.get('authorization') ?? '')?.[1]
  if (!token || !env.AI) return reply(401, { error: 'unauthorized' })
  const who = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: { apikey: supabaseKey, authorization: `Bearer ${token}` } })
  const user = who.ok ? await who.json() as { id?: string } : null
  if (user?.id !== labUser) return reply(403, { error: 'forbidden' })
  const { model, input } = await request.json() as { model: string; input: unknown }
  const started = Date.now()
  try {
    const result = await env.AI.run(model, input)
    return reply(200, { ms: Date.now() - started, result })
  } catch (error) {
    return reply(200, { ms: Date.now() - started, error: String(error) })
  }
}
