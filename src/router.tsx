// Screen stack router. Holds navigation state, provides context to all screens.
// Push adds a screen, pop returns to previous, replace swaps top of stack.
// Invariant: stack always has at least one screen; Welcome shown on first run.

import React, { createContext, useContext, useState, useCallback } from 'react'
import { useApp } from 'ink'
import type { ScreenName, RouterContextValue } from './state/types.js'

import { Welcome } from './screens/Welcome.js'
import { Home } from './screens/Home.js'
import { Spawn } from './screens/Spawn.js'
import { Orchestrate } from './screens/Orchestrate.js'
import { Sessions } from './screens/Sessions.js'
import { Top } from './screens/Top.js'
import { History } from './screens/History.js'
import { Settings } from './screens/Settings.js'
import { Doctor } from './screens/Doctor.js'
import { Help } from './screens/Help.js'

const RouterContext = createContext<RouterContextValue | null>(null)

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext)
  if (!ctx) throw new Error('useRouter must be used within Router')
  return ctx
}

function initialStack(): ScreenName[] {
  return ['Welcome']
}

function renderScreen(screen: ScreenName) {
  switch (screen) {
    case 'Welcome': return <Welcome />
    case 'Home': return <Home />
    case 'Spawn': return <Spawn />
    case 'Orchestrate': return <Orchestrate />
    case 'Sessions': return <Sessions />
    case 'Top': return <Top />
    case 'History': return <History />
    case 'Settings': return <Settings />
    case 'Doctor': return <Doctor />
    case 'Help': return <Help />
  }
}

export function Router() {
  const { exit } = useApp()
  const [stack, setStack] = useState<ScreenName[]>(initialStack)

  const push = useCallback((screen: ScreenName) => {
    setStack(prev => [...prev, screen])
  }, [])

  const pop = useCallback(() => {
    setStack(prev => (prev.length > 1 ? prev.slice(0, -1) : prev))
  }, [])

  const replace = useCallback((screen: ScreenName) => {
    setStack(prev => [...prev.slice(0, -1), screen])
  }, [])

  const onQuit = useCallback(() => {
    exit()
  }, [exit])

  const current = stack[stack.length - 1] ?? 'Home'

  return (
    <RouterContext.Provider value={{ screen: current, push, pop, replace }}>
      {renderScreen(current)}
    </RouterContext.Provider>
  )
}

// Exposed for screens that need quit without full router context
export { RouterContext }
export type { ScreenName }
