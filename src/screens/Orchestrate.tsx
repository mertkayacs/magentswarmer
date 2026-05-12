// Fan-out wizard: goal, shared provider config, worker list, orchestrate.
// Inputs: form state. Outputs: spawned Session[] on submit, shown inline.
// Invariant: useScreenNav disabled while editing; workers need at least 1 entry.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { FieldHint } from '../components/FieldHint.js'
import { orchestrate } from '../launcher/orchestrate.js'
import { loadState, addPreset } from '../state/store.js'
import type { Provider, Auth, Effort, Permissions, Session, WorkerEntry, SharedFormState } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini']
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
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState<Session[] | null>(null)
  const [error, setError] = useState('')
  const [savePanel, setSavePanel] = useState(false)
  const [presetName, setPresetName] = useState('')

  const lo = loadState().last_orchestrate
  const [goal, setGoal] = useState(lo.goal)
  const [tag, setTag] = useState(lo.tag)
  const [provider, setProvider] = useState<Provider>(lo.shared.provider)
  const [auth, setAuth] = useState<Auth>(lo.shared.auth)
  const [effort, setEffort] = useState<Effort | null>(lo.shared.effort)
  const [permissions, setPermissions] = useState<Permissions>(lo.shared.permissions)
  const [workers, setWorkers] = useState<WorkerEntry[]>(lo.workers.length > 0 ? lo.workers : [{ name: 'agent-1', prompt: '' }, { name: 'agent-2', prompt: '' }])

  const totalFields = headerCount() + workers.length * 2 + 1 // +1 for submit
  const submitIdx = totalFields - 1

  // A field is a text field if: goal(0), tag(1), or any worker name/prompt
  function isTextField(idx: number): boolean {
    if (idx === 0 || idx === 1) return true
    if (idx >= headerCount() && idx < submitIdx) return true
    return false
  }

  const fieldFocused = (editing && isTextField(focusIdx)) || savePanel
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)

  function workerIdx(fieldIdx: number): number {
    return Math.floor((fieldIdx - headerCount()) / 2)
  }

  function workerSubField(fieldIdx: number): 'name' | 'prompt' {
    return (fieldIdx - headerCount()) % 2 === 0 ? 'name' : 'prompt'
  }

  // Save panel text input handler
  useInput((input, key) => {
    if (key.escape) {
      setSavePanel(false)
      setPresetName('')
      return
    }
    if (key.return) {
      if (presetName.trim()) {
        const shared: SharedFormState = { provider, auth, model: null, permissions, effort }
        addPreset(presetName, goal, workers, shared)
        setSavePanel(false)
        setPresetName('')
      }
      return
    }
    if (key.backspace || key.delete) {
      setPresetName(v => v.slice(0, -1))
      return
    }
    if (!key.ctrl && !key.meta) {
      setPresetName(v => v + input)
    }
  }, { isActive: savePanel && !!result })

  // Text input handler
  useInput((input, key) => {
    if (key.escape || key.return) {
      setEditing(false)
      if (key.return && focusIdx < submitIdx) setFocusIdx(i => i + 1)
      return
    }
    if (key.backspace || key.delete) {
      if (focusIdx === 0) { setGoal(v => v.slice(0, -1)); return }
      if (focusIdx === 1) { setTag(v => v.slice(0, -1)); return }
      if (focusIdx >= headerCount() && focusIdx < submitIdx) {
        const wi = workerIdx(focusIdx)
        const sf = workerSubField(focusIdx)
        setWorkers(ws => ws.map((w, i) => i === wi ? { ...w, [sf]: w[sf].slice(0, -1) } : w))
        return
      }
      return
    }
    if (!key.ctrl && !key.meta) {
      if (focusIdx === 0) { setGoal(v => v + input); return }
      if (focusIdx === 1) { setTag(v => v + input); return }
      if (focusIdx >= headerCount() && focusIdx < submitIdx) {
        const wi = workerIdx(focusIdx)
        const sf = workerSubField(focusIdx)
        setWorkers(ws => ws.map((w, i) => i === wi ? { ...w, [sf]: w[sf] + input } : w))
      }
    }
  }, { isActive: fieldFocused })

  // Navigation handler
  useInput((input, key) => {
    if (key.tab && result !== null) {
      if (!savePanel) {
        setSavePanel(true)
        setPresetName(goal.slice(0, 20))
      } else {
        setSavePanel(false)
        setPresetName('')
      }
      return
    }
    if (key.tab || key.downArrow) { setFocusIdx(i => Math.min(submitIdx, i + 1)); return }
    if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
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
    if (input === 'a') {
      const n = workers.length + 1
      setWorkers(ws => [...ws, { name: `agent-${n}`, prompt: '' }])
      return
    }
    if (input === 'x' && workers.length > 1) {
      setWorkers(ws => ws.slice(0, -1))
      setFocusIdx(i => Math.min(i, headerCount() + (workers.length - 2) * 2 + 1))
      return
    }
    if (key.return) {
      if (isTextField(focusIdx)) { setEditing(true); return }
      if (focusIdx === submitIdx) {
        if (!goal.trim()) { setError('goal is required'); return }
        if (workers.some(w => !w.prompt.trim())) { setError('all workers need a prompt'); return }
        setError('')
        try {
          const sessions = orchestrate(goal, tag || 'orchestrate', {
            provider,
            auth,
            model: null,
            permissions,
            effort,
          }, workers)
          setResult(sessions)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'orchestrate failed')
        }
      }
    }
  }, { isActive: !fieldFocused && !cmdMode })

  function rowColor(idx: number) { return focusIdx === idx ? '#5a96e0' : 'gray' }
  function marker(idx: number) { return focusIdx === idx ? '>' : ' ' }

  function textRow(idx: number, label: string, value: string, placeholder: string) {
    const focused = focusIdx === idx
    const active = focused && editing
    return (
      <Box flexDirection="column">
        <Box>
          <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
          {active ? (
            <Text>{value}<Text color="#5a96e0">█</Text></Text>
          ) : (
            <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || placeholder}</Text>
          )}
        </Box>
        {focused && !active && <FieldHint text="press enter to edit" />}
      </Box>
    )
  }

  function selectRow(idx: number, label: string, options: (string | null)[], value: string | null) {
    const focused = focusIdx === idx
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {options.map((opt, i) => (
          <React.Fragment key={String(opt)}>
            {i > 0 && <Text color="gray"> </Text>}
            <Text color={value === opt ? '#7eb8f5' : 'gray'} bold={value === opt}>{opt ?? '—'}</Text>
          </React.Fragment>
        ))}
        {focused && <Text color="gray" dimColor>  ← →</Text>}
      </Box>
    )
  }

  if (result) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /orchestrate · result</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          {result.map(s => (
            <Box key={s.id}>
              <Text color="#7eb8f5">{s.id}</Text>
              <Text color="gray" dimColor>  {s.name}  </Text>
              <Text color="gray">{s.tmux_session}:{s.tmux_window}</Text>
            </Box>
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
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>
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

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /orchestrate · fan out multiple agents</Text>
      </Box>

      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column" marginBottom={1}>
            {textRow(0, 'goal', goal, '(required) what is the overall objective?')}
            {textRow(1, 'tag', tag, '(optional) e.g. feature-branch')}
            {selectRow(2, 'provider', PROVIDERS, provider)}
            {selectRow(3, 'auth', AUTHS, auth)}
            {selectRow(4, 'effort', EFFORTS, effort)}
            {selectRow(5, 'permissions', PERMS, permissions)}
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

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="gray" bold>AGENT {Math.floor((focusIdx - headerCount()) / 2) + 1}</Text>
            <Text color="gray" dimColor>name + prompt define</Text>
            <Text color="gray" dimColor>this agent's task</Text>
          </Box>
        )}
      </Box>

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
