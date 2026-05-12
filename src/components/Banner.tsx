// Renders the REEVES AGENTS ANSI Shadow banner with per-column blue gradient.
// Inputs: optional art string and gradient stops. Outputs: Ink Box of colored Text.

import React from 'react'
import { Box, Text } from 'ink'
import { gradientChars, BANNER_ART, GRADIENT_STOPS } from '../brand/banner.js'

interface BannerProps {
  art?: string
  stops?: readonly string[]
  compact?: boolean
}

export function Banner({ art = BANNER_ART, stops = GRADIENT_STOPS, compact = false }: BannerProps) {
  const lines = gradientChars(art, stops)

  if (compact) {
    // Single-line "REEVES AGENTS" for narrow terminals
    return (
      <Box>
        <Text bold color="#5a96e0">
          REEVES AGENTS
        </Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {lines.map((line, li) => (
        <Box key={li} flexDirection="row">
          {line.map((c, ci) => (
            <Text key={ci} bold color={c.color}>
              {c.char}
            </Text>
          ))}
        </Box>
      ))}
    </Box>
  )
}
