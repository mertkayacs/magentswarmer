// Shared types across state, launcher, and UI layers.
// All JSON schemas are byte-compatible with v2 Python format.

export type Provider = 'cc' | 'codex' | 'gemini'
export type Auth = 'subscription' | 'api-key' | 'custom'
export type Permissions = 'skip' | 'ask'
export type Effort = 'low' | 'medium' | 'high'
export type ScreenName =
  | 'Welcome'
  | 'Home'
  | 'Spawn'
  | 'Orchestrate'
  | 'Sessions'
  | 'Top'
  | 'History'
  | 'Settings'
  | 'Doctor'
  | 'Help'
export type Panes = 1 | 2 | 3

// ~/.reeves/config.json (version 1)
export interface ProviderConfig {
  auth: Auth
  base_url: string | null
  key_env: string | null
  default_model: string | null
  default_permissions: Permissions
  default_effort: Effort | null
}

export interface Config {
  version: number
  providers: {
    cc: ProviderConfig
    codex: ProviderConfig
    gemini: ProviderConfig
  }
  ui: {
    last_used_tag: string | null
    last_used_goal: string | null
  }
  global: {
    tmux_session_name: string
    peek_interval_seconds: 3 | 5 | 10
  }
}

// ~/.reeves/state.json (version 1)
export interface SpawnFormState {
  provider: Provider
  auth: Auth
  model: string | null
  permissions: Permissions
  effort: Effort | null
  tag: string | null
  name: string | null
  prompt: string
  working_dir: string
}

export interface SharedFormState {
  provider: Provider
  auth: Auth
  model: string | null
  permissions: Permissions
  effort: Effort | null
}

export interface WorkerEntry {
  name: string
  prompt: string
}

export interface OrchestrateFormState {
  goal: string
  tag: string
  shared: SharedFormState
  workers: WorkerEntry[]
}

export interface Preset {
  name: string
  goal: string
  workers: WorkerEntry[]
  shared: SharedFormState
}

export interface AppState {
  version: number
  last_spawn: SpawnFormState
  last_orchestrate: OrchestrateFormState
  presets: Preset[]
  recent_sessions: string[]
  history: {
    spawned_total: number
    orchestrated_total: number
  }
}

// ~/.reeves/sessions/<id>.json
export interface Session {
  id: string
  name: string
  parent_id: string | null
  provider: Provider
  auth: Auth
  base_url: string | null
  model: string | null
  key_ref: string | null
  tag: string | null
  permissions: Permissions
  effort: Effort | null
  start_prompt: string | null
  goal: string | null
  tmux_session: string
  tmux_window: string
  created_at: string
  last_seen_at: string
  working_dir: string | null
  ended_at: string | null
  rc_url: string | null
}

// Spawn request to launcher
export interface SpawnRequest {
  provider: Provider
  auth: Auth
  base_url?: string | null
  model?: string | null
  key_ref?: string | null
  parent_id?: string | null
  name?: string | null
  permissions?: Permissions
  effort?: Effort | null
  tag?: string | null
  start_prompt?: string | null
  goal?: string | null
  working_dir?: string
  remote_control?: boolean
}

// Internal config passed to command/env builder
export interface SpawnConfig {
  provider: Provider
  auth: Auth
  base_url?: string | null
  model?: string | null
  key_ref?: string | null
  permissions: Permissions
  effort?: Effort | null
}

// Doctor check result
export interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

// Router context shape
export interface RouterContextValue {
  screen: ScreenName
  push: (_screen: ScreenName) => void
  pop: () => void
  replace: (_screen: ScreenName) => void
}
