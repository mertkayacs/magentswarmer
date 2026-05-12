// Slash command and keyboard shortcut reference. Pure display.
// Inputs: none (reads SLASH_ROUTES from useScreenNav). Outputs: reference Box.
// Invariant: useScreenNav handles all navigation; this screen adds no extra input.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav, DEDUPED_ROUTES } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function Help() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /help · keyboard reference</Text>
      </Box>

      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
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

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="gray" bold>SESSION SHORTCUTS</Text>
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
              <Text color="gray" dimColor>kill session</Text>
            </Box>
            <Box flexDirection="column" marginTop={1}>
              <Text color="#7eb8f5">r</Text>
              <Text color="gray" dimColor>refresh list</Text>
            </Box>
          </Box>
        )}
      </Box>

      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>
    </Box>
  )
}
