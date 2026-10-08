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
const tables = ['profiles', 'meal_entries', 'workouts', 'water_entries', 'measurements', 'custom_foods', 'training_plans', 'goal_cycles']
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
    if (file === '202610100001_goal_cycles.sql') {
      await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $3), ($2, $3)', [alice, bob, consent])
    }
    await database.exec(await readFile(new URL(file, migrations), 'utf8'))
  }
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
      if (table === 'profiles' || table === 'goal_cycles') expect(deleted).toBeInstanceOf(Error)
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

describe('nutrition goals and cycles', () => {
  const day = new Date().toISOString().slice(0, 10)
  const start = (id: string, weight = 75, calories = 2300) => database.query<{ cycle_id: string }>(
    "select public.start_goal_cycle($1, 'maintenance', $2, '2100-01-01', $3, 72, $4, 150, 260, 70, 2500) as cycle_id",
    [id, day, weight, calories])
  async function rejects(run: () => Promise<unknown>, message: string) {
    await database.exec('savepoint attempt')
    await expect(run()).rejects.toThrow(message)
    await database.exec('rollback to savepoint attempt')
  }

  it('backfills existing accounts but leaves new accounts pending configuration', async () => {
    await asUser(alice)
    expect((await database.query<{ goals_setup_done_at: string | null }>('select goals_setup_done_at from public.profiles')).rows[0].goals_setup_done_at).not.toBeNull()
    await database.exec('reset role')
    const newUser = crypto.randomUUID()
    await database.query('insert into auth.users(id, raw_user_meta_data) values ($1, $2)', [newUser, consent])
    await asUser(newUser)
    expect((await database.query<{ goals_setup_done_at: string | null }>('select goals_setup_done_at from public.profiles')).rows[0].goals_setup_done_at).toBeNull()
  })

  it('atomically approves one cycle, archives the old one and updates the profile', async () => {
    const first = crypto.randomUUID()
    const second = crypto.randomUUID()
    await asUser(alice)
    expect((await start(first)).rows[0].cycle_id).toBe(first)
    expect((await start(first)).rows[0].cycle_id).toBe(first)
    expect((await database.query<{ id: string }>('select id from public.goal_cycles')).rows).toHaveLength(1)
    expect((await start(second, 75, 2500)).rows[0].cycle_id).toBe(second)
    const cycles = (await database.query<{ status: string; calorie_goal: string; completed_at: string | null }>(
      'select status, calorie_goal, completed_at from public.goal_cycles order by calorie_goal')).rows
    expect(cycles).toMatchObject([
      { status: 'completed', calorie_goal: '2300' },
      { status: 'active', calorie_goal: '2500', completed_at: null },
    ])
    expect(cycles[0].completed_at).not.toBeNull()
    expect((await database.query<{ calorie_goal: string; target_weight: string }>(
      'select calorie_goal, target_weight from public.profiles')).rows[0]).toMatchObject({ calorie_goal: '2500', target_weight: '72' })
    expect((await database.query('select * from public.measurements where date = $1', [day])).rows).toHaveLength(1)
  })

  it('rejects conflicting start measurements and invalid goals without partial writes', async () => {
    await asUser(alice)
    await database.query('insert into public.measurements(user_id, date, weight_kg) values ($1, $2, 74) on conflict (user_id, date) do update set weight_kg = 74', [alice, day])
    await rejects(() => start(crypto.randomUUID()), 'Dla daty początku')
    expect((await database.query('select * from public.goal_cycles')).rows).toHaveLength(0)
    await rejects(() => start(crypto.randomUUID(), 74, 1), 'check constraint')
    expect((await database.query('select * from public.goal_cycles')).rows).toHaveLength(0)
    expect((await database.query<{ weight_kg: string }>('select weight_kg from public.measurements where date = $1', [day])).rows[0].weight_kg).toBe('74')
    expect((await database.query<{ calorie_goal: string }>('select calorie_goal from public.profiles')).rows[0].calorie_goal).toBe('2200')
  })

  it('isolates cycle history and only changes approved goals through atomic functions', async () => {
    await asUser(alice)
    const id = crypto.randomUUID()
    await start(id)
    await rejects(() => database.query('update public.profiles set calorie_goal = 999'), 'permission denied')
    await rejects(() => database.query('update public.goal_cycles set calorie_goal = 999'), 'permission denied')
    await database.query('select public.save_flexa_profile($1, 2400, 155, 265, 75, 2600, 160, 70)', ['Ala'])
    expect((await database.query<{ calorie_goal: string; target_weight_kg: string }>('select calorie_goal, target_weight_kg from public.goal_cycles')).rows[0])
      .toMatchObject({ calorie_goal: '2400', target_weight_kg: '70' })
    await asUser(bob)
    expect((await database.query('select * from public.goal_cycles')).rows).toHaveLength(0)
    await rejects(() => database.query('insert into public.goal_cycles(id, user_id) values ($1, $2)', [crypto.randomUUID(), alice]), 'permission denied')
    await database.exec('reset role; set role anon')
    await rejects(() => start(crypto.randomUUID()), 'permission denied')
  })

  it('restores only completed history without activating it or changing the profile', async () => {
    const history = [{
      id: crypto.randomUUID(), kind: 'maintenance', startDate: '2020-01-01', endDate: '2020-02-01',
      startWeightKg: 75, targetWeightKg: null, calorieGoal: 2300, proteinGoal: 150,
      carbsGoal: 260, fatGoal: 70, waterGoal: 2500, status: 'completed',
      createdAt: '2020-01-01T10:00:00Z', completedAt: '2020-02-01T10:00:00Z',
    }]
    await asUser(alice)
    expect((await database.query<{ restored: number }>('select public.restore_goal_cycle_history($1::jsonb) as restored',
      [JSON.stringify(history)])).rows[0].restored).toBe(1)
    expect((await database.query<{ status: string }>('select status from public.goal_cycles')).rows).toEqual([{ status: 'completed' }])
    expect((await database.query<{ calorie_goal: string; target_weight: string | null }>('select calorie_goal, target_weight from public.profiles')).rows[0])
      .toMatchObject({ calorie_goal: '2200', target_weight: null })
    await rejects(() => database.query('select public.restore_goal_cycle_history($1::jsonb)', [JSON.stringify(history)]), 'Historia cykli już istnieje')
    await asUser(bob)
    expect((await database.query('select * from public.goal_cycles')).rows).toHaveLength(0)
    await database.exec('reset role; set role anon')
    await rejects(() => database.query('select public.restore_goal_cycle_history($1::jsonb)', [JSON.stringify(history)]), 'permission denied')
  })

  it('rolls back the entire imported history when a cycle is active or a later record is invalid', async () => {
    const valid = { id: crypto.randomUUID(), kind: 'maintenance', startDate: '2020-01-01',
      endDate: '2020-02-01', startWeightKg: 75, targetWeightKg: null,
      calorieGoal: 2300, proteinGoal: 150, carbsGoal: 260, fatGoal: 70, waterGoal: 2500,
      status: 'completed', createdAt: '2020-01-01T10:00:00Z', completedAt: '2020-02-01T10:00:00Z' }
    await asUser(alice)
    await rejects(() => database.query('select public.restore_goal_cycle_history($1::jsonb)',
      [JSON.stringify([valid, { ...valid, id: crypto.randomUUID(), status: 'active', completedAt: null }])]), 'Import dopuszcza')
    await rejects(() => database.query('select public.restore_goal_cycle_history($1::jsonb)',
      [JSON.stringify([valid, { ...valid, id: crypto.randomUUID(), calorieGoal: -1 }])]), 'check constraint')
    expect((await database.query('select * from public.goal_cycles')).rows).toHaveLength(0)
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

describe('workout sets and extended measurements', () => {
  async function rejects(sql: string, params: unknown[], message: string) {
    await database.exec('savepoint attempt')
    await expect(database.query(sql, params)).rejects.toThrow(message)
    await database.exec('rollback to savepoint attempt')
  }
  it('defaults existing workouts to no sets and lets the owner store a bounded array', async () => {
    await asUser(alice)
    expect((await database.query<{ sets: unknown }>('select sets from public.workouts')).rows[0].sets).toEqual([])
    const sets = JSON.stringify([{ exercise: 'goblet-squat-db', reps: 10, weightKg: 16, seconds: null }])
    await database.query("insert into public.workouts(user_id, date, name, kind, minutes, sets) values ($1, '2026-10-07', 'Siła', 'strength', 40, $2)", [alice, sets])
    expect((await database.query<{ sets: unknown[] }>("select sets from public.workouts where name = 'Siła'")).rows[0].sets).toHaveLength(1)
    await rejects("insert into public.workouts(user_id, date, name, kind, minutes, sets) values ($1, '2026-10-07', 'Siła', 'strength', 40, $2)", [alice, '{"exercise":"x"}'], 'check constraint')
    await rejects("insert into public.workouts(user_id, date, name, kind, minutes, sets) values ($1, '2026-10-07', 'Siła', 'strength', 40, $2)",
      [alice, JSON.stringify(Array.from({ length: 201 }, () => ({ exercise: 'x', reps: 1, weightKg: null, seconds: null })))], 'check constraint')
    await rejects("insert into public.workouts(user_id, date, name, kind, minutes, sets) values ($1, '2026-10-07', 'Siła', 'strength', 40, null)", [alice], 'null value')
  })
  it('stores optional body measurements within plausible ranges', async () => {
    await asUser(alice)
    await database.query("insert into public.measurements(user_id, date, weight_kg, waist_cm, hips_cm, body_fat_pct) values ($1, '2026-10-06', 75, 82.5, 98, 21) on conflict (user_id, date) do update set weight_kg = excluded.weight_kg, waist_cm = excluded.waist_cm, hips_cm = excluded.hips_cm, body_fat_pct = excluded.body_fat_pct", [alice])
    expect((await database.query<{ waist_cm: string; body_fat_pct: string }>('select waist_cm, body_fat_pct from public.measurements')).rows[0]).toMatchObject({ waist_cm: '82.5', body_fat_pct: '21' })
    await rejects("insert into public.measurements(user_id, date, weight_kg, waist_cm) values ($1, '2026-10-07', 75, 20)", [alice], 'check constraint')
    await rejects("insert into public.measurements(user_id, date, weight_kg, body_fat_pct) values ($1, '2026-10-07', 75, 90)", [alice], 'check constraint')
    await asUser(bob)
    expect((await database.query('select waist_cm from public.measurements')).rows).toHaveLength(0)
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

describe('kitchen AI daily quota', () => {
  const consume = async (kind: string, limit: number) =>
    (await database.query<{ allowed: boolean }>('select public.consume_kitchen_ai($1, $2) as allowed', [kind, limit])).rows[0].allowed
  const rejectsInside = async (run: () => Promise<unknown>, message: string) => {
    await database.exec('savepoint attempt')
    await expect(run()).rejects.toThrow(message)
    await database.exec('rollback to savepoint attempt')
  }

  it('allows the daily limit, then denies — separately for each kind and each account', async () => {
    await asUser(alice)
    expect(await consume('vision', 2)).toBe(true)
    expect(await consume('vision', 2)).toBe(true)
    expect(await consume('vision', 2)).toBe(false)
    expect(await consume('vision', 2)).toBe(false)
    expect(await consume('image', 2)).toBe(true)
    await asUser(bob)
    expect(await consume('vision', 2)).toBe(true)
  })

  it('requires a signed-in user and valid parameters, and keeps the counters private', async () => {
    await database.exec("reset role; select set_config('request.jwt.claim.sub', '', false); set role authenticated;")
    await rejectsInside(() => consume('vision', 2), 'Wymagane logowanie')
    await database.exec('reset role; set role anon;')
    await rejectsInside(() => consume('vision', 2), 'permission denied')
    await asUser(alice)
    await rejectsInside(() => consume('video', 2), 'Nieprawidłowe parametry')
    await rejectsInside(() => consume('vision', 0), 'Nieprawidłowe parametry')
    await rejectsInside(() => consume('vision', 999), 'Nieprawidłowe parametry')
    await rejectsInside(() => database.query('select * from private.kitchen_ai_usage'), 'permission denied')
  })

  it('forgets old usage and removes it together with the account', async () => {
    await database.exec('reset role')
    await database.query("insert into private.kitchen_ai_usage(user_id, kind, day, uses) values ($1, 'vision', (now() at time zone 'utc')::date - 30, 5)", [alice])
    await asUser(alice)
    expect(await consume('vision', 5)).toBe(true)
    await database.exec('reset role')
    const stale = await database.query("select * from private.kitchen_ai_usage where day < (now() at time zone 'utc')::date - 7")
    expect(stale.rows).toHaveLength(0)
    expect((await database.query('select * from private.kitchen_ai_usage where user_id = $1', [alice])).rows).toHaveLength(1)
    await database.query('delete from auth.users where id = $1', [alice])
    expect((await database.query('select * from private.kitchen_ai_usage where user_id = $1', [alice])).rows).toHaveLength(0)
  })
})

describe('meal templates', () => {
  const item = (patch: Record<string, unknown> = {}) => ({ food: JSON.parse(food) as unknown, portion: 120, ...patch })
  const items = (...values: unknown[]) => JSON.stringify(values)
  const insert = (name: string, value: string) => database.query<{ id: string; user_id: string }>(
    'insert into public.meal_templates(name, items) values ($1, $2) returning id, user_id', [name, value])
  async function rejects(run: () => Promise<unknown>, message: string) {
    await database.exec('savepoint attempt')
    await expect(run()).rejects.toThrow(message)
    await database.exec('rollback to savepoint attempt')
  }

  it('assigns the owner from the session and keeps templates private', async () => {
    await asUser(alice)
    const created = (await insert('Moje śniadanie', items(item(), item({ portion: 30 })))).rows[0]
    expect(created.user_id).toBe(alice)
    expect((await database.query('select * from public.meal_templates')).rows).toHaveLength(1)
    await asUser(bob)
    expect((await database.query('select * from public.meal_templates')).rows).toHaveLength(0)
    expect((await database.query('delete from public.meal_templates where id = $1 returning id', [created.id])).rows).toHaveLength(0)
    await rejects(() => database.query('insert into public.meal_templates(user_id, name, items) values ($1, $2, $3)', [alice, 'Cudzy', items(item())]), 'row-level security')
    await asUser(alice)
    await rejects(() => database.query("update public.meal_templates set name = 'Inna'"), 'permission denied')
    expect((await database.query('delete from public.meal_templates where id = $1 returning id', [created.id])).rows).toHaveLength(1)
  })

  it('denies anonymous access', async () => {
    await database.exec('set role anon')
    await rejects(() => database.query('select * from public.meal_templates'), 'permission denied')
  })

  it('rejects malformed, empty, oversized and duplicate templates', async () => {
    await asUser(alice)
    await rejects(() => insert('Pusty', '[]'), 'check constraint')
    await rejects(() => insert('Obiekt', '{}'), 'check constraint')
    await rejects(() => insert('Za dużo', items(...Array.from({ length: 31 }, () => item()))), 'check constraint')
    await rejects(() => insert('Bez porcji', items({ food: JSON.parse(food) as unknown })), 'check constraint')
    await rejects(() => insert('Zła porcja', items(item({ portion: 0 }))), 'check constraint')
    await rejects(() => insert('Bez kcal', items(item({ food: { ...JSON.parse(food) as object, nutrients: { kcal: null } } }))), 'check constraint')
    await rejects(() => insert('Bez jednostki', items(item({ food: { ...JSON.parse(food) as object, unit: null } }))), 'check constraint')
    await rejects(() => insert('Liczba', items(5)), 'check constraint')
    await rejects(() => insert(' ', items(item())), 'check constraint')
    await rejects(() => insert('x'.repeat(61), items(item())), 'check constraint')
    await rejects(() => insert('Długi', items(item({ note: 'x'.repeat(61000) }))), 'check constraint')
    await insert('Kolacja', items(item()))
    await rejects(() => insert(' kolacja ', items(item())), 'unique')
    expect((await insert('Przekąska', items(...Array.from({ length: 30 }, () => item())))).rows).toHaveLength(1)
  })

  it('removes templates together with the account', async () => {
    await asUser(alice)
    await insert('Na wynos', items(item()))
    await database.exec('reset role')
    await database.query('delete from auth.users where id = $1', [alice])
    expect((await database.query('select * from public.meal_templates where user_id = $1', [alice])).rows).toHaveLength(0)
  })
})
