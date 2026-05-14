// Pure helpers for reading and writing individual config fields by dot-key.
// Inputs: dot-key string (e.g. "cc.auth", "global.tmux"), current Config.
// Outputs: typed value on get, error string or null on set.
// Invariant: loadConfig/saveConfig are called by callers; these are stateless helpers.

import { loadConfig, saveConfig } from './config.js'
import type { Auth, Effort, Permissions, Provider } from './types.js'

export const CONFIG_PROVIDERS: readonly Provider[] = ['cc', 'codex', 'gemini', 'opencode', 'aider', 'hermes']

export type ConfigVal = string | number | null

export function resolveConfigKey(key: string): { section: string; field: string } | null {
  const dot = key.indexOf('.')
  if (dot === -1) return null
  return { section: key.slice(0, dot), field: key.slice(dot + 1) }
}

export function getConfigValue(key: string): { value: ConfigVal; error: string | null } {
  const parsed = resolveConfigKey(key)
  if (!parsed) return { value: null, error: 'key must be <section>.<field> (e.g. cc.auth, global.tmux)' }
  const { section, field } = parsed
  const cfg = loadConfig()

  if (section === 'global') {
    if (field === 'tmux' || field === 'tmux_session_name') return { value: cfg.global.tmux_session_name, error: null }
    if (field === 'peek' || field === 'peek_interval_seconds') return { value: cfg.global.peek_interval_seconds, error: null }
    return { value: null, error: `unknown global field: ${field}` }
  }

  if (CONFIG_PROVIDERS.includes(section as Provider)) {
    const p = cfg.providers[section as Provider]
    if (field === 'auth') return { value: p.auth, error: null }
    if (field === 'model') return { value: p.default_model ?? null, error: null }
    if (field === 'effort') return { value: p.default_effort ?? null, error: null }
    if (field === 'permissions') return { value: p.default_permissions, error: null }
    if (field === 'key' || field === 'key_env') return { value: p.key_env ?? null, error: null }
    if (field === 'base_url') return { value: p.base_url ?? null, error: null }
    return { value: null, error: `unknown provider field: ${field}  (valid: auth model effort permissions key base_url)` }
  }

  return { value: null, error: `unknown section: ${section}  (valid: ${CONFIG_PROVIDERS.join(' ')} global)` }
}

export function setConfigValue(key: string, value: string): string | null {
  const parsed = resolveConfigKey(key)
  if (!parsed) return 'key must be <section>.<field> (e.g. cc.auth subscription)'
  const { section, field } = parsed
  const cfg = loadConfig()
  const clear = value === '' || value === 'null'

  if (section === 'global') {
    if (field === 'tmux' || field === 'tmux_session_name') {
      cfg.global.tmux_session_name = value
    } else if (field === 'peek' || field === 'peek_interval_seconds') {
      const n = parseInt(value, 10)
      if (isNaN(n) || n < 1) return 'peek interval must be a positive integer'
      cfg.global.peek_interval_seconds = n as 3 | 5 | 10
    } else {
      return `unknown global field: ${field}`
    }
  } else if (CONFIG_PROVIDERS.includes(section as Provider)) {
    const p = cfg.providers[section as Provider]
    if (field === 'auth') {
      if (!(['subscription', 'api-key', 'custom'] as string[]).includes(value)) return 'auth must be: subscription, api-key, custom'
      p.auth = value as Auth
    } else if (field === 'model') {
      p.default_model = clear ? null : value
    } else if (field === 'effort') {
      if (!clear && !(['low', 'medium', 'high'] as string[]).includes(value)) return 'effort must be: low, medium, high (or empty to clear)'
      p.default_effort = clear ? null : value as Effort
    } else if (field === 'permissions') {
      if (!(['ask', 'skip'] as string[]).includes(value)) return 'permissions must be: ask, skip'
      p.default_permissions = value as Permissions
    } else if (field === 'key' || field === 'key_env') {
      p.key_env = clear ? null : value
    } else if (field === 'base_url') {
      p.base_url = clear ? null : value
    } else {
      return `unknown provider field: ${field}  (valid: auth model effort permissions key base_url)`
    }
  } else {
    return `unknown section: ${section}  (valid: ${CONFIG_PROVIDERS.join(' ')} global)`
  }

  saveConfig(cfg)
  return null
}
