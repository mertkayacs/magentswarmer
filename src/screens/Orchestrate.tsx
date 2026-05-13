// Fan-out wizard: goal, shared provider config, worker list, orchestrate.
// Inputs: form state (pre-filled from last_orchestrate). Outputs: spawned Session[] on submit.
// Invariant: text fields active on focus (no enter-to-edit); workers need at least 1 entry.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { providerColor } from '../utils/display.js'
import { orchestrate } from '../launcher/orchestrate.js'
import { loadState, addPreset } from '../state/store.js'
import type { Provider, Auth, Effort, Permissions, Session, WorkerEntry, SharedFormState } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini', 'opencode', 'aider', 'hermes']
const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PERMS: Permissions[] = ['ask', 'skip']

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]
}

// Header fields: 0=goal, 1=tag, 2=provider, 3=auth, 4=effort, 5=perms
// After header: 6+2*i=worker[i].name, 7+2*i=worker[i].prompt
// Last: submit button

function headerCount() { return 6 }

export function Orchestrate() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [focusIdx, setFocusIdx] = useState(0)
  const [result, setResult] = useState<Session[] | null>(null)
  const [error, setError] = useState('')
  const [savePanel, setSavePanel] = useState(false)
  const [presetName, setPresetName] = useState('')

  const [lo] = useState(() => loadState().last_orchestrate)
  const [goal, setGoal] = useState(lo.goal)
  const [tag, setTag] = useState(lo.tag)
  const [provider, setProvider] = useState<Provider>(lo.shared.provider)
  const [auth, setAuth] = useState<Auth>(lo.shared.auth)
  const [effort, setEffort] = useState<Effort | null>(lo.shared.effort)
  const [permissions, setPermissions] = useState<Permissions>(lo.shared.permissions)
  const [workers, setWorkers] = useState<WorkerEntry[]>(lo.workers.length > 0 ? lo.workers : [{ name: 'agent-1', prompt: '' }, { name: 'agent-2', prompt: '' }])

  const totalFields = headerCount() + workers.length * 2 + 1
  const submitIdx = totalFields - 1

  function isTextField(idx: number): boolean {
    if (idx === 0 || idx === 1) return true
    if (idx >= headerCount() && idx < submitIdx) return true
    return false
  }

  const fieldFocused = isTextField(focusIdx) || savePanel
  const nav = useScreenNav(push, pop, fieldFocused)
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = nav

  function workerIdx(fieldIdx: number): number {
    return Math.floor((fieldIdx - headerCount()) / 2)
  }

  function workerSubField(fieldIdx: number): 'name' | 'prompt' {
    return (fieldIdx - headerCount()) % 2 === 0 ? 'name' : 'prompt'
  }

  // Save panel text input handler
  useInput((input, key) => {
    if (key.escape) { setSavePanel(false); setPresetName(''); return }
    if (key.return) {
      if (presetName.trim()) {
        const shared: SharedFormState = { provider, auth, model: null, permissions, effort }
        addPreset(presetName, goal, workers, shared)
        setSavePanel(false)
        setPresetName('')
      }
      return
    }
    if (key.backspace || key.delete) { setPresetName(v => v.slice(0, -1)); return }
    if (!key.ctrl && !key.meta) setPresetName(v => v + input)
  }, { isActive: savePanel && !!result })

  // Main form handler — text fields active on focus, no enter-to-edit step
  useInput((input, key) => {
    if (key.tab && result !== null) {
      setSavePanel(v => {
        if (!v) setPresetName(goal.slice(0, 20))
        else setPresetName('')
        return !v
      })
      return
    }
    if (key.tab) { setFocusIdx(i => Math.min(submitIdx, i + 1)); return }

    if (isTextField(focusIdx)) {
      if (key.escape) { pop(); return }
      if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
      if (key.downArrow || key.return) { setFocusIdx(i => Math.min(submitIdx, i + 1)); return }
      if (key.backspace || key.delete) {
        if (focusIdx === 0) { setGoal(v => v.slice(0, -1)); return }
        if (focusIdx === 1) { setTag(v => v.slice(0, -1)); return }
        if (focusIdx >= headerCount() && focusIdx < submitIdx) {
          const wi = workerIdx(focusIdx); const sf = workerSubField(focusIdx)
          setWorkers(ws => ws.map((w, i) => i === wi ? { ...w, [sf]: w[sf].slice(0, -1) } : w))
        }
        return
      }
      if (!key.ctrl && !key.meta && input) {
        if (focusIdx === 0) { setGoal(v => v + input); return }
        if (focusIdx === 1) { setTag(v => v + input); return }
        if (focusIdx >= headerCount() && focusIdx < submitIdx) {
          const wi = workerIdx(focusIdx); const sf = workerSubField(focusIdx)
          setWorkers(ws => ws.map((w, i) => i === wi ? { ...w, [sf]: w[sf] + input } : w))
        }
        return
      }
      return
    }

    // Select / submit / worker add/remove
    if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
    if (key.downArrow) { setFocusIdx(i => Math.min(submitIdx, i + 1)); return }
    if (key.leftArrow) {
      if (focusIdx === 2) setProvider(p => cycle(PROVIDERS, p, -1))
      else if (focusIdx === 3) setAuth(a => cycle(AUTHS, a, -1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, -1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, -1))
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 2) setProvider(p => cycle(PROVIDERS, p, 1))
      else if (focusIdx === 3) setAuth(a => cycle(AUTHS, a, 1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, 1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, 1))
      return
    }
    if (input === 'a' && !result) {
      const n = workers.length + 1
      setWorkers(ws => [...ws, { name: `agent-${n}`, prompt: '' }])
      return
    }
    if (input === 'x' && !result && workers.length > 1) {
      setWorkers(ws => ws.slice(0, -1))
      setFocusIdx(i => Math.min(i, headerCount() + (workers.length - 2) * 2 + 1))
      return
    }
    if (key.return && focusIdx === submitIdx) {
      if (!goal.trim()) { setError('goal is required'); return }
      if (workers.some(w => !w.prompt.trim())) { setError('all workers need a prompt'); return }
      setError('')
      try {
        const sessions = orchestrate(goal, tag || 'orchestrate', { provider, auth, model: null, permissions, effort }, workers)
        setResult(sessions)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'orchestrate failed')
      }
    }
  }, { isActive: !savePanel && !cmdMode })

  function rowColor(idx: number) { return focusIdx === idx ? '#5a96e0' : 'gray' }
  function marker(idx: number) { return focusIdx === idx ? '>' : ' ' }

  function textRow(idx: number, label: string, value: string, placeholder: string) {
    const focused = focusIdx === idx
    const display = value.length > 55 ? '…' + value.slice(-54) : value
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {focused
          ? <Text>{display}<Text color="#5a96e0">█</Text></Text>
          : <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || placeholder}</Text>
        }
      </Box>
    )
  }

  function selectRow(idx: number, label: string, value: string | null, colorFn?: (_v: string | null) => string, labelFn?: (_v: string | null) => string) {
    const focused = focusIdx === idx
    const displayVal = labelFn ? labelFn(value) : (value ?? '—')
    const displayColor = colorFn ? colorFn(value) : '#7eb8f5'
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {focused && <Text color="gray" dimColor>{'← '}</Text>}
        <Text color={displayColor} bold={focused}>{displayVal}</Text>
        {focused && <Text color="gray" dimColor>{' →'}</Text>}
      </Box>
    )
  }

  if (result) {
    return (
      <ScreenLayout
        screen="Orchestrate"
        panes={panes}
        nav={nav}
        hint="l sessions  t top  tab save preset  esc back"
        header={
          <Box>
            <Text color="#5a96e0" bold>REEVES AGENTS</Text>
            <Text color="#4a6fa5">  /orchestrate · result</Text>
          </Box>
        }
      >
        {result.map(s => (
          <React.Fragment key={s.id}>
            <Box>
              <Text color="#7eb8f5">{s.id}</Text>
              <Text color="gray" dimColor>  {s.name}  </Text>
              <Text color={providerColor(s.provider)}>{s.provider}</Text>
            </Box>
            <Box>
              <Text color="gray" dimColor>  tmux switch-client -t {s.tmux_session}:{s.tmux_window}</Text>
            </Box>
          </React.Fragment>
        ))}

        {!savePanel ? (
          <Box marginTop={1}>
            <Text color="gray" dimColor>l sessions  t top  tab save preset  esc back</Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="#5a96e0" paddingX={1}>
            <Text color="#5a96e0" bold>SAVE AS PRESET</Text>
            <Box>
              <Text color="gray">name  </Text>
              <Text>{presetName}<Text color="#5a96e0">█</Text></Text>
            </Box>
            <Text color="gray" dimColor>enter to save  esc to cancel</Text>
          </Box>
        )}
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout
      screen="Orchestrate"
      panes={panes}
      nav={nav}
      hint="tab/↑↓ navigate  ← → select  enter edit  a add worker  x remove"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /orchestrate · fan out multiple agents</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 ? (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── AGENT {Math.floor((focusIdx - headerCount()) / 2) + 1} ───────────────────────</Text>
            <Text color="gray" dimColor>name + prompt define this agent's task</Text>
          </Box>
        ) : undefined
      }
    >
      <Box flexDirection="column" marginBottom={1}>
        {textRow(0, 'goal', goal, '(required) what is the overall objective?')}
        {textRow(1, 'tag', tag, '(optional) e.g. feature-branch')}
        {selectRow(2, 'provider', provider, p => p ? providerColor(p as Provider) : 'gray')}
        {selectRow(3, 'auth', auth)}
        {selectRow(4, 'effort', effort, undefined, v => v ?? '—')}
        {selectRow(5, 'permissions', permissions)}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>WORKERS ({workers.length})  a add  x remove last</Text>
        {workers.map((w, i) => {
          const nameIdx = headerCount() + i * 2
          const promptIdx = headerCount() + i * 2 + 1
          return (
            <Box key={i} flexDirection="column">
              <Text color="gray" dimColor>  worker {i + 1}</Text>
              {textRow(nameIdx, '    name', w.name, `agent-${i + 1}`)}
              {textRow(promptIdx, '    prompt', w.prompt, '(required) what should this worker do?')}
            </Box>
          )
        })}
      </Box>

      {error && <Text color="red">{error}</Text>}

      <Box>
        <Text color={focusIdx === submitIdx ? '#5a96e0' : 'gray'} bold={focusIdx === submitIdx}>
          {marker(submitIdx)} [orchestrate {workers.length} workers]
        </Text>
      </Box>
    </ScreenLayout>
  )
}
