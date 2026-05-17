// Main home screen: tree of all sessions with live peek panel.
// Inputs: allSessions from SessionContext. Outputs: navigation, kill actions.
// Invariant: selectedIdx always clamped to valid range; peek clears on ended sessions.

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { execFileSync } from 'node:child_process'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { useSessionState } from '../state/SessionContext.js'
import { computeStatus, updateSession, nowIso } from '../state/registry.js'
import { peek } from '../launcher/peek.js'
import { jumpToSession } from '../launcher/jump.js'
import { providerColor } from '../utils/display.js'
import { loadConfig } from '../state/config.js'
import type { Session, SessionStatus } from '../state/types.js'

interface FlatRow {
  session: Session
  depth: number
  status: SessionStatus
}

function buildRows(allSessions: Session[]): FlatRow[] {
  const byParent = new Map<string | null, Session[]>()
  for (const s of allSessions) {
    if (!byParent.has(s.parent_id)) byParent.set(s.parent_id, [])
    byParent.get(s.parent_id)!.push(s)
  }
  for (const group of byParent.values()) {
    group.sort((a, b) => b.started_at.localeCompare(a.started_at))
  }

  const rows: FlatRow[] = []
  function walk(parentId: string | null, depth: number) {
    for (const s of byParent.get(parentId) ?? []) {
      rows.push({ session: s, depth, status: computeStatus(s) })
      walk(s.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
}

const STATUS_GLYPH: Record<SessionStatus, string> = {
  working: '●',
  idle:    '◌',
  ended:   '✕',
}

const STATUS_COLOR: Record<SessionStatus, string> = {
  working: '#4ec994',
  idle:    '#e5a050',
  ended:   '#6e7681',
}

const TASK_BADGE: Record<string, string> = {
  queued:  'Q',
  working: 'W',
  done:    '✓',
  failed:  '✗',
  blocked: '!',
}

export function TreeNavigator() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { allSessions, refresh } = useSessionState()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekOutput, setPeekOutput] = useState('')
  const [killing, setKilling] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav

  const rows = useMemo(() => buildRows(allSessions), [allSessions])
  const selected = rows[selectedIdx]?.session

  useEffect(() => {
    if (rows.length > 0) setSelectedIdx(i => Math.min(i, rows.length - 1))
  }, [rows.length])

  useEffect(() => {
    if (!selected || selected.ended_at) { setPeekOutput(''); return }
    const cfg = loadConfig()
    const doPeek = () => setPeekOutput(peek(selected.id, cfg.global.peek_lines))
    doPeek()
    const timer = setInterval(doPeek, cfg.global.peek_interval_ms)
    return () => clearInterval(timer)
  }, [selected?.id])

  const flashMsg = useCallback((msg: string, ms = 4000) => {
    setStatusMsg(msg)
    setTimeout(() => setStatusMsg(''), ms)
  }, [])

  function killSelected() {
    if (!selected) return
    try { execFileSync('tmux', ['kill-session', '-t', selected.tmux_session], { stdio: 'ignore' }) }
    catch { /* already gone */ }
    updateSession(selected.id, { ended_at: nowIso() })
    refresh()
    setKilling(false)
  }

  useInput((input, key) => {
    if (cmdMode) return

    if (killing) {
      if (input === 'y' || key.return) { killSelected(); return }
      if (input === 'n' || key.escape) { setKilling(false); return }
      return
    }

    if (key.upArrow)   { setSelectedIdx(i => Math.max(0, i - 1)); return }
    if (key.downArrow) { setSelectedIdx(i => Math.min(rows.length - 1, i + 1)); return }

    if (input === 'k') {
      if (selected && !selected.ended_at) setKilling(true)
      return
    }

    if (key.return && selected) {
      try {
        const result = jumpToSession(selected)
        if (!result.inside_tmux) flashMsg(result.attach_command)
      } catch {
        flashMsg('jump failed, session may have ended')
      }
      return
    }

    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'd') { push('Doctor'); return }

    // send /remote-control to a live CC session from TUI
    if (input === 'r' && selected && !selected.ended_at && selected.provider === 'cc') {
      try {
        execFileSync('tmux', ['send-keys', '-t', selected.tmux_session, '/remote-control', 'Enter'], { stdio: 'ignore' })
        flashMsg(`sent /remote-control to ${selected.nickname}`)
      } catch {
        flashMsg('tmux send failed — session may have ended')
      }
      return
    }
  }, { isActive: !cmdMode })

  const rightPanel = panes >= 2 ? (
    <Box flexDirection="column" width={44} marginLeft={1} borderStyle="round" borderColor="#1e2d3e" paddingX={1}>
      {killing && selected ? (
        <Box flexDirection="column">
          <Text color="#4a6fa5">── KILL ─────────────────────────────</Text>
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text>Kill </Text><Text color="#e5a050" bold>{selected.nickname}</Text><Text>?</Text>
            </Box>
            <Box marginTop={1}>
              <Text color="green">y</Text><Text color="gray">/</Text>
              <Text color="green">Enter</Text><Text color="gray"> confirm   </Text>
              <Text color="gray">n/Esc cancel</Text>
            </Box>
          </Box>
        </Box>
      ) : selected ? (
        <Box flexDirection="column">
          <Text color="#4a6fa5">── {selected.nickname.slice(0, 22).padEnd(22)} ──────</Text>
          <Box marginTop={1}>
            {selected.ended_at
              ? <Text color="#6e7681" dimColor>session ended</Text>
              : peekOutput
                ? <Text color="gray" wrap="wrap">{peekOutput}</Text>
                : <Text color="#6e7681" dimColor>waiting for output…</Text>
            }
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          <Text color="#4a6fa5">── PEEK ─────────────────────────────</Text>
          <Box marginTop={1}>
            <Text color="#6e7681" dimColor>select a session to peek</Text>
          </Box>
        </Box>
      )}
      {statusMsg
        ? <Box marginTop={1}><Text color="yellow">{statusMsg}</Text></Box>
        : null}
    </Box>
  ) : undefined

  const hint = killing
    ? 'y/Enter confirm  n/Esc cancel'
    : '↑↓ navigate  Enter jump  k kill  r rc  s spawn  o orchestrate'

  const activeCount = allSessions.filter(s => !s.ended_at).length

  return (
    <ScreenLayout
      screen="TreeNavigator"
      panes={panes}
      nav={nav}
      hint={hint}
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /tree</Text>
          <Text color="gray" dimColor>
            {'  '}{activeCount} active
            {rows.length > activeCount ? ` · ${rows.length - activeCount} ended` : ''}
          </Text>
        </Box>
      }
      rightPanel={rightPanel}
    >
      {rows.length === 0 ? (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>no sessions yet</Text>
          <Box marginTop={1}>
            <Text color="gray" dimColor>press </Text>
            <Text color="#5a96e0">s</Text>
            <Text color="gray" dimColor> to spawn your first agent</Text>
          </Box>
        </Box>
      ) : (
        <Box flexDirection="column">
          {rows.map((row, i) => {
            const { session: s, depth, status } = row
            const sel = i === selectedIdx
            const indent = '  '.repeat(depth)
            const glyph = STATUS_GLYPH[status]
            const glyphColor = STATUS_COLOR[status]
            const badge = TASK_BADGE[s.task_status] ?? '?'
            const taskText = s.task.length > 30 ? s.task.slice(0, 29) + '…' : s.task

            return (
              <Box key={s.id}>
                <Text color={sel ? '#5a96e0' : 'gray'}>{sel ? '>' : ' '}</Text>
                <Text color={glyphColor}> {indent}{glyph} </Text>
                <Text color={sel ? 'white' : '#c9d1d9'} bold={sel}>
                  {s.nickname.slice(0, 14).padEnd(15)}
                </Text>
                <Text color={providerColor(s.provider)} dimColor={!sel}>
                  {s.provider.padEnd(9)}
                </Text>
                <Text color={status === 'ended' ? '#6e7681' : '#4a6fa5'} dimColor>
                  [{badge}]{'  '}
                </Text>
                <Text color={status === 'ended' ? '#6e7681' : 'gray'} dimColor>
                  {taskText}
                </Text>
              </Box>
            )
          })}
        </Box>
      )}
    </ScreenLayout>
  )
}
