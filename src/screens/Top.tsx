// Live session monitor. Flat table, auto-refreshes every 5s with dead session detection.
// Inputs: registry, tmux (has-session), peek (capture-pane). Outputs: session table + peek panel.
// Invariant: refresh interval always cleared on unmount; peek updates each refresh cycle.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { listAll, updateSession, isStale } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import { peek } from '../launcher/peek.js'
import type { Session } from '../state/types.js'

export function Top() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState('')
  const [attachHint, setAttachHint] = useState('')

  const refresh = useCallback(() => {
    const all = listAll()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', `${s.tmux_session}:${s.tmux_window}`], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const alive = listAll()
      .filter(s => s.ended_at === null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setSessions(alive)
    setSelectedIdx(prev => {
      const clamped = Math.min(prev, Math.max(0, alive.length - 1))
      const sel = alive[clamped]
      if (sel) setPeekContent(peek(sel.id, 15))
      return clamped
    })
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const selected = sessions[selectedIdx] ?? null

  useInput((input, key) => {
    if (cmdMode) return

    if (key.upArrow) {
      const next = Math.max(0, selectedIdx - 1)
      setSelectedIdx(next)
      const sel = sessions[next]
      if (sel) setPeekContent(peek(sel.id, 15))
      return
    }
    if (key.downArrow) {
      const next = Math.min(sessions.length - 1, selectedIdx + 1)
      setSelectedIdx(next)
      const sel = sessions[next]
      if (sel) setPeekContent(peek(sel.id, 15))
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
        setAttachHint(`tmux attach -t ${selected.tmux_session}`)
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

  const home = homedir()
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /top · auto-refresh 5s</Text>
        <Text color="gray" dimColor>  {sessions.length} active  ↑↓ select  a attach  k kill  r refresh</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 && peekContent ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>no active sessions</Text>
          ) : (
            <Box flexDirection="column">
              <Box paddingLeft={2}>
                <Text color="#4a6fa5">{'id'.padEnd(6)}</Text>
                <Text color="#4a6fa5">{'prov'.padEnd(8)}</Text>
                <Text color="#4a6fa5">{'name'.padEnd(24)}</Text>
                <Text color="#4a6fa5">{'dir'.padEnd(22)}</Text>
                <Text color="#4a6fa5">{'age'.padEnd(6)}</Text>
                <Text color="#4a6fa5">{'status'}</Text>
              </Box>
              <Text color="#1e2d3e">{'─'.repeat(dashLen)}</Text>
              {sessions.map((s, i) => {
                const isSelected = i === selectedIdx
                const stale = isStale(s)
                const dir = (s.working_dir ?? '(no project)').replace(home, '~').slice(0, 20)
                return (
                  <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                    {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                    <Text color={isSelected ? '#7eb8f5' : 'gray'} bold={isSelected}>{s.id.padEnd(6)}</Text>
                    <Text color={providerColor(s.provider)}>{('●' + s.provider).padEnd(8)}</Text>
                    <Text color={isSelected ? 'white' : 'gray'}>{(s.tag ?? s.name).slice(0, 22).padEnd(24)}</Text>
                    <Text color="#6e7681" dimColor>{dir.padEnd(22)}</Text>
                    <Text color="#6e7681" dimColor>{formatAge(s.created_at).padEnd(6)}</Text>
                    <Text color={stale ? '#facc15' : '#4ade80'} bold>{'● '}</Text>
                    <Text color={stale ? '#facc15' : '#4ade80'}>{stale ? 'stale' : 'active'}</Text>
                  </Box>
                )
              })}
            </Box>
          )}

          {attachHint !== '' && (
            <Box marginTop={1}>
              <Text color="yellow">{attachHint}</Text>
            </Box>
          )}

          <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
        </Box>

        {panes >= 2 && peekContent && (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="gray"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── PEEK ──────────────────────────────</Text>
            <Text color="gray" dimColor>{selected?.name ?? ''}</Text>
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
          {!cmdMode && <Text color="#6e7681" dimColor>type a command</Text>}
        </Box>
      </Box>
    </Box>
  )
}
