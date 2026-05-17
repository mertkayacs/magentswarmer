// Core type definitions. Session schema is the source of truth for registry and MCP surface.

export type Provider = 'cc' | 'codex' | 'gemini' | 'hermes'

export type Permissions = 'skip' | 'ask'

export type TaskStatus = 'queued' | 'working' | 'done' | 'failed' | 'blocked'

export type AuthMode = 'default' | 'api-key'

export type Effort = 'default' | 'low' | 'medium' | 'high' | 'xhigh' | 'max'

// Computed from last_seen + ended_at — never stored in registry.
export type SessionStatus = 'idle' | 'working' | 'ended'

export type Panes = 1 | 2 | 3

export type ScreenName =
  | 'Welcome'
  | 'TreeNavigator'
  | 'Spawn'
  | 'Orchestrate'
  | 'Settings'
  | 'Doctor'
  | 'Help'

export interface Message {
  id: string
  from_id: string       // sender's session id
  text: string
  sent_at: string       // ISO 8601
  read: boolean
}

// ~/.reeves/sessions/<id>.json
export interface Session {
  id: string            // crypto.randomUUID()
  nickname: string      // user label, part of tmux session name
  provider: Provider
  model: string
  working_dir: string   // absolute path
  task: string          // initial prompt injected at spawn
  task_status: TaskStatus
  task_note: string     // free-text from orchestrating CLI via update_task
  parent_id: string | null
  root_id: string       // own id for root; ancestor's root_id for children
  depth_level: number   // 0 = root, increments per generation
  last_seen: number     // ms epoch, updated on every check_messages() MCP call
  started_at: string    // ISO 8601
  ended_at: string | null
  tmux_session: string  // "reeves_<nickname>_<id[:8]>"
  rc_enabled: boolean
  inbox: Message[]
}

// Drives Session creation — not persisted.
export interface SpawnRequest {
  provider: Provider
  model: string
  auth_mode?: AuthMode
  effort?: Effort
  task: string
  working_dir: string
  nickname?: string
  permissions?: Permissions
  rc_enabled?: boolean
  parent_id?: string
  ready_delay_ms?: number
}

// Per-slot config inside a saved orchestration tree.
export interface SavedTreeSlot {
  nickname_template: string  // e.g. "researcher-1"
  provider: Provider
  model: string
  auth_mode: AuthMode
  effort: Effort
  task_template: string      // may include {{root_task}} placeholder
  working_dir: string
  permissions: Permissions
  rc_enabled: boolean
}

// ~/.reeves/saved-trees/<name>.json
export interface SavedTree {
  name: string
  description: string
  root: SavedTreeSlot
  workers: SavedTreeSlot[]
  working_dir_pattern?: string
  created_at: string
  updated_at: string
}

// Return shape for tree() MCP tool.
export interface TreeNode {
  session: Session
  status: SessionStatus
  children: TreeNode[]
}

// UX-convenience form state — persisted so the form remembers last values.
export interface SpawnFormState {
  provider: Provider
  model: string
  auth_mode: AuthMode
  effort: Effort
  task: string
  working_dir: string
  nickname: string
  permissions: Permissions
  rc_enabled: boolean
}

export interface OrchestrateFormState {
  root: SavedTreeSlot
  workers: SavedTreeSlot[]
  working_dir: string
}

// Doctor check result.
export interface CheckResult {
  name: string
  status: 'ok' | 'warn' | 'fail'
  detail: string
}

// Router context — stack navigation via push/pop/replace.
export interface RouterContextValue {
  screen: ScreenName
  push: (_screen: ScreenName) => void
  pop: () => void
  replace: (_screen: ScreenName) => void
}

// Global preferences; no auth, no keys.
export interface GlobalConfig {
  peek_interval_ms: number          // ms between peek polls; default 3000
  peek_lines: number                // capture-pane lines shown; default 10
  max_depth: number                 // spawn recursion cap; default 5
  max_agents: number                // tree size cap; default 10
  ready_delay_ms: number            // ms to wait after session start before task injection; default 2000
  default_permissions: Permissions  // default 'ask'
}

export interface Config {
  version: number
  global: GlobalConfig
}
