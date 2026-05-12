// System health check display. Runs checks on mount, shows results with status icons.
// Inputs: none (reads system state). Outputs: check list Box with orphan management.
// Invariant: all checks complete even if some fail; 'p' prunes orphan registry entries.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { runDoctor, pruneOrphans } from '../launcher/doctor.js'
import type { DoctorResult } from '../launcher/doctor.js'
import type { Session } from '../state/types.js'

function statusIcon(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return '✓'
  if (status === 'warn') return '!'
  return '✗'
}

function statusColor(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return 'green'
  if (status === 'warn') return 'yellow'
  return 'red'
}

export function Doctor() {
  const { push, pop } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [result, setResult] = useState<DoctorResult | null>(null)
  const [pruned, setPruned] = useState(false)

  useEffect(() => {
    setResult(runDoctor())
  }, [])

  useInput((input) => {
    if (cmdMode) return
    if (input === 'p' && result && result.orphans.length > 0 && !pruned) {
      pruneOrphans(result.orphans as Session[])
      setPruned(true)
      setResult(prev => prev ? { ...prev, orphans: [] } : null)
    }
    if (input === 'r') {
      setPruned(false)
      setResult(runDoctor())
    }
  }, { isActive: !cmdMode })

  const allOk = result?.checks.every(c => c.status === 'ok') ?? false

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>doctor</Text>
      </Box>

      {!result && <Text color="gray" dimColor>running checks...</Text>}

      {result && (
        <Box flexDirection="column" marginBottom={1}>
          {result.checks.map(check => (
            <Box key={check.name}>
              <Text color={statusColor(check.status)}>{statusIcon(check.status)}</Text>
              <Text> {check.name.padEnd(14)}</Text>
              <Text color="gray">{check.detail}</Text>
            </Box>
          ))}

          {result.orphans.length > 0 && !pruned && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">{result.orphans.length} orphan session{result.orphans.length !== 1 ? 's' : ''} in registry</Text>
              {result.orphans.map((s: Session) => (
                <Text key={s.id} color="gray" dimColor>  {s.id}  {s.name}</Text>
              ))}
              <Text color="gray" dimColor>press p to prune, r to re-run</Text>
            </Box>
          )}

          {pruned && (
            <Box marginTop={1}>
              <Text color="green">orphans pruned</Text>
            </Box>
          )}

          {result.orphans.length === 0 && !pruned && (
            <Box marginTop={1}>
              <Text color={allOk ? 'green' : 'yellow'}>
                {allOk ? 'all checks passed' : 'some checks need attention'}
              </Text>
              <Text color="gray" dimColor>  press r to re-run</Text>
            </Box>
          )}
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>

      <StatusBar screen="doctor" />
    </Box>
  )
}
