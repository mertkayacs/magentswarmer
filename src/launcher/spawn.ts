// Spawn a new reevesagents session in a tmux window.
// Inputs: SpawnRequest with provider, auth, model, etc.
// Outputs: Session written to registry and returned.
// Invariant: every session has a unique id and corresponding tmux window.

import { execSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SpawnRequest, Session } from '../state/types.js'
import { buildEnv, buildCommand, detectAvailable } from './providers.js'
import {
  registryDir, newId, write as writeSession, nowIso
} from '../state/registry.js'

export const TMUX_SESSION = 'reevesagents'

export function spawn(req: SpawnRequest): Session {
  // Check provider is available
  const available = detectAvailable()
  if (!available[req.provider]) {
    throw new Error(`Provider '${req.provider}' not found on PATH`)
  }

  // Generate session id and derive name
  const sessionId = newId()
  const name = req.name || `${req.provider}-${sessionId}`

  // Create working directory
  const workdir = join(homedir(), '.reeves', 'spawns', name)
  mkdirSync(workdir, { recursive: true })

  // Build spawn config from request
  const cfg = {
    provider: req.provider,
    auth: req.auth,
    base_url: req.base_url || null,
    model: req.model || null,
    key_ref: req.key_ref || null,
    permissions: req.permissions || 'skip' as const,
    effort: req.effort || null
  }

  // Build environment variables
  const env = buildEnv(cfg, process.env as Record<string, string>)
  env.REEVES_SESSION_ID = sessionId
  env.REEVES_PARENT_ID = req.parent_id || ''
  env.REEVES_REGISTRY = registryDir()

  // Build command
  const cmd = buildCommand(cfg)

  // Ensure tmux session exists
  try {
    execSync(`tmux has-session -t ${TMUX_SESSION}`, { stdio: 'ignore' })
  } catch {
    execSync(`tmux new-session -d -s ${TMUX_SESSION}`, { stdio: 'ignore' })
  }

  // Create window in session
  execSync(
    `tmux new-window -d -t ${TMUX_SESSION} -n ${name} -c ${workdir}`,
    { stdio: 'ignore' }
  )

  // Send command to window
  const cmdStr = cmd.join(' ')
  execSync(
    `tmux send-keys -t ${TMUX_SESSION}:${name} '${cmdStr}' Enter`,
    { stdio: 'ignore' }
  )

  // If start_prompt provided, send it after a brief moment
  if (req.start_prompt) {
    setTimeout(() => {
      try {
        execSync(
          `tmux send-keys -t ${TMUX_SESSION}:${name} '${req.start_prompt}' Enter`,
          { stdio: 'ignore' }
        )
      } catch {
        // silently ignore if tmux fails (window may have closed)
      }
    }, 1000)
  }

  // Write session to registry
  const now = nowIso()
  const session: Session = {
    id: sessionId,
    name,
    parent_id: req.parent_id || null,
    provider: req.provider,
    auth: req.auth,
    base_url: cfg.base_url,
    model: cfg.model,
    key_ref: cfg.key_ref,
    tag: req.tag || null,
    permissions: cfg.permissions,
    effort: cfg.effort,
    start_prompt: req.start_prompt || null,
    goal: req.goal || null,
    tmux_session: TMUX_SESSION,
    tmux_window: name,
    created_at: now,
    last_seen_at: now
  }

  writeSession(session)
  return session
}
