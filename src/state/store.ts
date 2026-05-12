// App-level state: spawn/orchestrate history, presets, recent sessions.
// Reads from REEVES_STATE env or ~/.reeves/state.json.
// Atomic writes, field defaults, cap workers at 8, recent sessions at 10.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type {
  AppState,
  SpawnFormState,
  SharedFormState,
  OrchestrateFormState,
  WorkerEntry,
  Preset,
  Provider,
  Auth,
  Permissions,
  Effort
} from './types.js'

const SCHEMA_VERSION = 1
const RECENT_SESSIONS_LIMIT = 10
const MAX_WORKERS = 8

function defaultSpawnFormState(): SpawnFormState {
  return {
    provider: 'cc',
    auth: 'subscription',
    model: 'opus',
    permissions: 'skip',
    effort: 'high',
    tag: null,
    name: null,
    prompt: '',
    working_dir: ''
  }
}

function defaultSharedFormState(): SharedFormState {
  return {
    provider: 'cc',
    auth: 'subscription',
    model: 'opus',
    permissions: 'skip',
    effort: 'high'
  }
}

function defaultOrchestrateFormState(): OrchestrateFormState {
  return {
    goal: '',
    tag: '',
    shared: defaultSharedFormState(),
    workers: [{ name: '', prompt: '' }]
  }
}

export function defaultState(): AppState {
  return {
    version: SCHEMA_VERSION,
    last_spawn: defaultSpawnFormState(),
    last_orchestrate: defaultOrchestrateFormState(),
    presets: [],
    recent_sessions: [],
    history: {
      spawned_total: 0,
      orchestrated_total: 0
    }
  }
}

export function statePath(): string {
  const base = process.env.REEVES_STATE
  if (base) return base
  return join(homedir(), '.reeves', 'state.json')
}

function mergeDefaults(raw: unknown): AppState {
  const defaults = defaultState()

  if (typeof raw !== 'object' || raw === null) return defaults

  const obj = raw as Record<string, unknown>
  const merged: AppState = {
    version: typeof obj.version === 'number' ? obj.version : defaults.version,
    last_spawn: defaultSpawnFormState(),
    last_orchestrate: defaultOrchestrateFormState(),
    presets: [],
    recent_sessions: [],
    history: {
      spawned_total: 0,
      orchestrated_total: 0
    }
  }

  // Merge last_spawn
  if (typeof obj.last_spawn === 'object' && obj.last_spawn !== null) {
    const ls = obj.last_spawn as Record<string, unknown>
    merged.last_spawn = {
      provider: (ls.provider as Provider) || defaults.last_spawn.provider,
      auth: (ls.auth as Auth) || defaults.last_spawn.auth,
      model: (ls.model as string | null) ?? defaults.last_spawn.model,
      permissions: (ls.permissions as Permissions) || defaults.last_spawn.permissions,
      effort: (ls.effort as Effort | null) ?? defaults.last_spawn.effort,
      tag: (ls.tag as string | null) ?? defaults.last_spawn.tag,
      name: (ls.name as string | null) ?? defaults.last_spawn.name,
      prompt: (ls.prompt as string) || defaults.last_spawn.prompt,
      working_dir: (ls.working_dir as string) || defaults.last_spawn.working_dir
    }
  }

  // Merge last_orchestrate
  if (typeof obj.last_orchestrate === 'object' && obj.last_orchestrate !== null) {
    const lo = obj.last_orchestrate as Record<string, unknown>
    const shared = typeof lo.shared === 'object' && lo.shared !== null
      ? {
        provider: ((lo.shared as Record<string, unknown>).provider as Provider) || defaults.last_orchestrate.shared.provider,
        auth: ((lo.shared as Record<string, unknown>).auth as Auth) || defaults.last_orchestrate.shared.auth,
        model: ((lo.shared as Record<string, unknown>).model as string | null) ?? defaults.last_orchestrate.shared.model,
        permissions: ((lo.shared as Record<string, unknown>).permissions as Permissions) || defaults.last_orchestrate.shared.permissions,
        effort: ((lo.shared as Record<string, unknown>).effort as Effort | null) ?? defaults.last_orchestrate.shared.effort
      }
      : defaults.last_orchestrate.shared

    let workers: WorkerEntry[] = []
    if (Array.isArray(lo.workers)) {
      workers = (lo.workers as unknown[]).slice(0, MAX_WORKERS).map(w => {
        if (typeof w === 'object' && w !== null) {
          return {
            name: ((w as Record<string, unknown>).name as string) || '',
            prompt: ((w as Record<string, unknown>).prompt as string) || ''
          }
        }
        return { name: '', prompt: '' }
      })
    }

    merged.last_orchestrate = {
      goal: (lo.goal as string) || defaults.last_orchestrate.goal,
      tag: (lo.tag as string) || defaults.last_orchestrate.tag,
      shared,
      workers
    }
  }

  // Merge presets
  if (Array.isArray(obj.presets)) {
    merged.presets = (obj.presets as unknown[]).map(p => {
      if (typeof p === 'object' && p !== null) {
        const pr = p as Record<string, unknown>
        const workers = Array.isArray(pr.workers) ? (pr.workers as unknown[]).slice(0, MAX_WORKERS).map(w => {
          if (typeof w === 'object' && w !== null) {
            return {
              name: ((w as Record<string, unknown>).name as string) || '',
              prompt: ((w as Record<string, unknown>).prompt as string) || ''
            }
          }
          return { name: '', prompt: '' }
        }) : []
        const shared = typeof pr.shared === 'object' && pr.shared !== null
          ? {
            provider: ((pr.shared as Record<string, unknown>).provider as Provider) || defaults.last_orchestrate.shared.provider,
            auth: ((pr.shared as Record<string, unknown>).auth as Auth) || defaults.last_orchestrate.shared.auth,
            model: ((pr.shared as Record<string, unknown>).model as string | null) ?? defaults.last_orchestrate.shared.model,
            permissions: ((pr.shared as Record<string, unknown>).permissions as Permissions) || defaults.last_orchestrate.shared.permissions,
            effort: ((pr.shared as Record<string, unknown>).effort as Effort | null) ?? defaults.last_orchestrate.shared.effort
          }
          : defaultSharedFormState()
        return {
          name: (pr.name as string) || '',
          goal: (pr.goal as string) || '',
          workers,
          shared
        }
      }
      return { name: '', goal: '', workers: [], shared: defaultSharedFormState() }
    })
  }

  // Merge recent_sessions
  if (Array.isArray(obj.recent_sessions)) {
    merged.recent_sessions = (obj.recent_sessions as unknown[])
      .filter(s => typeof s === 'string')
      .slice(0, RECENT_SESSIONS_LIMIT)
  }

  // Merge history
  if (typeof obj.history === 'object' && obj.history !== null) {
    const h = obj.history as Record<string, unknown>
    merged.history = {
      spawned_total: typeof h.spawned_total === 'number' ? h.spawned_total : 0,
      orchestrated_total: typeof h.orchestrated_total === 'number' ? h.orchestrated_total : 0
    }
  }

  return merged
}

export function loadState(): AppState {
  const path = statePath()
  try {
    const content = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(content)
    return mergeDefaults(parsed)
  } catch {
    return defaultState()
  }
}

export function saveState(state: AppState): string {
  const path = statePath()
  const dir = dirname(path)

  mkdirSync(dir, { recursive: true })

  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf-8')

  try {
    renameSync(tmpPath, path)
  } catch {
    writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8')
  }

  return path
}

export function setLastSpawn(values: Partial<SpawnFormState>): void {
  const state = loadState()
  state.last_spawn = {
    ...state.last_spawn,
    ...values
  }
  state.history.spawned_total++
  saveState(state)
}

export function setLastOrchestrate(values: Partial<OrchestrateFormState>): void {
  const state = loadState()
  state.last_orchestrate = {
    ...state.last_orchestrate,
    ...values
  }
  state.history.orchestrated_total++
  saveState(state)
}

export function addRecentSession(sessionId: string): void {
  const state = loadState()

  // Remove duplicates
  state.recent_sessions = state.recent_sessions.filter(s => s !== sessionId)

  // Prepend
  state.recent_sessions.unshift(sessionId)

  // Cap at limit
  state.recent_sessions = state.recent_sessions.slice(0, RECENT_SESSIONS_LIMIT)

  saveState(state)
}

export function addPreset(name: string, goal: string, workers: WorkerEntry[], shared: SharedFormState): void {
  const state = loadState()

  // Upsert by name
  const idx = state.presets.findIndex(p => p.name === name)

  const capped = workers.slice(0, MAX_WORKERS)
  const preset: Preset = { name, goal, workers: capped, shared }

  if (idx >= 0) {
    state.presets[idx] = preset
  } else {
    state.presets.push(preset)
  }

  saveState(state)
}

export function removePreset(name: string): void {
  const state = loadState()
  state.presets = state.presets.filter(p => p.name !== name)
  saveState(state)
}
