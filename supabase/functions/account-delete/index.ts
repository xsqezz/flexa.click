import { z } from 'zod'
import { adminClient, endpoint, HttpError, readJson, requireUser } from '../_shared/http.ts'

Deno.serve(endpoint(async (request) => {
  const { user, client } = await requireUser(request)
  const input = z.object({
    confirmation: z.literal('USUŃ KONTO'),
    password: z.string().min(1).max(256),
  }).safeParse(await readJson(request))
  if (!input.success) throw new HttpError(400, 'Potwierdź usunięcie tekstem USUŃ KONTO i podaj hasło.')
  if (!user.email) throw new HttpError(400, 'To konto wymaga innej metody ponownego uwierzytelnienia.')
  const { data, error } = await client.auth.signInWithPassword({
    email: user.email, password: input.data.password,
  })
  if (error || data.user?.id !== user.id) throw new HttpError(401, 'Hasło jest niepoprawne. Konto nie zostało usunięte.')
  const { error: deletionError } = await adminClient().auth.admin.deleteUser(user.id)
  if (deletionError) throw new HttpError(500, 'Nie udało się usunąć konta. Spróbuj ponownie później.')
  return { deleted: true }
}))
