import { handlePlateRequest } from '../../../shared/meal-scan/ai.ts'
import type { AiBinding } from '../../../shared/kitchen/ai.ts'

type Env = { AI?: AiBinding; VITE_SUPABASE_URL?: string; VITE_SUPABASE_PUBLISHABLE_KEY?: string }

export const onRequest = ({ request, env }: { request: Request; env: Env }): Promise<Response> => handlePlateRequest(request, {
  ai: env.AI, supabaseUrl: env.VITE_SUPABASE_URL, supabaseKey: env.VITE_SUPABASE_PUBLISHABLE_KEY,
})
