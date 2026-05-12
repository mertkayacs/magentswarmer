// Active session list grouped by working_dir. Auto-refreshes every 5s with dead session detection.
// Arrow keys select, enter peeks, a attaches, k kills, r forces refresh.
// Inputs: registry (all sessions), tmux (has-session check, capture-pane for peek).
// Invariant: only sessions with ended_at === null shown; refresh interval cleared on unmount.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { listAll as listSessions, updateSession } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import { peek } from '../launcher/peek.js'
import type { Session } from '../state/types.js'

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

function flatIndex(groups: Array<[string, Session[]]>, session: Session): number {
  let i = 0
  for (const [, groupSessions] of groups) {
    for (const s of groupSessions) {
      if (s.id === session.id) return i
      i++
    }
  }
  return 0
}

function sessionAtFlatIndex(groups: Array<[string, Session[]]>, idx: number): Session | null {
  let i = 0
  for (const [, groupSessions] of groups) {
    for (const s of groupSessions) {
      if (i === idx) return s
      i++
    }
  }
  return null
}

export function Sessions() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState<string | null>(null)
  const [attachHint, setAttachHint] = useState('')

  const refresh = useCallback(() => {
    const all = listSessions()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', `${s.tmux_session}:${s.tmux_window}`], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const alive = listSessions().filter(s => s.ended_at === null)
    setSessions(alive)
    setSelectedIdx(i => Math.min(i, Math.max(0, alive.length - 1)))
    setPeekContent(null)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const groups = groupByDir(sessions)
  const totalSessions = sessions.length
  const selected = sessionAtFlatIndex(groups, selectedIdx)

  useInput((input, key) => {
    if (cmdMode) return

    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      setPeekContent(null)
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(totalSessions - 1, i + 1))
      setPeekContent(null)
      return
    }
    if (key.return && selected) {
      setPeekContent(peek(selected.id, 15))
      return
    }
    if (input === 'a' && selected) {
      const target = `${selected.tmux_session}:${selected.tmux_window}`
      if (process.env.TMUX) {
        try {
          execFileSync('tmux', ['switch-client', '-t', target], { stdio: 'ignore' })
        } catch {
          setAttachHint(`could not switch to ${target}`)
          setTimeout(() => setAttachHint(''), 4000)
        }
      } else {
        setAttachHint(`tmux attach -t ${selected.tmux_session}  (then: select-window -t ${target})`)
        setTimeout(() => setAttachHint(''), 4000)
      }
      return
    }
    if (input === 'k' && selected) {
      try {
        execFileSync('tmux', ['kill-window', '-t', `${selected.tmux_session}:${selected.tmux_window}`], { stdio: 'ignore' })
      } catch { /* already gone */ }
      refresh()
      return
    }
    if (input === 'r') {
      refresh()
      return
    }
  }, { isActive: !cmdMode })

  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /sessions</Text>
        <Text color="gray" dimColor>  {sessions.length} active  ↑↓ select  enter peek  a attach  k kill  r refresh</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 && peekContent !== null ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>no active sessions — s to spawn one</Text>
          ) : (
            groups.map(([dir, groupSessions]) => (
              <Box key={dir} flexDirection="column" marginBottom={0}>
                <Text color="#4a6fa5">{'── ' + dir + ' ' + '─'.repeat(Math.max(0, dashLen - dir.length - 1))}</Text>
                {groupSessions.map(s => {
                  const flatIdx = flatIndex(groups, s)
                  const isSelected = flatIdx === selectedIdx
                  return (
                    <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                      {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                      <Text color={isSelected ? '#7eb8f5' : 'gray'} bold={isSelected}>{s.id}</Text>
                      <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                      <Text color={isSelected ? 'white' : 'gray'}>  {(s.tag ?? s.name).slice(0, 22).padEnd(22)}</Text>
                      <Text color="#6e7681" dimColor>  {formatAge(s.created_at)}</Text>
                    </Box>
                  )
                })}
              </Box>
            ))
          )}

          {attachHint !== '' && (
            <Box marginTop={1}>
              <Text color="yellow">{attachHint}</Text>
            </Box>
          )}

          <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
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
            flexGrow={panes >= 2 ? 1 : 0}
          >
            <Text color="gray" dimColor>{selected?.name ?? ''}  (last 15 lines)</Text>
            {peekContent.split('\n').map((line, i) => (
              <Text key={i} wrap="truncate">{line || ' '}</Text>
            ))}
          </Box>
        )}
      </Box>

      {/* Zone 3 */}
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
