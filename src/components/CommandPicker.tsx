// Autocomplete picker shown above the command bar when cmdMode is active.
// Inputs: filtered completions array, currently highlighted index.
// Outputs: none (display only). Returns null when completions is empty.
// Invariant: never renders when completions.length === 0.

import React from 'react'
import { Box, Text } from 'ink'
import type { DeduplicatedRoute } from '../hooks/useScreenNav.js'

interface Props {
  completions: DeduplicatedRoute[]
  selectedIdx: number
}

export function CommandPicker({ completions, selectedIdx }: Props) {
  if (completions.length === 0) return null

  const visible = completions.slice(0, 5)

  return (
    <Box flexDirection="column" marginBottom={0}>
      {visible.map((route, i) => {
        const isSelected = i === selectedIdx
        return (
          <Box key={route.primary}>
            <Text color={isSelected ? '#5a96e0' : '#30363d'}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text color={isSelected ? '#7eb8f5' : '#484f58'} bold={isSelected}>
              {' '}{route.primary}
            </Text>
            {route.alias.length > 0 && (
              <Text color={isSelected ? '#4a6fa5' : '#21262d'}>
                {'  '}{route.alias}
              </Text>
            )}
            <Text color={isSelected ? '#8b949e' : '#1e2d3e'}>
              {'  — '}{route.description}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
