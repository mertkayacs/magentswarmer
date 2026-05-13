// Session history. Shows ended sessions sorted by end time, grouped by working_dir.
// Inputs: registry (ended_at set). Outputs: history list with duration column.
// Invariant: only sessions with ended_at !== null appear; wipe-all requires y confirm.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { listAll, remove as removeSession } from '../state/registry.js'
import { providerColor, formatDuration } from '../utils/display.js'
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

function flatSessions(groups: Array<[string, Session[]]>): Session[] {
  return groups.flatMap(([, sessions]) => sessions)
}

export function History() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [wipePending, setWipePending] = useState(false)

  const load = useCallback(() => {
    const all = listAll()
      .filter(s => s.ended_at !== null)
      .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())
    setSessions(all)
    setSelectedIdx(i => Math.min(i, Math.max(0, all.length - 1)))
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [load])

  const groups = groupByDir(sessions)
  const flat = flatSessions(groups)
  const selected = flat[selectedIdx] ?? null
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  useInput((input, key) => {
    if (cmdMode) return

    if (wipePending) {
      if (input === 'y') {
        for (const s of sessions) removeSession(s.id)
        setWipePending(false)
        load()
      } else {
        setWipePending(false)
      }
      return
    }

    if (key.upArrow) { setSelectedIdx(i => Math.max(0, i - 1)); return }
    if (key.downArrow) { setSelectedIdx(i => Math.min(flat.length - 1, i + 1)); return }
    if (input === 'x' && selected) { removeSession(selected.id); load(); return }
    if (input === 'X') { if (sessions.length > 0) setWipePending(true); return }
    if (input === 'r') { load(); return }
  }, { isActive: !cmdMode })

  return (
    <ScreenLayout
      screen="History"
      panes={panes}
      nav={nav}
      hint="↑↓ select  x delete  X wipe all  r refresh"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /history</Text>
          <Text color="gray" dimColor>  {sessions.length} ended</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 && selected ? (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="#1e2d3e"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── SESSION ───────────────────────────</Text>
            {(Object.entries(selected) as [string, unknown][]).map(([k, v]) => (
              <Box key={k}>
                <Text color="#6e7681" dimColor>{k.padEnd(14)}</Text>
                <Text color="gray" wrap="truncate">{v === null ? 'null' : String(v)}</Text>
              </Box>
            ))}
          </Box>
        ) : undefined
      }
    >
      {sessions.length === 0 ? (
        <Text color="gray" dimColor>no history — sessions appear here after they end</Text>
      ) : (
        groups.map(([dir, groupSessions]) => (
          <Box key={dir} flexDirection="column" marginBottom={0}>
            <Text color="#4a6fa5">{'── ' + dir + ' ' + '─'.repeat(Math.max(0, dashLen - dir.length - 1))}</Text>
            {groupSessions.map(s => {
              const flatIdx = flat.indexOf(s)
              const isSelected = flatIdx === selectedIdx
              const duration = formatDuration(s.created_at, s.ended_at!)
              const endedDate = new Date(s.ended_at!).toLocaleString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
              })
              return (
                <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                  {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                  <Text color={isSelected ? '#7eb8f5' : '#30363d'} bold={isSelected}>{s.id}</Text>
                  <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                  <Text color={isSelected ? 'white' : 'gray'}>  {(s.tag ?? s.name).slice(0, 20).padEnd(20)}</Text>
                  <Text color="#6e7681" dimColor>  {duration.padEnd(8)}</Text>
                  <Text color="#21262d" dimColor>  {endedDate}</Text>
                </Box>
              )
            })}
          </Box>
        ))
      )}

      {wipePending && (
        <Box marginTop={1} borderStyle="round" borderColor="red" paddingLeft={1} paddingRight={1}>
          <Text color="red">wipe all {sessions.length} history entries? </Text>
          <Text color="white" bold>y</Text>
          <Text color="gray">/any other key to cancel</Text>
        </Box>
      )}
    </ScreenLayout>
  )
}
