// Renders the REEVES AGENTS ANSI Shadow banner with per-column blue gradient.
// Uses chalk to colorize each line into a single ANSI string — one Text node per line,
// not one per character. Keeps Ink element count at ~12 regardless of banner width.

import React from 'react'
import { Box, Text } from 'ink'
import chalk from 'chalk'
import { gradientChars, BANNER_ART, GRADIENT_STOPS } from '../brand/banner.js'
import { COLOR_ENABLED } from '../utils/theme.js'

interface BannerProps {
  art?: string
  stops?: readonly string[]
  compact?: boolean
}

export function Banner({ art = BANNER_ART, stops = GRADIENT_STOPS, compact = false }: BannerProps) {
  if (compact) {
    return (
      <Box>
        <Text bold color="#5a96e0">REEVES AGENTS</Text>
      </Box>
    )
  }

  if (!COLOR_ENABLED) {
    return (
      <Box>
        <Text bold>REEVES AGENTS</Text>
      </Box>
    )
  }

  const coloredLines = gradientChars(art, stops).map(line =>
    line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
  )

  return (
    <Box flexDirection="column">
      {coloredLines.map((line, i) => (
        <Text key={i}>{line}</Text>
      ))}
    </Box>
  )
}
