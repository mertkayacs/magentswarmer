// Global config and CLI MCP registration.
// Inputs: loadConfig() on mount, registerAll() on demand.
// Outputs: saveConfig() on submit.
// Invariant: registration is non-destructive and safe to re-run.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { loadConfig, saveConfig } from '../state/config.js'
import { registerAll } from '../mcp-setup.js'
import type { CliRegistration } from '../mcp-setup.js'
import type { Permissions } from '../state/types.js'

const PEEK_INTERVALS = [1000, 3000, 5000, 10000]
const PEEK_LINES = [5, 10, 20, 50]
const MAX_DEPTHS = [3, 5, 8, 10]
const MAX_AGENTS_OPTS = [5, 10, 20]
const PERMS: Permissions[] = ['ask', 'skip']

// 0=register 1=peek_interval_ms 2=peek_lines 3=max_depth 4=max_agents 5=default_permissions 6=[SAVE]
const TOTAL_FIELDS = 7

function cycleArr<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  const i = idx === -1 ? 0 : idx
  return arr[(i + dir + arr.length) % arr.length]!
}

export function Settings() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [focusIdx, setFocusIdx] = useState(0)
  const [config, setConfig] = useState(() => loadConfig())
  const [saveMsg, setSaveMsg] = useState('')
  const [registrations, setRegistrations] = useState<CliRegistration[] | null>(null)
  const [registering, setRegistering] = useState(false)

  const nav = useScreenNav(push, pop, false)
  const { cmdMode } = nav

  useInput((input, key) => {
    if (cmdMode) return
    if (key.tab || key.downArrow) { setFocusIdx(i => Math.min(TOTAL_FIELDS - 1, i + 1)); return }
    if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
    if (key.escape) { pop(); return }

    const dir: 1 | -1 = key.leftArrow ? -1 : 1
    if (key.leftArrow || key.rightArrow) {
      if (focusIdx === 1) setConfig(c => ({ ...c, global: { ...c.global, peek_interval_ms: cycleArr(PEEK_INTERVALS, c.global.peek_interval_ms, dir) } }))
      else if (focusIdx === 2) setConfig(c => ({ ...c, global: { ...c.global, peek_lines: cycleArr(PEEK_LINES, c.global.peek_lines, dir) } }))
      else if (focusIdx === 3) setConfig(c => ({ ...c, global: { ...c.global, max_depth: cycleArr(MAX_DEPTHS, c.global.max_depth, dir) } }))
      else if (focusIdx === 4) setConfig(c => ({ ...c, global: { ...c.global, max_agents: cycleArr(MAX_AGENTS_OPTS, c.global.max_agents, dir) } }))
      else if (focusIdx === 5) setConfig(c => ({ ...c, global: { ...c.global, default_permissions: cycleArr(PERMS, c.global.default_permissions, dir) } }))
      return
    }

    if (key.return) {
      if (focusIdx === 0) {
        setRegistering(true)
        const results = registerAll()
        setRegistrations(results)
        setRegistering(false)
        return
      }
      if (focusIdx === TOTAL_FIELDS - 1) {
        saveConfig(config)
        setSaveMsg('saved')
        setTimeout(() => setSaveMsg(''), 2000)
      }
    }
  }, { isActive: !cmdMode })

  const rowColor = (idx: number) => focusIdx === idx ? '#5a96e0' : 'gray'
  const marker = (idx: number) => focusIdx === idx ? '>' : ' '
  const g = config.global

  function selectRow(idx: number, label: string, value: string | number) {
    const focused = focusIdx === idx
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(24)}</Text>
        {focused && <Text color="gray" dimColor>{'← '}</Text>}
        <Text color="#7eb8f5" bold={focused}>{String(value)}</Text>
        {focused && <Text color="gray" dimColor>{' →'}</Text>}
      </Box>
    )
  }

  return (
    <ScreenLayout
      screen="Settings"
      panes={panes}
      nav={nav}
      hint="↑↓/tab navigate  ← → adjust  enter to act  esc back"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /settings</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 && registrations ? (
          <Box flexDirection="column" width={42} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingX={1}>
            <Text color="#4a6fa5">── CLI REGISTRATION ─────────────</Text>
            {registrations.map(r => (
              <Box key={r.cli}>
                <Text color={r.registered ? 'green' : r.detected ? 'yellow' : 'gray'}>
                  {r.registered ? '✓' : r.detected ? '!' : '—'}
                </Text>
                <Text color="gray">  {r.cli.padEnd(14)}</Text>
                <Text color={r.registered ? 'green' : 'gray'} dimColor={!r.registered}>
                  {r.registered ? 'registered' : (r.note ?? 'not found')}
                </Text>
              </Box>
            ))}
          </Box>
        ) : undefined
      }
    >
      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>── CLI REGISTRATION ────────────</Text>
        <Box>
          <Text color={rowColor(0)} bold={focusIdx === 0}>{marker(0)} </Text>
          <Text color={focusIdx === 0 ? '#5a96e0' : 'gray'} bold={focusIdx === 0}>
            {registering ? 'detecting...' : '[ DETECT + REGISTER CLIs ]'}
          </Text>
          <Text color="gray" dimColor>  (enter)</Text>
        </Box>
        {registrations && registrations.map(r => (
          <Box key={r.cli} paddingLeft={3}>
            <Text color={r.registered ? 'green' : r.detected ? 'yellow' : 'gray'}>
              {r.registered ? '✓' : r.detected ? '!' : '—'}
            </Text>
            <Text color="gray">  {r.cli.padEnd(14)}</Text>
            <Text color={r.registered ? 'green' : 'gray'} dimColor={!r.registered}>
              {r.registered ? 'registered' : (r.note ?? 'not found')}
            </Text>
          </Box>
        ))}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>── GLOBAL CONFIG ───────────────</Text>
        {selectRow(1, 'peek interval (ms)', g.peek_interval_ms)}
        {selectRow(2, 'peek lines', g.peek_lines)}
        {selectRow(3, 'max depth', g.max_depth)}
        {selectRow(4, 'max agents', g.max_agents)}
        {selectRow(5, 'default permissions', g.default_permissions)}
      </Box>

      <Box marginTop={1}>
        <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
          {marker(TOTAL_FIELDS - 1)} [ SAVE CONFIG ]
        </Text>
      </Box>

      {saveMsg && <Text color="green">{saveMsg}</Text>}
    </ScreenLayout>
  )
}
