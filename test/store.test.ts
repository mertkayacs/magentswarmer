import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { SavedTree } from '../src/state/types.js'

let testName: string
let tmpHome: string
let oldHome: string | undefined

beforeEach(() => {
  oldHome = process.env.HOME
  tmpHome = mkdtempSync(join(tmpdir(), 'reeves-store-test-'))
  process.env.HOME = tmpHome
  testName = `_test-${randomUUID().slice(0, 8)}`
})

afterEach(async () => {
  const { deleteSavedTree } = await import('../src/state/store.js')
  deleteSavedTree(testName)
  if (oldHome === undefined) delete process.env.HOME
  else process.env.HOME = oldHome
  rmSync(tmpHome, { recursive: true, force: true })
})

function makeTree(name: string, overrides: Partial<SavedTree> = {}): SavedTree {
  const now = new Date().toISOString()
  return {
    name,
    description: 'test tree',
    root: {
      nickname_template: 'root',
      provider: 'cc',
      model: '',
      auth_mode: 'default',
      effort: 'default',
      task_template: 'do the work',
      working_dir: '/tmp',
      permissions: 'skip',
      rc_enabled: false,
    },
    workers: [],
    working_dir_pattern: '/tmp',
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}

describe('store', () => {
  it('listSavedTrees returns an array', async () => {
    const { listSavedTrees } = await import('../src/state/store.js')
    expect(Array.isArray(listSavedTrees())).toBe(true)
  })

  it('saveSavedTree + loadSavedTree roundtrip', async () => {
    const { saveSavedTree, loadSavedTree } = await import('../src/state/store.js')
    saveSavedTree(makeTree(testName))
    const loaded = loadSavedTree(testName)
    expect(loaded?.name).toBe(testName)
    expect(loaded?.description).toBe('test tree')
    expect(loaded?.root.provider).toBe('cc')
    expect(loaded?.root.task_template).toBe('do the work')
  })

  it('saveSavedTree makes tree appear in listSavedTrees', async () => {
    const { saveSavedTree, listSavedTrees } = await import('../src/state/store.js')
    saveSavedTree(makeTree(testName))
    expect(listSavedTrees().map(t => t.name)).toContain(testName)
  })

  it('saveSavedTree with workers preserves worker array', async () => {
    const { saveSavedTree, loadSavedTree } = await import('../src/state/store.js')
    const tree = makeTree(testName, {
      workers: [{
        nickname_template: 'worker-1',
        provider: 'codex',
        model: 'gpt-4o',
        auth_mode: 'default',
        effort: 'default',
        task_template: 'help with {{root_task}}',
        working_dir: '/tmp',
        permissions: 'ask',
        rc_enabled: false,
      }]
    })
    saveSavedTree(tree)
    const loaded = loadSavedTree(testName)
    expect(loaded?.workers).toHaveLength(1)
    expect(loaded?.workers[0]?.provider).toBe('codex')
    expect(loaded?.workers[0]?.task_template).toBe('help with {{root_task}}')
  })

  it('deleteSavedTree removes tree from listSavedTrees', async () => {
    const { saveSavedTree, deleteSavedTree, listSavedTrees } = await import('../src/state/store.js')
    saveSavedTree(makeTree(testName))
    deleteSavedTree(testName)
    expect(listSavedTrees().map(t => t.name)).not.toContain(testName)
  })

  it('loadSavedTree returns null for a missing tree', async () => {
    const { loadSavedTree } = await import('../src/state/store.js')
    expect(loadSavedTree('definitely-does-not-exist-xyzzy-999')).toBeNull()
  })

  it('deleteSavedTree on a missing tree does not throw', async () => {
    const { deleteSavedTree } = await import('../src/state/store.js')
    expect(() => deleteSavedTree('definitely-does-not-exist-xyzzy-999')).not.toThrow()
  })

  it('overwriting a tree with saveSavedTree updates it', async () => {
    const { saveSavedTree, loadSavedTree } = await import('../src/state/store.js')
    saveSavedTree(makeTree(testName, { description: 'original' }))
    saveSavedTree(makeTree(testName, { description: 'updated' }))
    expect(loadSavedTree(testName)?.description).toBe('updated')
  })
})
