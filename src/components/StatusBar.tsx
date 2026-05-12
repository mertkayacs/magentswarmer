// One-line glanceable footer: screen name, session count, provider availability.
// Inputs: screen name, optional session count and provider states. Outputs: Ink Box.

import React from 'react'
import { Box, Text } from 'ink'

interface StatusBarProps {
  screen: string
  sessions?: number
  providers?: { cc: boolean; codex: boolean; gemini: boolean }
  message?: string
}

export function StatusBar({ screen, sessions, providers, message }: StatusBarProps) {
  const providerStr = providers
    ? Object.entries(providers)
        .map(([name, ok]) => (ok ? `${name} ✓` : `${name} ✗`))
        .join('  ')
    : null

  return (
    <Box paddingLeft={1} paddingRight={1} marginTop={0}>
      <Box flexGrow={1}>
        <Text color="#5a96e0" bold>
          {screen.toLowerCase()}
        </Text>
        {sessions !== undefined && (
          <Text color="gray" dimColor>
            {'  '}
            {sessions} session{sessions !== 1 ? 's' : ''}
          </Text>
        )}
        {message && (
          <Text color="yellow" dimColor>
            {'  '}
            {message}
          </Text>
        )}
      </Box>
      {providerStr && (
        <Text color="gray" dimColor>
          {providerStr}
        </Text>
      )}
    </Box>
  )
}
