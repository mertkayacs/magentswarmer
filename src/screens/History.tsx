// Session history. Shows ended sessions with duration. d to delete, D to wipe all.
// Full implementation in Plan 3.
// Inputs: session registry (ended_at set). Outputs: history list.
// Invariant: only shows sessions where ended_at is non-null.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function History() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  void panes

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /history · session history</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <Text color="#6e7681" dimColor>full implementation in plan 3</Text>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      </Box>
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>
    </Box>
  )
}
