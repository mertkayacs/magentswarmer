// Spawn a new reevesagents session in a tmux window.
// Inputs: SpawnRequest with provider, auth, model, etc.
// Outputs: Session written to registry and returned.
// Invariant: every session has a unique id and corresponding tmux window.

import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { SpawnRequest, Session } from '../state/types.js'
import { buildEnv, buildCommand, detectAvailable } from './providers.js'
import { registryDir, newId, write as writeSession, nowIso, updateSession } from '../state/registry.js'
import { setLastSpawn, addRecentSession } from '../state/store.js'

export const TMUX_SESSION = 'reevesagents'

// How long to wait (ms) before sending the initial prompt to a fresh window.
// The provider CLI needs time to start up and render its initial UI.
// Override with REEVES_INITIAL_PROMPT_DELAY_MS env var on slow machines.
const INITIAL_PROMPT_DELAY_MS = parseInt(process.env.REEVES_INITIAL_PROMPT_DELAY_MS ?? '1500', 10)

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, "'\\''")}'`
}

function buildStartScript(
  builtEnv: Record<string, string>,
  baseEnv: Record<string, string>,
  cmd: string[]
): string {
  const lines: string[] = ['#!/usr/bin/env bash']
  for (const key of Object.keys(baseEnv)) {
    if (!(key in builtEnv)) {
      lines.push(`unset ${key}`)
    }
  }
  for (const [key, value] of Object.entries(builtEnv)) {
    if (baseEnv[key] !== value) {
      lines.push(`export ${key}=${shellQuote(value)}`)
    }
  }
  lines.push(`exec ${cmd.map(shellQuote).join(' ')}`)
  return lines.join('\n') + '\n'
}

function uniqueWindowName(base: string, tmuxSession: string): string {
  let existing: string[]
  try {
    const out = execFileSync(
      'tmux', ['list-windows', '-t', tmuxSession, '-F', '#{window_name}'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )
    existing = out.trim().split('\n').filter(Boolean)
  } catch {
    return base
  }
  const names = new Set(existing)
  if (!names.has(base)) return base
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    if (!names.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}

export function spawn(req: SpawnRequest): Session {
  const available = detectAvailable()
  if (!available[req.provider]) {
    throw new Error(`Provider '${req.provider}' not found on PATH`)
  }

  const sessionId = newId()
  const name = req.name || `${req.provider}-${sessionId}`
  const windowName = uniqueWindowName(name, TMUX_SESSION)

  const workdir = join(homedir(), '.reeves', 'spawns', name)
  mkdirSync(workdir, { recursive: true })

  const cfg = {
    provider: req.provider,
    auth: req.auth,
    base_url: req.base_url || null,
    model: req.model || null,
    key_ref: req.key_ref || null,
    permissions: req.permissions || 'skip' as const,
    effort: req.effort || null,
  }

  // Build env — pass parent ID only when set
  const env = buildEnv(cfg, process.env as Record<string, string>)
  env.REEVES_SESSION_ID = sessionId
  if (req.parent_id) env.REEVES_PARENT_ID = req.parent_id
  env.REEVES_REGISTRY = registryDir()

  const cmd = buildCommand(cfg)

  // Ensure tmux session exists
  try {
    execFileSync('tmux', ['has-session', '-t', TMUX_SESSION], { stdio: 'ignore' })
  } catch {
    execFileSync('tmux', ['new-session', '-d', '-s', TMUX_SESSION], { stdio: 'ignore' })
  }

  // Create new window — args array avoids all shell quoting issues
  execFileSync('tmux', ['new-window', '-d', '-t', TMUX_SESSION, '-n', windowName, '-c', workdir], {
    stdio: 'ignore',
  })

  // Write startup script with correct env and exec into provider CLI
  const scriptPath = join(workdir, '.start.sh')
  writeFileSync(scriptPath, buildStartScript(env, process.env as Record<string, string>, cmd), { mode: 0o755 })
  execFileSync('tmux', ['send-keys', '-t', `${TMUX_SESSION}:${windowName}`, `bash ${shellQuote(scriptPath)}`, 'Enter'], {
    stdio: 'ignore',
  })

  const target = `${TMUX_SESSION}:${windowName}`

  if (req.remote_control) {
    // Capture all pane output so the RC URL can be scraped once CC prints it.
    // pipe-pane must be set before CC starts printing.
    const logFile = `/tmp/reeves-${sessionId}.rc.log`
    try {
      execFileSync('tmux', ['pipe-pane', '-t', target, '-o', `cat >> ${logFile}`], { stdio: 'ignore' })
    } catch {
      // pipe-pane may fail on some systems
    }

    // Send /remote-control after CC has fully initialized (welcome screen visible).
    // INITIAL_PROMPT_DELAY_MS is too short — CC needs ~3-4s to render its UI.
    const rcDelay = Math.max(INITIAL_PROMPT_DELAY_MS, 1000) + 2500
    setTimeout(() => {
      try {
        execFileSync('tmux', ['send-keys', '-t', target, '/remote-control', 'Enter'], { stdio: 'ignore' })
      } catch { /* window may have closed */ }

      // Send task prompt after RC is established (if provided)
      if (req.start_prompt) {
        const prompt = req.start_prompt
        setTimeout(() => {
          try {
            execFileSync('tmux', ['load-buffer', '-'], { input: prompt, stdio: ['pipe', 'ignore', 'ignore'] })
            execFileSync('tmux', ['paste-buffer', '-t', target], { stdio: 'ignore' })
            execFileSync('tmux', ['send-keys', '-t', target, '', 'Enter'], { stdio: 'ignore' })
          } catch { /* window may have closed */ }
        }, 1500)
      }
    }, rcDelay)

    // Poll captured log for RC URL (2s interval, 25 attempts = ~50s window)
    let pollCount = 0
    const pollInterval = setInterval(() => {
      pollCount++
      if (pollCount > 25) { clearInterval(pollInterval); return }
      try {
        const logContent = readFileSync(logFile, 'utf-8')
        const match = logContent.match(/https:\/\/claude\.ai\/code\/session\/[A-Za-z0-9_-]+/)
        if (match) {
          updateSession(sessionId, { rc_url: match[0] })
          clearInterval(pollInterval)
        }
      } catch { /* log file may not exist yet */ }
    }, 2000)
  } else if (req.start_prompt) {
    // No remote control — send prompt after provider CLI has had time to start
    const prompt = req.start_prompt
    setTimeout(() => {
      try {
        execFileSync('tmux', ['load-buffer', '-'], { input: prompt, stdio: ['pipe', 'ignore', 'ignore'] })
        execFileSync('tmux', ['paste-buffer', '-t', target], { stdio: 'ignore' })
        execFileSync('tmux', ['send-keys', '-t', target, '', 'Enter'], { stdio: 'ignore' })
      } catch { /* window may have closed before the delay elapsed */ }
    }, INITIAL_PROMPT_DELAY_MS)
  }

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
    tmux_window: windowName,
    created_at: now,
    last_seen_at: now,
    working_dir: req.working_dir ?? process.cwd(),
    ended_at: null,
    rc_url: null,
  }

  writeSession(session)

  // Update app store so history and last-used form state are current
  setLastSpawn({
    provider: req.provider,
    auth: req.auth,
    model: req.model || null,
    permissions: cfg.permissions,
    effort: cfg.effort,
    tag: req.tag || null,
    name: req.name || null,
    prompt: req.start_prompt || '',
    working_dir: req.working_dir ?? process.cwd(),
  })
  addRecentSession(sessionId)

  return session
}
