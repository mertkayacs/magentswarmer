import { describe, it, expect } from 'vitest'
import type { SharedFormState, WorkerEntry } from '../src/state/types.js'

const shared: SharedFormState = {
  provider: 'cc',
  auth: 'subscription',
  model: null,
  permissions: 'skip',
  effort: 'high',
}

const workers: WorkerEntry[] = [
  { name: 'backend', prompt: 'build the REST API' },
  { name: 'frontend', prompt: 'build the React UI' },
]

describe('buildSpawnRequests', () => {
  it('maps every worker to a SpawnRequest with correct provider/auth', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('build an app', 'v1', shared, workers)
    expect(reqs).toHaveLength(2)
    expect(reqs[0]?.provider).toBe('cc')
    expect(reqs[0]?.auth).toBe('subscription')
    expect(reqs[1]?.provider).toBe('cc')
  })

  it('sets name and start_prompt from each worker', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('build an app', 'v1', shared, workers)
    expect(reqs[0]?.name).toBe('backend')
    expect(reqs[0]?.start_prompt).toBe('build the REST API')
    expect(reqs[1]?.name).toBe('frontend')
    expect(reqs[1]?.start_prompt).toBe('build the React UI')
  })

  it('propagates goal and tag to every request', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('my goal', 'sprint-1', shared, workers)
    for (const r of reqs) {
      expect(r.goal).toBe('my goal')
      expect(r.tag).toBe('sprint-1')
    }
  })

  it('propagates working_dir to every request', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', shared, workers, '/srv/project')
    for (const r of reqs) {
      expect(r.working_dir).toBe('/srv/project')
    }
  })

  it('working_dir is undefined when not provided', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', shared, workers)
    for (const r of reqs) {
      expect(r.working_dir).toBeUndefined()
    }
  })

  it('null model becomes undefined (omitted from CLI flags)', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', { ...shared, model: null }, workers)
    expect(reqs[0]?.model).toBeUndefined()
  })

  it('non-null model is preserved', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', { ...shared, model: 'opus' }, workers)
    expect(reqs[0]?.model).toBe('opus')
  })

  it('null effort becomes undefined', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', { ...shared, effort: null }, workers)
    expect(reqs[0]?.effort).toBeUndefined()
  })

  it('permissions defaults to skip when falsy', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', { ...shared, permissions: 'ask' }, workers)
    expect(reqs[0]?.permissions).toBe('ask')
  })

  it('handles empty workers array', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', shared, [])
    expect(reqs).toHaveLength(0)
  })

  it('handles single worker', async () => {
    const { buildSpawnRequests } = await import('../src/launcher/orchestrate.js')
    const reqs = buildSpawnRequests('goal', 'tag', shared, [{ name: 'solo', prompt: 'do everything' }])
    expect(reqs).toHaveLength(1)
    expect(reqs[0]?.name).toBe('solo')
  })
})
