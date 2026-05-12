// Main hub: gradient header, provider dots, sessions grouped by working_dir, shortcuts.
// Inputs: registry sessions, detectAvailable, loadState. Outputs: dashboard Box.
// Invariant: session list and providers read on mount only; press r to refresh manually.

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import chalk from 'chalk'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { detectAvailable } from '../launcher/providers.js'
import { listAll as listSessions, read as readSession } from '../state/registry.js'
import { loadState } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import { gradientChars, GRADIENT_STOPS } from '../brand/banner.js'
import type { Provider, Session } from '../state/types.js'

function groupByDir(sessions: Session[]): Array<[string, Session[]]> {
  const home = homedir()
  const map = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = (s.working_dir ?? '(no project)').replace(home, '~')
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  return Array.from(map.entries())
}

export function Home() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [providers, setProviders] = useState<Record<Provider, boolean>>({ cc: false, codex: false, gemini: false })

  useEffect(() => {
    setSessions(listSessions().filter(s => s.ended_at === null))
    setProviders(detectAvailable())
  }, [])

  const titleStr = useMemo(() => {
    const chars = gradientChars('REEVES AGENTS', GRADIENT_STOPS, 'horizontal')[0] ?? []
    return chars.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
  }, [])

  const groups = groupByDir(sessions)

  const state = loadState()
  const recentIds = state.recent_sessions.slice(0, 5)
  const recentSessions = recentIds
    .map(id => { try { return readSession(id) } catch { return null } })
    .filter((s): s is Session => s !== null)

  useInput((input) => {
    if (cmdMode) return
    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'l') { push('Sessions'); return }
    if (input === 't') { push('Top'); return }
    if (input === 'd') { push('Doctor'); return }
    if (input === 'h') { push('Help'); return }
    if (input === 'r') {
      setSessions(listSessions().filter(s => s.ended_at === null))
      setProviders(detectAvailable())
    }
  }, { isActive: !cmdMode })

  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text>{titleStr}</Text>
        <Text color="gray" dimColor>  </Text>
        {(['cc', 'codex', 'gemini'] as Provider[]).map(p => (
          <Text key={p} color={providers[p] ? providerColor(p) : '#30363d'}>
            {providers[p] ? '●' : '○'}{p}{'  '}
          </Text>
        ))}
        <Text color="gray" dimColor>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {/* Sessions section */}
          <Text color="#4a6fa5">{'── SESSIONS ' + '─'.repeat(dashLen)}</Text>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>  no sessions running  s spawn  o orchestrate</Text>
          ) : (
            groups.map(([dir, groupSessions]) => (
              <Box key={dir} flexDirection="column" marginBottom={0}>
                <Text color="#6e7681" dimColor>  {dir}</Text>
                {groupSessions.map(s => (
                  <Box key={s.id}>
                    <Text color="gray" dimColor>    </Text>
                    <Text color="#7eb8f5">{s.id}</Text>
                    <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                    <Text color="gray" dimColor>  {(s.tag ?? s.name).slice(0, 24)}</Text>
                  </Box>
                ))}
              </Box>
            ))
          )}

          {/* Presets section */}
          {state.presets.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="#4a6fa5">{'── PRESETS ' + '─'.repeat(Math.max(0, dashLen + 1))}</Text>
              {state.presets.map((p, i) => (
                <Box key={p.name}>
                  <Text color="#7eb8f5">  {i + 1}</Text>
                  <Text color="gray" dimColor>  {p.name.padEnd(20)}</Text>
                  <Text color="gray" dimColor>{p.workers.length} workers</Text>
                </Box>
              ))}
            </Box>
          )}

          {/* Shortcuts */}
          <Box marginTop={1}>
            <Text color="#4a6fa5">{'── SHORTCUTS ' + '─'.repeat(Math.max(0, dashLen - 1))}</Text>
          </Box>
          <Box>
            <Text color="#7eb8f5">s</Text><Text color="gray"> spawn  </Text>
            <Text color="#7eb8f5">o</Text><Text color="gray"> orchestrate  </Text>
            <Text color="#7eb8f5">l</Text><Text color="gray"> sessions  </Text>
            <Text color="#7eb8f5">t</Text><Text color="gray"> top  </Text>
            <Text color="#7eb8f5">d</Text><Text color="gray"> doctor  </Text>
            <Text color="#7eb8f5">?</Text><Text color="gray"> help</Text>
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── RECENT ────────────────────────────</Text>
            {recentSessions.length === 0 ? (
              <Text color="gray" dimColor>no recent sessions</Text>
            ) : (
              recentSessions.map(s => (
                <Box key={s.id}>
                  <Text color={s.ended_at ? '#30363d' : '#7eb8f5'}>{s.id}</Text>
                  <Text color={s.ended_at ? '#30363d' : providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                  <Text color={s.ended_at ? '#30363d' : 'gray'} dimColor={!!s.ended_at}>
                    {'  '}{(s.tag ?? s.name).slice(0, 18)}
                  </Text>
                </Box>
              ))
            )}
          </Box>
        )}
      </Box>

      {/* Zone 3 */}
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>
    </Box>
  )
}
