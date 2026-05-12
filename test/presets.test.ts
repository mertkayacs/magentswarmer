import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('preset operations', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `preset-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_STATE = join(tmpDir, 'state.json')
  })

  afterEach(() => {
    delete process.env.REEVES_STATE
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('adds a preset with shared config', async () => {
    const { loadState, addPreset } = await import('../src/state/store.js')
    addPreset('test-preset', 'test goal', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    const state = loadState()
    expect(state.presets).toHaveLength(1)
    expect(state.presets[0].shared.provider).toBe('cc')
  })

  it('removes a preset', async () => {
    const { loadState, addPreset, removePreset } = await import('../src/state/store.js')
    addPreset('to-delete', 'goal', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    removePreset('to-delete')
    const state = loadState()
    expect(state.presets).toHaveLength(0)
  })

  it('upserts preset by name', async () => {
    const { loadState, addPreset } = await import('../src/state/store.js')
    addPreset('upsert-test', 'goal1', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    addPreset('upsert-test', 'goal2', [{ name: 'w2', prompt: 'p2' }], { provider: 'gemini', auth: 'api-key', model: null, permissions: 'ask', effort: 'low' })
    const state = loadState()
    expect(state.presets).toHaveLength(1)
    expect(state.presets[0].goal).toBe('goal2')
    expect(state.presets[0].shared.provider).toBe('gemini')
  })
})
