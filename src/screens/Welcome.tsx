// Welcome splash. Diagonal-gradient ASCII art, auto-advances to Home after 5s.
// Inputs: push from router. Detects first-run (no providers on PATH → Settings).
// Invariant: timer cleared on unmount; splashShown prevents re-showing on revisit.

import React, { useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import chalk from 'chalk'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { detectAvailable } from '../launcher/providers.js'
import { gradientChars, REEVES_ART, AGENTS_ART, GRADIENT_STOPS } from '../brand/banner.js'

let splashShown = false

export function Welcome() {
  const { push } = useRouter()
  const panes = usePanes()
  const nav = useScreenNav(push, () => {})
  const { cmdMode } = nav

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
    <ScreenLayout
      screen="Welcome"
      panes={panes}
      nav={nav}
      hint="any key to skip"
    >
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
      </Box>
    </ScreenLayout>
  )
}
