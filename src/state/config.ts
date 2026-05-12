// Load, save, merge configuration (providers, UI state).
// Reads from REEVES_CONFIG env or ~/.reeves/config.json.
// Atomic write, fallback to defaults, per-provider field merge.

import { readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import type { Config, ProviderConfig, Auth, Permissions, Effort } from './types.js'

const SCHEMA_VERSION = 1

const DEFAULT_PROVIDERS: Record<string, ProviderConfig> = {
  cc: {
    auth: 'subscription',
    base_url: null,
    key_env: null,
    default_model: 'opus',
    default_permissions: 'skip',
    default_effort: 'high'
  },
  codex: {
    auth: 'subscription',
    base_url: null,
    key_env: null,
    default_model: null,
    default_permissions: 'skip',
    default_effort: 'high'
  },
  gemini: {
    auth: 'subscription',
    base_url: null,
    key_env: null,
    default_model: null,
    default_permissions: 'skip',
    default_effort: null
  }
}

export function configPath(): string {
  const base = process.env.REEVES_CONFIG
  if (base) return base
  return join(homedir(), '.reeves', 'config.json')
}

export function configExists(): boolean {
  try {
    readFileSync(configPath(), 'utf-8')
    return true
  } catch {
    return false
  }
}

export function defaultConfig(): Config {
  return {
    version: SCHEMA_VERSION,
    providers: {
      cc: { ...DEFAULT_PROVIDERS.cc },
      codex: { ...DEFAULT_PROVIDERS.codex },
      gemini: { ...DEFAULT_PROVIDERS.gemini }
    },
    ui: {
      last_used_tag: null,
      last_used_goal: null
    }
  }
}

function mergeDefaults(raw: unknown): Config {
  const defaults = defaultConfig()

  if (typeof raw !== 'object' || raw === null) return defaults

  const obj = raw as Record<string, unknown>
  const merged: Config = {
    version: typeof obj.version === 'number' ? obj.version : defaults.version,
    providers: {
      cc: { ...DEFAULT_PROVIDERS.cc },
      codex: { ...DEFAULT_PROVIDERS.codex },
      gemini: { ...DEFAULT_PROVIDERS.gemini }
    },
    ui: {
      last_used_tag: null,
      last_used_goal: null
    }
  }

  if (typeof obj.providers === 'object' && obj.providers !== null) {
    const provs = obj.providers as Record<string, unknown>
    for (const key of ['cc', 'codex', 'gemini'] as const) {
      if (typeof provs[key] === 'object' && provs[key] !== null) {
        const p = provs[key] as Record<string, unknown>
        merged.providers[key] = {
          auth: (p.auth as Auth) || merged.providers[key].auth,
          base_url: (p.base_url as string | null) ?? merged.providers[key].base_url,
          key_env: (p.key_env as string | null) ?? merged.providers[key].key_env,
          default_model: (p.default_model as string | null) ?? merged.providers[key].default_model,
          default_permissions: (p.default_permissions as Permissions) || merged.providers[key].default_permissions,
          default_effort: (p.default_effort as Effort | null) ?? merged.providers[key].default_effort
        }
      }
    }
  }

  if (typeof obj.ui === 'object' && obj.ui !== null) {
    const ui = obj.ui as Record<string, unknown>
    merged.ui.last_used_tag = (ui.last_used_tag as string | null) ?? null
    merged.ui.last_used_goal = (ui.last_used_goal as string | null) ?? null
  }

  return merged
}

export function loadConfig(): Config {
  const path = configPath()
  try {
    const content = readFileSync(path, 'utf-8')
    const parsed = JSON.parse(content)
    return mergeDefaults(parsed)
  } catch {
    return defaultConfig()
  }
}

export function saveConfig(cfg: Config): string {
  const path = configPath()
  const dir = dirname(path)

  mkdirSync(dir, { recursive: true })

  const tmpPath = `${path}.tmp`
  writeFileSync(tmpPath, JSON.stringify(cfg, null, 2), 'utf-8')

  try {
    renameSync(tmpPath, path)
  } catch {
    writeFileSync(path, JSON.stringify(cfg, null, 2), 'utf-8')
  }

  return path
}

export function getProvider(name: string, cfg?: Config): ProviderConfig {
  const config = cfg || loadConfig()
  if (name === 'cc' || name === 'codex' || name === 'gemini') {
    return config.providers[name]
  }
  throw new Error(`Unknown provider: ${name}`)
}

export function updateUi(key: string, value: unknown): void {
  const cfg = loadConfig()
  if (key === 'last_used_tag') {
    cfg.ui.last_used_tag = value as string | null
  } else if (key === 'last_used_goal') {
    cfg.ui.last_used_goal = value as string | null
  }
  saveConfig(cfg)
}
