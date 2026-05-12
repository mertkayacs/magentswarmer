// Active session list grouped by working_dir. Subscribes to SessionContext for live updates.
// Arrow keys select, enter peeks, a attaches, k kill (confirm y), r refresh, c copy rc_url.
// Inputs: SessionContext (sessions). Outputs: session list + peek panel.
// Invariant: only sessions with ended_at === null shown; kill requires y confirm.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { useSessionState } from '../state/SessionContext.js'
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
  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav
  const { sessions, refresh } = useSessionState()
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState<string | null>(null)
  const [attachHint, setAttachHint] = useState('')
  const [copyStatus, setCopyStatus] = useState(false)
  const [killPending, setKillPending] = useState(false)

  useEffect(() => {
    setSelectedIdx(i => Math.min(i, Math.max(0, sessions.length - 1)))
  }, [sessions.length])

  const groups = groupByDir(sessions)
  const selected = sessionAtFlatIndex(groups, selectedIdx)
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  function doKill() {
    if (!selected) return
    try {
      execFileSync('tmux', ['kill-window', '-t', `${selected.tmux_session}:${selected.tmux_window}`], { stdio: 'ignore' })
    } catch { /* already gone */ }
    setPeekContent(null)
    refresh()
  }

  useInput((input, key) => {
    if (cmdMode) return

    if (killPending) {
      if (input === 'y') doKill()
      setKillPending(false)
      return
    }

    if (key.upArrow) { setSelectedIdx(i => Math.max(0, i - 1)); setPeekContent(null); return }
    if (key.downArrow) { setSelectedIdx(i => Math.min(sessions.length - 1, i + 1)); setPeekContent(null); return }
    if (key.return && selected) { setPeekContent(peek(selected.id, 15)); return }
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
    if (input === 'k' && selected) { setKillPending(true); return }
    if (input === 'r') { setPeekContent(null); refresh(); return }
    if (input === 'c' && selected?.rc_url) {
      process.stdout.write('\x1b]52;c;' + Buffer.from(selected.rc_url).toString('base64') + '\x07')
      setCopyStatus(true)
      setTimeout(() => setCopyStatus(false), 2000)
    }
  }, { isActive: !cmdMode })

  const peekBox = peekContent !== null ? (
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
      {selected?.rc_url && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>remote control</Text>
          <Text color="green">{selected.rc_url}</Text>
          <Text color="gray" dimColor>c to copy</Text>
          {copyStatus && <Text color="green">copied</Text>}
        </Box>
      )}
    </Box>
  ) : null

  return (
    <ScreenLayout
      screen="Sessions"
      panes={panes}
      nav={nav}
      hint="↑↓ select  enter peek  a attach  k kill  r refresh  c copy"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /sessions</Text>
          <Text color="gray" dimColor>  {sessions.length} active</Text>
        </Box>
      }
      rightPanel={peekBox ?? undefined}
    >
      <Text color="#4a6fa5">{'── SESSIONS ' + '─'.repeat(Math.max(0, dashLen))}</Text>
      {sessions.length === 0 ? (
        <Text color="gray" dimColor>  no active sessions — s to spawn one</Text>
      ) : (
        groups.map(([dir, groupSessions]) => (
          <Box key={dir} flexDirection="column">
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

      {attachHint !== '' && <Box marginTop={1}><Text color="yellow">{attachHint}</Text></Box>}

      {killPending && selected && (
        <Box marginTop={1} borderStyle="round" borderColor="red" paddingLeft={1} paddingRight={1}>
          <Text color="red">kill </Text>
          <Text color="white" bold>{selected.id}</Text>
          <Text color="gray">? press </Text>
          <Text color="white" bold>y</Text>
          <Text color="gray"> to confirm, any other key cancels</Text>
        </Box>
      )}

      {panes < 2 && peekBox}
    </ScreenLayout>
  )
}
