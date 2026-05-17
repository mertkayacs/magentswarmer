// Session context: polls registry every 5s, auto-ends orphaned tmux sessions.
// Orphan: active session whose tmux session no longer exists.
// Invariant: never throws; empty arrays on any error.

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { execFileSync } from 'node:child_process'
import { listAll, updateSession } from './registry.js'
import type { Session } from './types.js'

export interface SessionContextValue {
  sessions: Session[]      // active only (ended_at === null)
  allSessions: Session[]   // all including ended
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

  const refresh = useCallback(() => {
    const all = listAll()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', s.tmux_session], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const fresh = listAll()
    setSessions(fresh.filter(s => s.ended_at === null))
    setAllSessions(fresh)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  return (
    <SessionContext.Provider value={{ sessions, allSessions, refresh }}>
      {children}
    </SessionContext.Provider>
  )
}
