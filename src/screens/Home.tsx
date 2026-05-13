// Main hub: gradient header, provider dots, sessions grouped by working_dir, shortcuts.
// Inputs: SessionContext (sessions, presets, recentSessions). Outputs: dashboard.
// Invariant: providers checked on mount only; session/preset state comes from context.

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import chalk from 'chalk'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { useSessionState } from '../state/SessionContext.js'
import { detectAvailable } from '../launcher/providers.js'
import { orchestrate } from '../launcher/orchestrate.js'
import { removePreset } from '../state/store.js'
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
  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav
  const { sessions, presets, recentSessions, refresh } = useSessionState()
  const [providers, setProviders] = useState<Record<Provider, boolean>>({ cc: false, codex: false, gemini: false })
  const [presetIdx, setPresetIdx] = useState<number | null>(null)

  useEffect(() => {
    setProviders(detectAvailable())
  }, [])

  const titleStr = useMemo(() => {
    const chars = gradientChars('REEVES AGENTS', GRADIENT_STOPS, 'horizontal')[0] ?? []
    return chars.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
  }, [])

  const groups = groupByDir(sessions)
  const recentSession = recentSessions[0] ?? null
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  useInput((input, key) => {
    if (cmdMode) return
    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'l') { push('Sessions'); return }
    if (input === 't') { push('Top'); return }
    if (input === 'd') { push('Doctor'); return }
    if (input === 'h' || input === '?') { push('Help'); return }

    if (presets.length > 0) {
      if (key.upArrow) {
        setPresetIdx(i => i === null ? 0 : Math.max(0, i - 1))
        return
      }
      if (key.downArrow) {
        setPresetIdx(i => i === null ? 0 : Math.min(presets.length - 1, i + 1))
        return
      }
    }

    const presetNum = parseInt(input, 10)
    if (!isNaN(presetNum) && presetNum >= 1 && presetNum <= 9 && presets[presetNum - 1]) {
      const preset = presets[presetNum - 1]
      const tag = `${preset.name}-${Date.now().toString(36)}`
      try {
        orchestrate(preset.goal, tag, preset.shared, preset.workers)
        refresh()
        push('Sessions')
      } catch { /* orchestrate failed */ }
      return
    }

    if (input === 'D' && presetIdx !== null && presets[presetIdx]) {
      removePreset(presets[presetIdx].name)
      refresh()
      setPresetIdx(null)
      return
    }

    if (key.escape && presetIdx !== null) { setPresetIdx(null); return }

    if (input === 'r') {
      setProviders(detectAvailable())
      refresh()
    }
  }, { isActive: !cmdMode })

  return (
    <ScreenLayout
      screen="Home"
      panes={panes}
      nav={nav}
      hint={presets.length > 0 ? '↑↓ select preset  1–9 run  D delete  ? help' : 'type a command, ? for help'}
      header={
        <Box flexDirection="column">
          <Box>
            <Text>{titleStr}</Text>
            <Text color="gray" dimColor>  </Text>
            {(['cc', 'codex', 'gemini'] as Provider[]).map(p => (
              <Text key={p} color={providers[p] ? providerColor(p) : '#30363d'}>
                {providers[p] ? '●' : '○'}{p}{'  '}
              </Text>
            ))}
            <Text color="gray" dimColor>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
          </Box>
          {recentSession && (
            <Box>
              <Text color="gray" dimColor>  </Text>
              <Text color="gray" dimColor>{recentSession.id}</Text>
              <Text color="gray" dimColor>  •  </Text>
              <Text color={providerColor(recentSession.provider)}>●</Text>
              <Text color="gray" dimColor>  {(recentSession.tag ?? recentSession.name).slice(0, 24)}</Text>
            </Box>
          )}
        </Box>
      }
      rightPanel={
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
      }
    >
      <Text color="#4a6fa5">{'── SESSIONS ' + '─'.repeat(dashLen)}</Text>
      {sessions.length === 0 ? (
        <Text color="gray" dimColor>  no sessions running  s spawn  o orchestrate</Text>
      ) : (
        groups.map(([dir, groupSessions]) => (
          <Box key={dir} flexDirection="column">
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

      {presets.length > 0 && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="#4a6fa5">{'── PRESETS ' + '─'.repeat(Math.max(0, dashLen + 1))}</Text>
          {presets.slice(0, 9).map((p, i) => (
            <Box key={p.name}>
              <Text color={presetIdx === i ? '#5a96e0' : '#7eb8f5'}>  {i + 1}</Text>
              <Text color={presetIdx === i ? '#7eb8f5' : 'gray'} dimColor={presetIdx !== i}>  {p.name.padEnd(20)}</Text>
              <Text color="gray" dimColor>{p.workers.length} workers</Text>
            </Box>
          ))}
          {presets.length > 9 && <Text color="gray" dimColor>  +{presets.length - 9} more</Text>}
        </Box>
      )}

      <Box marginTop={1}>
        <Text color="#4a6fa5">{'── SHORTCUTS ' + '─'.repeat(Math.max(0, dashLen - 1))}</Text>
      </Box>
      <Box>
        <Text color="#7eb8f5">s</Text><Text color="gray"> spawn  </Text>
        <Text color="#7eb8f5">o</Text><Text color="gray"> orchestrate  </Text>
        <Text color="#7eb8f5">l</Text><Text color="gray"> sessions  </Text>
        <Text color="#7eb8f5">t</Text><Text color="gray"> top  </Text>
        <Text color="#7eb8f5">d</Text><Text color="gray"> doctor  </Text>
        <Text color="#7eb8f5">?</Text><Text color="gray"> help  </Text>
        <Text color="#7eb8f5">r</Text><Text color="gray"> refresh</Text>
      </Box>
    </ScreenLayout>
  )
}
