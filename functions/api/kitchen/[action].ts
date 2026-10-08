import { handleKitchenRequest, type AiBinding } from '../../../shared/kitchen/ai.ts'

type Env = { AI?: AiBinding; VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string }

export const onRequest = ({ request, env, params }: { request: Request; env: Env; params: { action?: string | string[] } }): Promise<Response> => {
  const action = Array.isArray(params.action) ? params.action[0] : params.action
  return handleKitchenRequest(action ?? '', request, {
    ai: env.AI, supabaseUrl: env.VITE_SUPABASE_URL, supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  })
}
