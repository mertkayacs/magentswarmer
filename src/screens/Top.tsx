// Live session monitor. Flat table, auto-refreshes via SessionContext every 5s.
// Inputs: SessionContext (sessions). Outputs: session table + auto-peek panel.
// Invariant: peek updates on arrow key and on every context refresh cycle.

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { useSessionState } from '../state/SessionContext.js'
import { isStale } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import { peek } from '../launcher/peek.js'

export function Top() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav
  const { sessions, refresh } = useSessionState()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState('')
  const [attachHint, setAttachHint] = useState('')

  const sorted = useMemo(
    () => [...sessions].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [sessions],
  )

  // Update peek on every refresh and on session count change
  useEffect(() => {
    const clamped = Math.min(selectedIdx, Math.max(0, sorted.length - 1))
    if (clamped !== selectedIdx) setSelectedIdx(clamped)
    const sel = sorted[clamped]
    if (sel) setPeekContent(peek(sel.id, 15))
  }, [sorted]) // eslint-disable-line react-hooks/exhaustive-deps

  const selected = sorted[selectedIdx] ?? null
  const home = homedir()
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  useInput((input, key) => {
    if (cmdMode) return
    if (key.upArrow) {
      const next = Math.max(0, selectedIdx - 1)
      setSelectedIdx(next)
      const sel = sorted[next]
      if (sel) setPeekContent(peek(sel.id, 15))
      return
    }
    if (key.downArrow) {
      const next = Math.min(sorted.length - 1, selectedIdx + 1)
      setSelectedIdx(next)
      const sel = sorted[next]
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
    if (input === 'r') { refresh(); return }
  }, { isActive: !cmdMode })

  const peekPanel = peekContent ? (
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
  ) : undefined

  return (
    <ScreenLayout
      screen="Top"
      panes={panes}
      nav={nav}
      hint="↑↓ select  a attach  k kill  r refresh · auto-refresh 5s"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /top · auto-refresh 5s</Text>
          <Text color="gray" dimColor>  {sorted.length} active</Text>
        </Box>
      }
      rightPanel={peekPanel}
    >
      {sorted.length === 0 ? (
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
          {sorted.map((s, i) => {
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

      {attachHint !== '' && <Box marginTop={1}><Text color="yellow">{attachHint}</Text></Box>}
    </ScreenLayout>
  )
}
