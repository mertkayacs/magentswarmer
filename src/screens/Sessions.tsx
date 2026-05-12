// Active and recent session list with inline peek. Arrow keys select, enter peeks, k kills.
// Inputs: registry (reads all sessions), tmux (capture-pane for peek). Outputs: session list Box.
// Invariant: killing removes from registry and kills the tmux window; peek shows last 20 lines.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { execFileSync } from 'node:child_process'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { usePanes } from '../hooks/usePanes.js'
import { listAll as listSessions, remove as removeSession } from '../state/registry.js'
import { peek } from '../launcher/peek.js'
import type { Session } from '../state/types.js'

function age(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function Sessions() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState<string | null>(null)
  const [killing, setKilling] = useState(false)

  const refresh = useCallback(() => {
    const s = listSessions()
    setSessions(s)
    setSelectedIdx(idx => Math.min(idx, Math.max(0, s.length - 1)))
    setPeekContent(null)
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const selected = sessions[selectedIdx] ?? null

  useInput((input, key) => {
    if (cmdMode) return

    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      setPeekContent(null)
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(sessions.length - 1, i + 1))
      setPeekContent(null)
      return
    }
    if (key.return && selected) {
      setPeekContent(peek(selected.id, 20))
      return
    }
    if (input === 'k' && selected && !killing) {
      setKilling(true)
      try {
        execFileSync(
          'tmux', ['kill-window', '-t', `${selected.tmux_session}:${selected.tmux_window}`],
          { stdio: 'ignore' }
        )
      } catch {
        // window may already be gone
      }
      removeSession(selected.id)
      refresh()
      setKilling(false)
      return
    }
    if (input === 'r') {
      refresh()
      return
    }
  }, { isActive: !cmdMode })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>sessions</Text>
        <Text color="gray" dimColor>  {sessions.length} total  </Text>
        <Text color="gray" dimColor>↑↓ select  enter peek  k kill  r refresh</Text>
      </Box>

      {sessions.length === 0 && (
        <Text color="gray" dimColor>no sessions — press s to spawn one</Text>
      )}

      <Box flexDirection={panes >= 2 && peekContent !== null ? 'row' : 'column'}>
        <Box flexDirection="column" flexShrink={0}>
          {sessions.map((s, i) => (
            <Box key={s.id} paddingLeft={selectedIdx === i ? 0 : 2}>
              {selectedIdx === i && <Text color="#5a96e0" bold>{'> '}</Text>}
              <Text color={selectedIdx === i ? '#7eb8f5' : 'gray'}>
                {s.id}
              </Text>
              <Text color="gray" dimColor>  </Text>
              <Text color={selectedIdx === i ? '#5a96e0' : 'gray'}>{s.provider}</Text>
              <Text color="gray" dimColor>  {(s.tag ?? s.name).slice(0, 24).padEnd(24)}  </Text>
              <Text color="gray" dimColor>{age(s.created_at)}</Text>
            </Box>
          ))}
        </Box>

        {peekContent !== null && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingLeft={1}
            paddingRight={1}
            marginLeft={panes >= 2 ? 2 : 0}
            marginTop={panes < 2 ? 1 : 0}
            flexGrow={1}
          >
            <Text color="gray" dimColor>{selected?.name ?? ''}  (last 20 lines)</Text>
            {peekContent.split('\n').map((line, i) => (
              <Text key={i} wrap="truncate">{line || ' '}</Text>
            ))}
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>

      <StatusBar screen="sessions" sessions={sessions.length} />
    </Box>
  )
}
