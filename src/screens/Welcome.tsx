// Welcome splash. Diagonal-gradient ASCII art, auto-advances to Home after 5s.
// Inputs: push from router. Detects first-run (no providers on PATH → Settings).
// Invariant: timer cleared on unmount; splashShown prevents re-showing on revisit.

import React, { useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import chalk from 'chalk'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { detectAvailable } from '../launcher/providers.js'
import { gradientChars, REEVES_ART, AGENTS_ART, GRADIENT_STOPS } from '../brand/banner.js'

let splashShown = false

export function Welcome() {
  const { push } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, () => {})

  useEffect(() => {
    if (splashShown) {
      push('Home')
      return
    }

    const available = detectAvailable()
    const anyAvailable = Object.values(available).some(Boolean)
    if (!anyAvailable) {
      splashShown = true
      push('Settings')
      return
    }

    const timer = setTimeout(() => {
      splashShown = true
      push('Home')
    }, 5000)

    return () => clearTimeout(timer)
  }, [push])

  useInput(() => {
    splashShown = true
    push('Home')
  }, { isActive: !cmdMode })

  const reevesLines = useMemo(() => {
    return gradientChars(REEVES_ART, GRADIENT_STOPS, 'diagonal').map(line =>
      line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
    )
  }, [])

  const agentsLines = useMemo(() => {
    return gradientChars(AGENTS_ART, GRADIENT_STOPS, 'diagonal').map(line =>
      line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
    )
  }, [])

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box flexGrow={1} flexDirection="column" justifyContent="center">
        <Box flexDirection="column" alignItems="center">
          {reevesLines.map((line, i) => (
            <Box key={`r${i}`} justifyContent="center">
              <Text>{line}</Text>
            </Box>
          ))}
          {agentsLines.map((line, i) => (
            <Box key={`a${i}`} justifyContent="center">
              <Text>{line}</Text>
            </Box>
          ))}
          <Box marginTop={1} justifyContent="center">
            <Text color="#6e7681" dimColor>spawn  ·  watch  ·  jump</Text>
          </Box>
        </Box>

        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      </Box>

      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>any key to skip</Text>}
        </Box>
      </Box>
    </Box>
  )
}
