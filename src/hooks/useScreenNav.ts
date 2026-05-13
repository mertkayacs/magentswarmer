// Shared command-bar navigation hook. Handles '/' command mode, esc, ? shortcut.
// Inputs: push/pop from router, optional disabled flag. Outputs: cmdMode, cmdValue,
// cmdError, completions (filtered routes), selectedIdx (Tab/↑↓ to cycle).
// Invariant: screen shortcuts check cmdMode and skip when true.

import { useState, useMemo } from 'react'
import { useInput, useApp } from 'ink'
import type { ScreenName } from '../state/types.js'

export interface DeduplicatedRoute {
  primary: string
  alias: string
  screen: ScreenName | '__quit__'
  description: string
}

// Ordered route table: one entry per destination, longer form as primary.
export const DEDUPED_ROUTES: DeduplicatedRoute[] = [
  { primary: '/home',        alias: '/h',   screen: 'Home',        description: 'go to home screen' },
  { primary: '/spawn',       alias: '/s',   screen: 'Spawn',       description: 'spawn a single agent' },
  { primary: '/orchestrate', alias: '/o',   screen: 'Orchestrate', description: 'fan out multiple agents' },
  { primary: '/sessions',    alias: '/l',   screen: 'Sessions',    description: 'view all running sessions' },
  { primary: '/top',         alias: '/t',   screen: 'Top',         description: 'live session monitor' },
  { primary: '/history',     alias: '/hi',  screen: 'History',     description: 'view session history' },
  { primary: '/settings',    alias: '/cfg', screen: 'Settings',    description: 'configure providers' },
  { primary: '/doctor',      alias: '/d',   screen: 'Doctor',      description: 'run health checks' },
  { primary: '/help',        alias: '',     screen: 'Help',        description: 'keyboard reference' },
  { primary: '/quit',        alias: '/q',   screen: '__quit__',    description: 'exit' },
]

// Flat lookup map for direct Enter without picker selection
const SLASH_ROUTES: Partial<Record<string, ScreenName | '__quit__'>> = {}
for (const r of DEDUPED_ROUTES) {
  SLASH_ROUTES[r.primary] = r.screen
  if (r.alias) SLASH_ROUTES[r.alias] = r.screen
}
// Legacy aliases kept for backward compat
SLASH_ROUTES['/welcome'] = 'Welcome'

export interface ScreenNavState {
  cmdMode: boolean
  cmdValue: string
  cmdError: string
  completions: DeduplicatedRoute[]
  selectedIdx: number
}

export function useScreenNav(
  push: (_screen: ScreenName) => void,
  pop: () => void,
  disabled = false,
): ScreenNavState {
  const { exit } = useApp()
  const [cmdMode, setCmdMode] = useState(false)
  const [cmdValue, setCmdValue] = useState('')
  const [cmdError, setCmdError] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const completions = useMemo(
    () =>
      cmdValue.length > 0
        ? DEDUPED_ROUTES.filter(r => r.primary.startsWith('/' + cmdValue))
        : [],
    [cmdValue],
  )

  useInput(
    (input, key) => {
      if (cmdMode) {
        if (key.escape) {
          setCmdMode(false)
          setCmdValue('')
          setCmdError('')
          setSelectedIdx(0)
          return
        }
        if (key.tab || key.downArrow) {
          if (completions.length > 0) {
            setSelectedIdx(i => (i + 1) % completions.length)
          }
          return
        }
        if (key.upArrow) {
          if (completions.length > 0) {
            setSelectedIdx(i => (i - 1 + completions.length) % completions.length)
          }
          return
        }
        if (key.backspace || key.delete) {
          const next = cmdValue.slice(0, -1)
          setCmdValue(next)
          setSelectedIdx(0)
          if (!next) {
            setCmdMode(false)
            setCmdError('')
          }
          return
        }
        if (key.return) {
          const chosen = completions[selectedIdx]
          const dest = chosen ? chosen.screen : SLASH_ROUTES['/' + cmdValue.trim()]
          if (dest === '__quit__') {
            exit()
          } else if (dest) {
            push(dest as ScreenName)
          } else {
            setCmdError(`unknown: /${cmdValue.trim()}`)
          }
          setCmdMode(false)
          setCmdValue('')
          setSelectedIdx(0)
          return
        }
        if (!key.ctrl && !key.meta) {
          setCmdValue(prev => prev + input)
          setSelectedIdx(0)
        }
        return
      }

      // Normal mode
      if (input === '/') {
        setCmdMode(true)
        setCmdValue('')
        setCmdError('')
        setSelectedIdx(0)
        return
      }
      if (input === '?') {
        push('Help')
        return
      }
      if (key.escape) {
        pop()
        return
      }
    },
    { isActive: !disabled },
  )

  return { cmdMode, cmdValue, cmdError, completions, selectedIdx }
}

export { SLASH_ROUTES }
