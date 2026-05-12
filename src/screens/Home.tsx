// Main hub: banner, provider availability, session count, keyboard shortcuts.
// Inputs: none (reads registry and detects providers). Outputs: dashboard Box.
// Invariant: shortcuts s/o/l/d only fire when not in cmdMode.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { Banner } from '../components/Banner.js'
import { usePanes } from '../hooks/usePanes.js'
import { detectAvailable } from '../launcher/providers.js'
import { listAll as listSessions } from '../state/registry.js'
import type { Provider, Session } from '../state/types.js'

export function Home() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [providers, setProviders] = useState<Record<Provider, boolean>>({ cc: false, codex: false, gemini: false })

  useEffect(() => {
    setSessions(listSessions())
    setProviders(detectAvailable())
  }, [])

  useInput((input) => {
    if (cmdMode) return
    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'l') { push('Sessions'); return }
    if (input === 'd') { push('Doctor'); return }
  }, { isActive: !cmdMode })

  const providerStatus = {
    cc: providers.cc,
    codex: providers.codex,
    gemini: providers.gemini,
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner compact={panes === 1} />

      <Box flexDirection={panes >= 2 ? 'row' : 'column'} marginTop={1}>
        <Box flexDirection="column" flexGrow={1}>
          <Box marginBottom={1}>
            <Text color="gray" dimColor>PROVIDERS</Text>
          </Box>
          {(['cc', 'codex', 'gemini'] as Provider[]).map(p => (
            <Box key={p}>
              <Text color={providers[p] ? 'green' : 'gray'}>{providers[p] ? '✓' : '○'}</Text>
              <Text>  {p}</Text>
            </Box>
          ))}
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" flexGrow={1} paddingLeft={4}>
            <Box marginBottom={1}>
              <Text color="gray" dimColor>SESSIONS</Text>
            </Box>
            <Text>{sessions.length} active</Text>
            {sessions.slice(0, 3).map(s => (
              <Box key={s.id}>
                <Text color="gray" dimColor>  {s.id}  </Text>
                <Text color="#7eb8f5">{s.provider}</Text>
                <Text color="gray" dimColor>  {s.tag ?? s.name}</Text>
              </Box>
            ))}
            {sessions.length > 3 && (
              <Text color="gray" dimColor>  +{sessions.length - 3} more — press l</Text>
            )}
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <Text color="gray" dimColor>SHORTCUTS</Text>
        <Box>
          <Text color="#7eb8f5">s</Text><Text color="gray"> spawn  </Text>
          <Text color="#7eb8f5">o</Text><Text color="gray"> orchestrate  </Text>
          <Text color="#7eb8f5">l</Text><Text color="gray"> sessions  </Text>
          <Text color="#7eb8f5">d</Text><Text color="gray"> doctor  </Text>
          <Text color="#7eb8f5">?</Text><Text color="gray"> help</Text>
        </Box>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>

      <StatusBar screen="home" sessions={sessions.length} providers={providerStatus} />
    </Box>
  )
}
