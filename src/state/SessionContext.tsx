// Reactive app-state context. Single 5s poll loop shared across all screens.
// Holds live sessions, ended sessions, presets, recent sessions.
// Screens subscribe via useSessionState(); mutations call refresh() for immediate sync.
// Invariant: dead session detection runs on every refresh cycle before state is set.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { execFileSync } from 'node:child_process'
import { listAll, updateSession, read } from './registry.js'
import { loadState } from './store.js'
import type { Session, Preset } from './types.js'

export interface SessionContextValue {
  sessions: Session[]
  allSessions: Session[]
  presets: Preset[]
  recentSessions: Session[]
  refresh: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function useSessionState(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSessionState must be used within SessionProvider')
  return ctx
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [allSessions, setAllSessions] = useState<Session[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [recentSessions, setRecentSessions] = useState<Session[]>([])

  const refresh = useCallback(() => {
    const all = listAll()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', `${s.tmux_session}:${s.tmux_window}`], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const fresh = listAll()
    setSessions(fresh.filter(s => s.ended_at === null))
    setAllSessions(fresh)

    const appState = loadState()
    setPresets(appState.presets)
    const recent = appState.recent_sessions
      .slice(0, 5)
      .map(id => { try { return read(id) } catch { return null } })
      .filter((s): s is Session => s !== null)
    setRecentSessions(recent)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <SessionContext.Provider value={{ sessions, allSessions, presets, recentSessions, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}
