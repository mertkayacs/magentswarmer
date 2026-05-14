import { describe, it, expect } from 'vitest'

describe('parseWorkers', () => {
  it('splits name and prompt on first colon', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['api:build the REST API'])
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('api')
    expect(result[0]?.prompt).toBe('build the REST API')
  })

  it('auto-names worker when no colon present', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['build the REST API'])
    expect(result[0]?.name).toBe('worker-1')
    expect(result[0]?.prompt).toBe('build the REST API')
  })

  it('names use 1-based index for auto-generated names', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['task one', 'task two', 'task three'])
    expect(result[0]?.name).toBe('worker-1')
    expect(result[1]?.name).toBe('worker-2')
    expect(result[2]?.name).toBe('worker-3')
  })

  it('colon in prompt body is preserved in prompt', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['backend:build api: include auth: and users:'])
    expect(result[0]?.name).toBe('backend')
    expect(result[0]?.prompt).toBe('build api: include auth: and users:')
  })

  it('empty string name before colon is kept', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers([':just a prompt'])
    expect(result[0]?.name).toBe('')
    expect(result[0]?.prompt).toBe('just a prompt')
  })

  it('empty string after colon becomes empty prompt', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['worker:'])
    expect(result[0]?.name).toBe('worker')
    expect(result[0]?.prompt).toBe('')
  })

  it('empty array returns empty array', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    expect(parseWorkers([])).toHaveLength(0)
  })

  it('multiple workers preserve their order', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['front:build UI', 'back:build API', 'infra:provision DB'])
    expect(result.map(w => w.name)).toEqual(['front', 'back', 'infra'])
    expect(result.map(w => w.prompt)).toEqual(['build UI', 'build API', 'provision DB'])
  })

  it('mixed named and unnamed workers in same call', async () => {
    const { parseWorkers } = await import('../src/utils/parseWorkers.js')
    const result = parseWorkers(['unnamed task', 'named:do this', 'another unnamed'])
    expect(result[0]?.name).toBe('worker-1')
    expect(result[1]?.name).toBe('named')
    expect(result[2]?.name).toBe('worker-3')
  })
})
