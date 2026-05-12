// Standalone mini session picker. Arrow keys select, Enter switches tmux client, Esc exits.
// Inputs: registry sessions, $TMUX env. Outputs: tmux switch-client call or exit.
// Invariant: renders only session rows + one status line; no Router dependency.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { execFileSync } from 'node:child_process'
import { listAll as listSessions } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import type { Session } from '../state/types.js'

export function Switch({ onExit }: { onExit: () => void }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [status, setStatus] = useState('')

  useEffect(() => {
    setSessions(listSessions())
  }, [])

  useInput((input, key) => {
    if (key.escape) {
      onExit()
      return
    }
    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(sessions.length - 1, i + 1))
      return
    }
    if (key.return) {
      const session = sessions[selectedIdx]
      if (!session) return
      const target = `${session.tmux_session}:${session.tmux_window}`
      if (process.env.TMUX) {
        try {
          execFileSync('tmux', ['switch-client', '-t', target], { stdio: 'ignore' })
          onExit()
          return
        } catch {
          setStatus(`error: could not switch to ${target}`)
          return
        }
      }
      setStatus(`attach: tmux attach -t ${session.tmux_session} && tmux select-window -t ${target}`)
      return
    }
  })

  if (sessions.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={1}>
        <Text color="gray" dimColor>no sessions — spawn one first</Text>
        <Text color="gray" dimColor>esc to close</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1} paddingY={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>switch session</Text>
        <Text color="gray" dimColor>  ↑↓ select  enter attach  esc close</Text>
      </Box>

      {sessions.map((s, i) => {
        const isSelected = selectedIdx === i
        const label = (s.tag ?? s.name).slice(0, 22)
        return (
          <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
            {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
            <Text color={isSelected ? '#7eb8f5' : 'gray'}>{s.id}</Text>
            <Text color="gray" dimColor>  </Text>
            <Text color={providerColor(s.provider)} bold={isSelected}>{s.provider.padEnd(6)}</Text>
            <Text color={isSelected ? 'white' : 'gray'}>{label.padEnd(22)}</Text>
            <Text color="gray" dimColor>  {formatAge(s.created_at)}</Text>
          </Box>
        )
      })}

      {status && (
        <Box marginTop={1}>
          <Text color="yellow">{status}</Text>
        </Box>
      )}
    </Box>
  )
}
