// Vertical sidebar showing deduped routes with shortcuts.
// Renders only when panes === 3. Current screen highlighted blue with >.
// Inputs: panes (1/2/3), currentScreen (ScreenName).
// Outputs: Box with width 20, flexDirection column, route rows.

import React from 'react'
import { Box, Text } from 'ink'
import { DEDUPED_ROUTES } from '../hooks/useScreenNav.js'
import type { ScreenName, Panes } from '../state/types.js'

export interface NavSidebarProps {
  panes: Panes
  currentScreen: ScreenName
}

export function NavSidebar({ panes, currentScreen }: NavSidebarProps) {
  if (panes < 3) return null

  return (
    <Box
      flexDirection="column"
      width={20}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginRight={1}
    >
      {DEDUPED_ROUTES.map(route => {
        const isCurrent = route.screen === currentScreen
        const shortcut = route.alias ? route.alias.replace('/', '') : ''
        const label = route.primary.replace('/', '')

        return (
          <Box key={route.primary}>
            <Text color={isCurrent ? '#5a96e0' : 'gray'} bold={isCurrent}>
              {isCurrent ? '> ' : '  '}
              {label.padEnd(10)}
            </Text>
            {shortcut && <Text color="gray" dimColor>{shortcut}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}
