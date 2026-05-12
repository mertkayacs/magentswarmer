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
            <Text color="#4a6fa5">── SESSION SHORTCUTS ─────────────────</Text>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">↑ ↓</Text>
              <Text color="gray" dimColor>select session</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">a</Text>
              <Text color="gray" dimColor>attach to session</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">k</Text>
              <Text color="gray" dimColor>kill session (confirm y)</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">x / X</Text>
              <Text color="gray" dimColor>delete history / wipe all</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">r</Text>
              <Text color="gray" dimColor>refresh list</Text>
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
        <Text color="gray" dimColor>HOME SHORTCUTS</Text>
        <Box><Text color="#7eb8f5">{'s'.padEnd(14)}</Text><Text color="gray">spawn agent</Text></Box>
        <Box><Text color="#7eb8f5">{'o'.padEnd(14)}</Text><Text color="gray">orchestrate multi</Text></Box>
        <Box><Text color="#7eb8f5">{'l'.padEnd(14)}</Text><Text color="gray">list sessions</Text></Box>
        <Box><Text color="#7eb8f5">{'d'.padEnd(14)}</Text><Text color="gray">doctor health</Text></Box>
      </Box>
    </ScreenLayout>
  )
}
