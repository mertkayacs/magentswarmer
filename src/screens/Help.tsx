// Slash command and keyboard shortcut reference. Pure display.
// Inputs: none (reads SLASH_ROUTES from useScreenNav). Outputs: reference Box.
// Invariant: useScreenNav handles all navigation; this screen adds no extra input.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav, SLASH_ROUTES } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'

export function Help() {
  const { push, pop } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>help</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>SLASH COMMANDS</Text>
        {(Object.entries(SLASH_ROUTES) as [string, string][]).map(([cmd, screen]) => (
          <Box key={cmd}>
            <Text color="#7eb8f5">{cmd.padEnd(14)}</Text>
            <Text color="gray">{screen.toLowerCase()}</Text>
          </Box>
        ))}
        <Box>
          <Text color="#7eb8f5">{'/q, /quit'.padEnd(14)}</Text>
          <Text color="gray">exit</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>KEYBOARD</Text>
        <Box><Text color="#7eb8f5">{'esc'.padEnd(14)}</Text><Text color="gray">go back</Text></Box>
        <Box><Text color="#7eb8f5">{'?'.padEnd(14)}</Text><Text color="gray">this screen</Text></Box>
        <Box><Text color="#7eb8f5">{'/ + cmd'.padEnd(14)}</Text><Text color="gray">navigate by command</Text></Box>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>HOME SHORTCUTS</Text>
        <Box><Text color="#7eb8f5">{'s'.padEnd(14)}</Text><Text color="gray">spawn</Text></Box>
        <Box><Text color="#7eb8f5">{'o'.padEnd(14)}</Text><Text color="gray">orchestrate</Text></Box>
        <Box><Text color="#7eb8f5">{'l'.padEnd(14)}</Text><Text color="gray">sessions</Text></Box>
        <Box><Text color="#7eb8f5">{'d'.padEnd(14)}</Text><Text color="gray">doctor</Text></Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>

      <StatusBar screen="help" />
    </Box>
  )
}
