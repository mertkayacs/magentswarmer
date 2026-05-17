// Per-session dead detection: polls tmux has-session, writes ended_at when the session dies.
// Spawner calls watchSession() immediately after a session is created.
// Watchers run for the lifetime of the reevesagents process.

import { execFileSync } from 'node:child_process'
import { read as readSession, updateSession, nowIso } from '../state/registry.js'

const watchers = new Map<string, ReturnType<typeof setInterval>>()

export function watchSession(sessionId: string, intervalMs = 3000): void {
  if (watchers.has(sessionId)) return

  const timer = setInterval(() => {
    let session
    try {
      session = readSession(sessionId)
    } catch {
      // Session removed from registry — stop watching
      clearInterval(timer)
      watchers.delete(sessionId)
      return
    }

    if (session.ended_at) {
      clearInterval(timer)
      watchers.delete(sessionId)
      return
    }

    try {
      execFileSync('tmux', ['has-session', '-t', session.tmux_session], { stdio: 'ignore' })
      // Still alive
    } catch {
      // tmux has-session exited non-zero — session is gone
      updateSession(sessionId, { ended_at: nowIso() })
      clearInterval(timer)
      watchers.delete(sessionId)
    }
  }, intervalMs)

  watchers.set(sessionId, timer)
}

export function stopWatcher(sessionId: string): void {
  const timer = watchers.get(sessionId)
  if (timer) {
    clearInterval(timer)
    watchers.delete(sessionId)
  }
}

export function stopAllWatchers(): void {
  for (const [id, timer] of watchers) {
    clearInterval(timer)
    watchers.delete(id)
  }
}

export function activeWatcherCount(): number {
  return watchers.size
}
