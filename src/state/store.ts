// App persistence: last Spawn form state and saved orchestration trees.
// Inputs: SpawnFormState (last used), SavedTree (named tree definitions).
// Outputs: typed reads with defaults; atomic writes.
// Invariant: all reads return defaults on any parse error.

import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, renameSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { SpawnFormState, SavedTree, SavedTreeSlot } from './types.js'

function stateDir(): string {
  return join(homedir(), '.reeves')
}

function spawnStatePath(): string {
  return join(stateDir(), 'spawn-state.json')
}

export function savedTreesDir(): string {
  return join(stateDir(), 'saved-trees')
}

function defaultSpawnState(): SpawnFormState {
  return {
    provider: 'cc',
    model: '',
    auth_mode: 'default',
    effort: 'default',
    task: '',
    working_dir: '',
    nickname: '',
    permissions: 'ask',
    rc_enabled: false,
  }
}

function atomicWrite(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  try {
    renameSync(tmp, path)
  } catch {
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8')
  }
}

export function loadLastSpawn(): SpawnFormState {
  try {
    const raw = JSON.parse(readFileSync(spawnStatePath(), 'utf-8')) as Record<string, unknown>
    const d = defaultSpawnState()
    return {
      provider: raw.provider === 'codex' || raw.provider === 'gemini' || raw.provider === 'hermes' || raw.provider === 'cc' ? raw.provider : d.provider,
      model: typeof raw.model === 'string' ? raw.model : d.model,
      auth_mode: raw.auth_mode === 'api-key' ? 'api-key' : d.auth_mode,
      effort: isEffort(raw.effort) ? raw.effort : d.effort,
      task: typeof raw.task === 'string' ? raw.task : d.task,
      working_dir: typeof raw.working_dir === 'string' ? raw.working_dir : d.working_dir,
      nickname: typeof raw.nickname === 'string' ? raw.nickname : d.nickname,
      permissions: raw.permissions === 'skip' ? 'skip' : d.permissions,
      rc_enabled: typeof raw.rc_enabled === 'boolean' ? raw.rc_enabled : d.rc_enabled,
    }
  } catch {
    return defaultSpawnState()
  }
}

function isEffort(value: unknown): value is SpawnFormState['effort'] {
  return value === 'default' || value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh' || value === 'max'
}

function normalizeSlot(raw: Record<string, unknown>, fallbackDir = ''): SavedTreeSlot {
  return {
    nickname_template: typeof raw.nickname_template === 'string' ? raw.nickname_template : 'agent',
    provider: raw.provider === 'codex' || raw.provider === 'gemini' || raw.provider === 'hermes' ? raw.provider : 'cc',
    model: typeof raw.model === 'string' ? raw.model : '',
    auth_mode: raw.auth_mode === 'api-key' ? 'api-key' : 'default',
    effort: isEffort(raw.effort) ? raw.effort : 'default',
    task_template: typeof raw.task_template === 'string' ? raw.task_template : '',
    working_dir: typeof raw.working_dir === 'string' ? raw.working_dir : fallbackDir,
    permissions: raw.permissions === 'skip' ? 'skip' : 'ask',
    rc_enabled: typeof raw.rc_enabled === 'boolean' ? raw.rc_enabled : false,
  }
}

function normalizeSavedTree(raw: unknown): SavedTree | null {
  if (typeof raw !== 'object' || raw === null) return null
  const obj = raw as Record<string, unknown>
  const legacyDir = typeof obj.working_dir_pattern === 'string' ? obj.working_dir_pattern : ''
  const rootRaw = typeof obj.root === 'object' && obj.root !== null ? obj.root as Record<string, unknown> : {}
  const workersRaw = Array.isArray(obj.workers) ? obj.workers : []

  return {
    name: typeof obj.name === 'string' ? obj.name : 'preset',
    description: typeof obj.description === 'string' ? obj.description : '',
    root: normalizeSlot(rootRaw, legacyDir),
    workers: workersRaw
      .filter((w): w is Record<string, unknown> => typeof w === 'object' && w !== null)
      .map(w => normalizeSlot(w, legacyDir)),
    working_dir_pattern: legacyDir || undefined,
    created_at: typeof obj.created_at === 'string' ? obj.created_at : new Date().toISOString(),
    updated_at: typeof obj.updated_at === 'string' ? obj.updated_at : new Date().toISOString(),
  }
}

export function saveLastSpawn(state: SpawnFormState): void {
  atomicWrite(spawnStatePath(), state)
}

export function listSavedTrees(): SavedTree[] {
  const dir = savedTreesDir()
  if (!existsSync(dir)) return []
  try {
    return readdirSync(dir)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        try { return normalizeSavedTree(JSON.parse(readFileSync(join(dir, f), 'utf-8'))) }
        catch { return null }
      })
      .filter((t): t is SavedTree => t !== null)
  } catch {
    return []
  }
}

export function loadSavedTree(name: string): SavedTree | null {
  try {
    return normalizeSavedTree(JSON.parse(readFileSync(join(savedTreesDir(), `${name}.json`), 'utf-8')))
  } catch {
    return null
  }
}

export function saveSavedTree(tree: SavedTree): void {
  atomicWrite(join(savedTreesDir(), `${tree.name}.json`), tree)
}

export function deleteSavedTree(name: string): void {
  try { unlinkSync(join(savedTreesDir(), `${name}.json`)) } catch { /* already gone */ }
}
