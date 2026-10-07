import { beforeEach, describe, expect, it } from 'vitest'
import { clearProgress, newProgress, progressScope, readProgress, writeProgress } from './progress'

const scope = progressScope('demo', undefined)
const plan = '2026-10-07T10:00:00.000Z'

describe('workout progress on this device', () => {
  beforeEach(() => localStorage.clear())
  it('restores an unfinished workout for the same account and plan', () => {
    const progress = { ...newProgress(scope, plan, 's2', 1000), index: 4, done: ['w0', 'w1'], updatedAt: 2000 }
    writeProgress(progress)
    expect(readProgress(scope, plan, 3000)).toEqual(progress)
  })
  it('ignores progress from another account, another plan, a finished or a stale workout', () => {
    writeProgress({ ...newProgress(scope, plan, 's1', 1000), index: 2 })
    expect(readProgress(progressScope('cloud', 'user-1'), plan, 2000)).toBeNull()
    expect(readProgress(scope, '2026-10-08T10:00:00.000Z', 2000)).toBeNull()
    expect(readProgress(scope, plan, 1000 + 13 * 60 * 60 * 1000)).toBeNull()
    writeProgress({ ...newProgress(scope, plan, 's1', 1000), finishedAt: 1500 })
    expect(readProgress(scope, plan, 2000)).toBeNull()
  })
  it('survives corrupted storage and can be cleared', () => {
    localStorage.setItem('flexa:workout:v1', '{broken')
    expect(readProgress(scope, plan)).toBeNull()
    writeProgress(newProgress(scope, plan, 's1'))
    clearProgress()
    expect(localStorage.getItem('flexa:workout:v1')).toBeNull()
  })
})
