// Autocomplete picker shown above the command bar when cmdMode is active.
// Inputs: filtered completions array, currently highlighted index.
// Outputs: none (display only). Returns null when completions is empty.
// Invariant: never renders when completions.length === 0.

import React from 'react'
import { Box, Text } from 'ink'
import chalk from 'chalk'
import type { DeduplicatedRoute } from '../hooks/useScreenNav.js'

interface Props {
  completions: DeduplicatedRoute[]
  selectedIdx: number
}

export function CommandPicker({ completions, selectedIdx }: Props) {
  if (completions.length === 0) return null

  const visible = completions.slice(0, 5)
  const hexOk = chalk.level >= 3

  const focusColor = hexOk ? '#5a96e0' : 'blue'
  const dimColor = hexOk ? '#30363d' : 'gray'
  const labelColor = hexOk ? '#7eb8f5' : 'cyan'
  const dimLabelColor = hexOk ? '#484f58' : 'gray'
  const aliasColor = hexOk ? '#4a6fa5' : 'blue'
  const dimAliasColor = hexOk ? '#21262d' : 'gray'
  const descColor = hexOk ? '#8b949e' : 'gray'
  const dimDescColor = hexOk ? '#1e2d3e' : 'gray'

  return (
    <Box flexDirection="column" marginBottom={0}>
      {visible.map((route, i) => {
        const isSelected = i === selectedIdx
        return (
          <Box key={route.primary}>
            <Text color={isSelected ? focusColor : dimColor}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text color={isSelected ? labelColor : dimLabelColor} bold={isSelected}>
              {' '}{route.primary}
            </Text>
            {route.alias.length > 0 && (
              <Text color={isSelected ? aliasColor : dimAliasColor}>
                {'  '}{route.alias}
              </Text>
            )}
            <Text color={isSelected ? descColor : dimDescColor}>
              {'  — '}{route.description}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
