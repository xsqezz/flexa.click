// @vitest-environment node
import { readFile, readdir } from 'node:fs/promises'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'
const consent = JSON.stringify({ display_name: 'Test', privacy_consent: true, adult_confirmed: true, consent_version: '2026-10-06' })
const food = JSON.stringify({
  id: 'test', name: 'Produkt', brand: '', barcode: null, unit: 'g', source: 'custom',
  nutrients: { kcal: 100, protein: null, carbs: null, fat: null, fiber: null },
})
const answers = (patch: Record<string, unknown> = {}) => JSON.stringify({
  age: 30, sex: 'female', goal: 'health', place: 'home', equipment: [], level: 'beginner', weekdays: [0, 2, 4],
  minutes: 30, limitations: [], cautiousStart: false, healthConsent: false, ...patch,
})
const plan = JSON.stringify({ version: 1, createdAt: '2026-10-07T10:00:00.000Z', sessions: [] })
const tables = ['profiles', 'meal_entries', 'workouts', 'water_entries', 'measurements', 'custom_foods', 'training_plans']
const migrations = new URL('../../../supabase/migrations/', import.meta.url)
let database: PGlite

async function asUser(id: string) {
  await database.exec(`reset role; select set_config('request.jwt.claim.sub', '${id}', false); set role authenticated;`)
}

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb not null default '{}');
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `)
  for (const file of (await readdir(migrations)).filter((name) => name.endsWith('.sql')).sort()) {
    await database.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
  await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $3), ($2, $3)', [alice, bob, consent])
  await database.query('insert into public.meal_entries(user_id, date, meal, food, portion) values ($1, $2, $3, $4, $5)', [alice, '2026-10-06', 'lunch', food, 100])
  await database.query('insert into public.custom_foods(user_id, food) values ($1, $2)', [alice, food])
  await database.query("insert into public.workouts(user_id, date, name, kind, minutes) values ($1, '2026-10-06', 'Bieg', 'run', 30)", [alice])
  await database.query("insert into public.water_entries(user_id, date, amount_ml) values ($1, '2026-10-06', 250)", [alice])
  await database.query("insert into public.measurements(user_id, date, weight_kg) values ($1, '2026-10-06', 75)", [alice])
  await database.query('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3)', [alice, answers(), plan])
})
beforeEach(async () => { await database.exec('begin') })
afterEach(async () => { await database.exec('rollback; reset role;') })
afterAll(async () => { await database.close() })

describe('Postgres ownership and privacy', () => {
  for (const table of tables) {
    it(`isolates ${table} between accounts`, async () => {
      await asUser(bob)
      expect((await database.query(`select * from public.${table} where user_id = $1`, [alice])).rows).toHaveLength(0)
      const deleted = await database.query(`delete from public.${table} where user_id = $1 returning user_id`, [alice]).catch((error: unknown) => error)
      if (table === 'profiles') expect(deleted).toBeInstanceOf(Error)
      else expect(deleted).toHaveProperty('rows', [])
    })
  }
  it('allows the owner to view private records', async () => {
    await asUser(alice)
    expect((await database.query('select * from public.meal_entries')).rows).toHaveLength(1)
  })
  it('rejects ownership spoofing on insert', async () => {
    await asUser(bob)
    await expect(database.query("insert into public.water_entries(user_id, date, amount_ml) values ($1, '2026-10-06', 250)", [alice])).rejects.toThrow('row-level security')
  })
  it('rejects changing a record owner', async () => {
    await asUser(alice)
    await expect(database.query('update public.workouts set user_id = $1', [bob])).rejects.toThrow('row-level security')
  })
  it('does not allow a user to rewrite the consent audit fields', async () => {
    await asUser(alice)
    await expect(database.query("update public.profiles set consent_version = 'other'")).rejects.toThrow('permission denied')
  })
  it('denies anonymous access', async () => {
    await database.exec('set role anon')
    await expect(database.query('select * from public.meal_entries')).rejects.toThrow('permission denied')
  })
  it('requires explicit consent when creating an auth user', async () => {
    await expect(database.query('insert into auth.users(id) values ($1)', [crypto.randomUUID()])).rejects.toThrow('Explicit privacy consent')
  })
  it('removes every private record when the auth account is deleted', async () => {
    await database.query('delete from auth.users where id = $1', [alice])
    for (const table of tables) expect((await database.query(`select * from public.${table} where user_id = $1`, [alice])).rows).toHaveLength(0)
  })
  it('rejects a missing energy value rather than storing invalid success-shaped food', async () => {
    await asUser(alice)
    await expect(database.query("insert into public.meal_entries(user_id, date, meal, food, portion) values ($1, '2026-10-06', 'lunch', $2, 100)", [alice, '{"name":"Bad","source":"custom","nutrients":{}}'])).rejects.toThrow('check constraint')
  })
  it('enforces one measurement per day and duplicate file detection', async () => {
    await asUser(alice)
    await database.query("insert into public.measurements(user_id, date, weight_kg) values ($1, '2026-10-06', 76) on conflict(user_id,date) do update set weight_kg = excluded.weight_kg", [alice])
    expect((await database.query<{ weight_kg: string }>('select weight_kg from public.measurements')).rows[0].weight_kg).toBe('76')
    const hash = 'a'.repeat(64)
    await database.query("insert into public.workouts(user_id,date,name,kind,minutes,import_hash) values ($1,'2026-10-06','Import','run',10,$2)", [alice, hash])
    await expect(database.query("insert into public.workouts(user_id,date,name,kind,minutes,import_hash) values ($1,'2026-10-06','Import','run',10,$2)", [alice, hash])).rejects.toThrow('unique constraint')
  })
})

describe('training plans', () => {
  type ConsentRow = { health_consent_at: string | null }
  async function rejects(sql: string, params: unknown[], message: string) {
    await database.exec('savepoint attempt')
    await expect(database.query(sql, params)).rejects.toThrow(message)
    await database.exec('rollback to savepoint attempt')
  }
  it('stores health information only together with explicit consent', async () => {
    await asUser(alice)
    await rejects('update public.training_plans set answers = $1', [answers({ limitations: ['knees'] })], 'check constraint')
    await rejects('update public.training_plans set answers = $1', [answers({ cautiousStart: true })], 'check constraint')
    await database.query("update public.training_plans set answers = $1, health_consent_at = '2000-01-01'", [answers({ limitations: ['knees'], healthConsent: true })])
    const consented = (await database.query<ConsentRow>('select health_consent_at from public.training_plans')).rows[0].health_consent_at
    expect(consented).not.toBeNull()
    expect(new Date(consented ?? 0).getFullYear()).toBeGreaterThan(2000)
    await database.query('update public.training_plans set answers = $1', [answers()])
    expect((await database.query<ConsentRow>('select health_consent_at from public.training_plans')).rows[0].health_consent_at).toBeNull()
  })
  it('lets the owner replace a plan by upsert but not take over another account', async () => {
    await asUser(alice)
    await database.query('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3) on conflict (user_id) do update set answers = excluded.answers, plan = excluded.plan', [alice, answers({ minutes: 45 }), plan])
    expect((await database.query<{ minutes: string }>("select answers->>'minutes' as minutes from public.training_plans")).rows[0].minutes).toBe('45')
    await asUser(bob)
    await expect(database.query('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3)', [alice, answers(), plan])).rejects.toThrow('row-level security')
  })
  it('rejects malformed or oversized documents', async () => {
    await asUser(bob)
    await rejects('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3)', [bob, answers(), '{"sessions":{}}'], 'check constraint')
    await rejects('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3)', [bob, answers({ note: 'x'.repeat(5000) }), plan], 'check constraint')
    await rejects('insert into public.training_plans(user_id, answers, plan) values ($1, $2, $3)', [bob, '[]', plan], 'check constraint')
  })
  it('lets the owner mark onboarding as finished without touching consent fields', async () => {
    await asUser(alice)
    await database.query('update public.profiles set onboarding_completed_at = now() where onboarding_completed_at is null')
    expect((await database.query<{ onboarding_completed_at: string | null }>('select onboarding_completed_at from public.profiles')).rows[0].onboarding_completed_at).not.toBeNull()
  })
})

describe('provider rate limits', () => {
  it('atomically caps upstream requests and restricts the budget function to the service role', async () => {
    await database.exec('set role service_role')
    const first = await database.query<{ allowed: boolean }>("select public.consume_api_budget('test', 2, 60) as allowed")
    const second = await database.query<{ allowed: boolean }>("select public.consume_api_budget('test', 2, 60) as allowed")
    const third = await database.query<{ allowed: boolean }>("select public.consume_api_budget('test', 2, 60) as allowed")
    expect(first.rows[0].allowed).toBe(true)
    expect(second.rows[0].allowed).toBe(true)
    expect(third.rows[0].allowed).toBe(false)
    await asUser(alice)
    await expect(database.query("select public.consume_api_budget('test', 2, 60)")).rejects.toThrow('permission denied')
  })
})
