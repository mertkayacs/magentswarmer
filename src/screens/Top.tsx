// Live session monitor. Auto-refreshes every 5s. Arrow keys select, a attaches,
// k kills, r forces refresh. Full implementation in Plan 3.
// Inputs: session registry. Outputs: tabular session list + peek panel (wide).
// Invariant: refresh interval always cleared on unmount.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function Top() {
  const { push, pop } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /top · live session monitor</Text>
      </Box>
      <Box flexGrow={1}>
        <Text color="#6e7681" dimColor>full implementation coming in plan 3</Text>
      </Box>
      <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
      <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
        <Text color="#5a96e0" bold>/ </Text>
        <Text>{cmdMode ? cmdValue : ''}</Text>
        {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
      </Box>
    </Box>
  )
}
