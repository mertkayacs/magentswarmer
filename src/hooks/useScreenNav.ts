// Shared command-bar navigation hook. Handles '/' command mode, esc, ? shortcut.
// Inputs: push/pop from router, useApp exit. Outputs: cmdMode state for screens.
// Invariant: screen shortcuts should check cmdMode and skip when true.

import { useState } from 'react'
import { useInput, useApp } from 'ink'
import type { ScreenName } from '../state/types.js'

const SLASH_ROUTES: Partial<Record<string, ScreenName>> = {
  '/home': 'Home',
  '/h': 'Home',
  '/welcome': 'Welcome',
  '/spawn': 'Spawn',
  '/s': 'Spawn',
  '/orchestrate': 'Orchestrate',
  '/o': 'Orchestrate',
  '/sessions': 'Sessions',
  '/l': 'Sessions',
  '/settings': 'Settings',
  '/cfg': 'Settings',
  '/doctor': 'Doctor',
  '/d': 'Doctor',
  '/help': 'Help',
}

interface ScreenNavState {
  cmdMode: boolean
  cmdValue: string
  cmdError: string
}

export function useScreenNav(
  push: (screen: ScreenName) => void,
  pop: () => void,
  disabled = false,
): ScreenNavState {
  const { exit } = useApp()
  const [cmdMode, setCmdMode] = useState(false)
  const [cmdValue, setCmdValue] = useState('')
  const [cmdError, setCmdError] = useState('')

  useInput((input, key) => {
    if (cmdMode) {
      if (key.escape) {
        setCmdMode(false)
        setCmdValue('')
        setCmdError('')
        return
      }
      if (key.backspace || key.delete) {
        const next = cmdValue.slice(0, -1)
        setCmdValue(next)
        if (!next) {
          setCmdMode(false)
          setCmdError('')
        }
        return
      }
      if (key.return) {
        const cmd = '/' + cmdValue.trim()
        if (cmd === '/quit' || cmd === '/q') {
          exit()
          return
        }
        const target = SLASH_ROUTES[cmd]
        if (target) {
          push(target)
        } else {
          setCmdError(`unknown: ${cmd}`)
        }
        setCmdMode(false)
        setCmdValue('')
        return
      }
      if (!key.ctrl && !key.meta) {
        setCmdValue(prev => prev + input)
      }
      return
    }

    // Normal mode
    if (input === '/') {
      setCmdMode(true)
      setCmdValue('')
      setCmdError('')
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
  }, { isActive: !disabled })

  return { cmdMode, cmdValue, cmdError }
}

export { SLASH_ROUTES }
