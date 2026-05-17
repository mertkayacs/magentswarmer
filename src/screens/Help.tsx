// Slash command and keyboard shortcut reference. Pure display.
// Inputs: DEDUPED_ROUTES from useScreenNav. Outputs: reference layout.
// Invariant: useScreenNav handles all navigation; this screen adds no extra input.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav, DEDUPED_ROUTES } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'

export function Help() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const nav = useScreenNav(push, pop)

  return (
    <ScreenLayout
      screen="Help"
      panes={panes}
      nav={nav}
      hint="esc to go back"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /help · keyboard reference</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 ? (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="#1e2d3e"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── TREE SHORTCUTS ────────────────────</Text>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">↑ ↓</Text>
              <Text color="gray" dimColor>select session</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">Enter</Text>
              <Text color="gray" dimColor>attach to session</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">k</Text>
              <Text color="gray" dimColor>kill session (confirm y)</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">r</Text>
              <Text color="gray" dimColor>send /remote-control (CC only)</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">s / o / d</Text>
              <Text color="gray" dimColor>spawn / orchestrate / doctor</Text>
            </Box>
          </Box>
        ) : undefined
      }
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>COMMANDS</Text>
        {DEDUPED_ROUTES.map(route => (
          <Box key={route.primary}>
            <Text color="#7eb8f5">{route.primary.padEnd(14)}</Text>
            <Text color="gray">{route.description}</Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>KEYBOARD</Text>
        <Box><Text color="#7eb8f5">{'esc'.padEnd(14)}</Text><Text color="gray">go back or exit</Text></Box>
        <Box><Text color="#7eb8f5">{'?'.padEnd(14)}</Text><Text color="gray">this help screen</Text></Box>
        <Box><Text color="#7eb8f5">{'/ + text'.padEnd(14)}</Text><Text color="gray">search commands</Text></Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>TREE SHORTCUTS</Text>
        <Box><Text color="#7eb8f5">{'s'.padEnd(14)}</Text><Text color="gray">spawn agent</Text></Box>
        <Box><Text color="#7eb8f5">{'o'.padEnd(14)}</Text><Text color="gray">orchestrate multi-agent tree</Text></Box>
        <Box><Text color="#7eb8f5">{'d'.padEnd(14)}</Text><Text color="gray">doctor health check</Text></Box>
        <Box><Text color="#7eb8f5">{'r'.padEnd(14)}</Text><Text color="gray">remote-control selected CC agent</Text></Box>
      </Box>
    </ScreenLayout>
  )
}
