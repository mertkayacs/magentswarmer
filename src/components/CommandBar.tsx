// Bottom command bar: bordered input accepting slash commands and text.
// Inputs: value, onChange, onSubmit, placeholder. Outputs: styled Box with input state.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
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
  '/?': 'Help',
}

interface CommandBarProps {
  onNavigate: (screen: ScreenName) => void
  onQuit: () => void
  hint?: string
}

export function CommandBar({ onNavigate, onQuit, hint }: CommandBarProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState('')

  useInput((input, key) => {
    if (key.escape) {
      setValue('')
      setError('')
      return
    }
    if (key.backspace || key.delete) {
      setValue(prev => prev.slice(0, -1))
      setError('')
      return
    }
    if (key.return) {
      const trimmed = value.trim()
      if (!trimmed) return
      if (trimmed === '/quit' || trimmed === '/q') {
        onQuit()
        return
      }
      const target = SLASH_ROUTES[trimmed.toLowerCase()]
      if (target) {
        setValue('')
        setError('')
        onNavigate(target)
      } else {
        setError(`unknown: ${trimmed}`)
        setValue('')
      }
      return
    }
    if (!key.ctrl && !key.meta) {
      setValue(prev => prev + input)
      setError('')
    }
  })

  return (
    <Box flexDirection="column" marginTop={1}>
      {error && (
        <Box paddingLeft={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box borderStyle="round" borderColor="gray" paddingLeft={1} paddingRight={1}>
        <Text color="gray">{'/ '}</Text>
        <Text>{value}</Text>
        <Text color="gray" dimColor>
          {!value && (hint ?? 'type a command, ? for help')}
        </Text>
      </Box>
    </Box>
  )
}

export { SLASH_ROUTES }
