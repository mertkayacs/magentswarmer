// Shared 3-zone layout for all screens. Zone 1: fixed header. Zone 2: growable content
// with NavSidebar (3 panes) and optional right panel (2+ panes). Zone 3: fixed command bar.
// CommandPicker is injected automatically after children. Screens pass nav from useScreenNav.
// Invariant: Zone 2 is always row when panes >= 2; rightPanel only renders when panes >= 2.

import React from 'react'
import { Box, Text } from 'ink'
import { NavSidebar } from './NavSidebar.js'
import { CommandPicker } from './CommandPicker.js'
import type { ScreenName, Panes } from '../state/types.js'
import type { ScreenNavState } from '../hooks/useScreenNav.js'

interface ScreenLayoutProps {
  screen: ScreenName
  panes: Panes
  nav: ScreenNavState
  header?: React.ReactNode
  children: React.ReactNode
  rightPanel?: React.ReactNode
  hint?: string
}

export function ScreenLayout({
  screen,
  panes,
  nav,
  header,
  children,
  rightPanel,
  hint = 'type a command',
}: ScreenLayoutProps) {
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = nav

  return (
    <Box flexDirection="column" paddingX={1}>
      {header && <Box marginBottom={1}>{header}</Box>}

      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        {panes === 3 && <NavSidebar panes={panes} currentScreen={screen} />}
        <Box flexDirection="column" flexGrow={1}>
          {children}
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>
        {panes >= 2 && rightPanel}
      </Box>

      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>{hint}</Text>}
        </Box>
      </Box>
    </Box>
  )
}
