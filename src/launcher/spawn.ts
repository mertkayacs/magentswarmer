// Spawn a new agent in its own tmux session.
// Inputs: SpawnRequest. Outputs: Session written to registry and returned.
// Invariant: each session has a unique id and its own tmux session "reeves_<nickname>_<id[:8]>".
// The tmux session inherits the user's env (API keys etc.); REEVES_ vars are injected via send-keys.

import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SpawnRequest, Session } from '../state/types.js'
import { buildCommand, detectAvailable, isProvider } from './providers.js'
import { registryDir, write as writeSession, read as readSession, listAll, nowIso, nowMs } from '../state/registry.js'
import { loadConfig } from '../state/config.js'
import { watchSession } from './watcher.js'

export function expandHome(p: string): string {
  if (p === '~') return homedir()
  if (p.startsWith('~/')) return join(homedir(), p.slice(2))
  return p
}

export function resolveWorkingDir(requested: string | undefined, fallback: string): string {
  if (!requested) return fallback
  const expanded = expandHome(requested.trim())
  if (!expanded) return fallback
  if (existsSync(expanded) && statSync(expanded).isDirectory()) return expanded
  throw new Error(`Working directory does not exist: ${expanded}`)
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function sanitizeNickname(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 32)
}

function tmuxSessionName(nickname: string, id: string): string {
  return `reeves_${nickname}_${id.slice(0, 8)}`
}

function childProcessOutput(err: unknown): string {
  if (typeof err !== 'object' || err === null) return ''
  const maybe = err as { stderr?: unknown; stdout?: unknown }
  const stderr = Buffer.isBuffer(maybe.stderr) ? maybe.stderr.toString('utf8').trim() : ''
  if (stderr) return stderr
  const stdout = Buffer.isBuffer(maybe.stdout) ? maybe.stdout.toString('utf8').trim() : ''
  return stdout
}

export function spawn(req: SpawnRequest): Session {
  const cfg = loadConfig()
  const available = detectAvailable()

  if (!isProvider(req.provider)) {
    throw new Error(`Unsupported provider: ${String(req.provider)}`)
  }

  if (!available[req.provider]) {
    throw new Error(`Provider '${req.provider}' not found on PATH`)
  }

  const id = randomUUID()
  const nickname = sanitizeNickname(req.nickname ?? `${req.provider}-${id.slice(0, 6)}`)
  const sessionName = tmuxSessionName(nickname, id)
  const workingDir = resolveWorkingDir(req.working_dir, process.cwd())
  const permissions = req.permissions ?? cfg.global.default_permissions
  const readyDelay = req.ready_delay_ms ?? cfg.global.ready_delay_ms
  const rcEnabled = req.rc_enabled ?? false

  // Resolve tree position from parent
  let root_id: string
  let depth_level: number
  const parent_id: string | null = req.parent_id ?? null

  if (req.parent_id) {
    const parent = readSession(req.parent_id)
    depth_level = parent.depth_level + 1
    root_id = parent.root_id

    if (depth_level >= cfg.global.max_depth) {
      throw new Error(`Depth cap exceeded (max: ${cfg.global.max_depth}, at depth: ${depth_level})`)
    }

    const treeActive = listAll().filter(s => s.root_id === root_id && !s.ended_at).length
    if (treeActive >= cfg.global.max_agents) {
      throw new Error(`Tree size cap exceeded (max: ${cfg.global.max_agents}, active: ${treeActive})`)
    }
  } else {
    root_id = id
    depth_level = 0
  }

  const cmd = buildCommand({
    provider: req.provider,
    permissions,
    model: req.model,
    auth_mode: req.auth_mode,
    effort: req.effort,
    rc_enabled: rcEnabled,
  })

  // Inject REEVES_ vars via shell exports before exec — API keys come from inherited tmux env
  const reevesVars: Record<string, string> = {
    REEVES_SESSION_ID: id,
    REEVES_REGISTRY: registryDir(),
  }
  if (req.parent_id) reevesVars.REEVES_PARENT_ID = req.parent_id

  const envPrefix = Object.entries(reevesVars)
    .map(([k, v]) => `export ${k}=${shellQuote(v)}`)
    .join(' && ')

  const launchCmd = req.provider === 'codex' && req.task.trim() ? [...cmd, req.task] : cmd
  const fullCmd = `${envPrefix} && exec ${launchCmd.map(shellQuote).join(' ')}`

  // Run the provider as the tmux session command. Typing into a newly-created shell races shell startup.
  try {
    execFileSync('tmux', ['new-session', '-d', '-s', sessionName, '-c', workingDir, fullCmd], { stdio: ['ignore', 'pipe', 'pipe'] })
  } catch (err) {
    const detail = childProcessOutput(err) || 'tmux returned a non-zero exit code'
    throw new Error(`Failed to create tmux session ${sessionName}: ${detail}`, { cause: err })
  }

  // CC remote control: inject /remote-control command after CLI is at its idle prompt
  // Codex RC is handled by --enable remote_control flag passed at launch (see providers.ts)
  if (rcEnabled && req.provider === 'cc') {
    setTimeout(() => {
      try {
        execFileSync('tmux', ['send-keys', '-t', sessionName, '/remote-control', 'Enter'], { stdio: 'ignore' })
      } catch { /* session may have ended */ }
    }, readyDelay)
  }

  // Task injection via paste-buffer: handles multi-line prompts and special characters cleanly
  // When CC+RC is active, add extra delay so the RC handshake completes before the task lands
  const shouldPasteTask = !(req.provider === 'codex' && req.task.trim())
  const taskDelay = readyDelay + (rcEnabled && req.provider === 'cc' ? 1500 : 0)
  const task = req.task

  if (shouldPasteTask) {
    setTimeout(() => {
      try {
        execFileSync('tmux', ['load-buffer', '-'], { input: task, stdio: ['pipe', 'ignore', 'ignore'] })
        execFileSync('tmux', ['paste-buffer', '-t', sessionName], { stdio: 'ignore' })
        execFileSync('tmux', ['send-keys', '-t', sessionName, '', 'Enter'], { stdio: 'ignore' })
      } catch { /* session may have ended before delay elapsed */ }
    }, taskDelay)
  }

  const session: Session = {
    id,
    nickname,
    provider: req.provider,
    model: req.model,
    working_dir: workingDir,
    task: req.task,
    task_status: 'queued',
    task_note: '',
    parent_id,
    root_id,
    depth_level,
    last_seen: nowMs(),
    started_at: nowIso(),
    ended_at: null,
    tmux_session: sessionName,
    rc_enabled: rcEnabled,
    inbox: [],
  }

  writeSession(session)
  watchSession(session.id, cfg.global.peek_interval_ms)
  return session
}
