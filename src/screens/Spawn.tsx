// Spawn a single agent session. Form with provider/auth/task/effort/permissions/model/tag.
// Inputs: form state. Outputs: Session on submit, shown inline with session ID.
// Invariant: useScreenNav disabled while a text field is being edited.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { StatusBar } from '../components/StatusBar.js'
import { FieldHint } from '../components/FieldHint.js'
import { spawn } from '../launcher/spawn.js'
import { loadConfig } from '../state/config.js'
import type { Provider, Auth, Effort, Permissions, Session } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini']
const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PERMS: Permissions[] = ['ask', 'skip']

// Field indices: 0=provider, 1=auth, 2=task, 3=effort, 4=perms, 5=model, 6=tag, 7=submit
const TOTAL_FIELDS = 8
const TEXT_FIELDS = [2, 5, 6]

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]
}

function effortLabel(e: string | null): string {
  return e ?? '—'
}

export function Spawn() {
  const { push, pop } = useRouter()
  const [focusIdx, setFocusIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState<Session | null>(null)
  const [error, setError] = useState('')

  const cfg = loadConfig()
  const [provider, setProvider] = useState<Provider>('cc')
  const [auth, setAuth] = useState<Auth>(cfg.providers.cc.auth)
  const [task, setTask] = useState('')
  const [effort, setEffort] = useState<Effort | null>(cfg.providers.cc.default_effort)
  const [permissions, setPermissions] = useState<Permissions>(cfg.providers.cc.default_permissions)
  const [model, setModel] = useState('')
  const [tag, setTag] = useState('')

  const isTextField = TEXT_FIELDS.includes(focusIdx)
  const fieldFocused = editing && isTextField
  const { cmdMode, cmdValue, cmdError } = useScreenNav(push, pop, fieldFocused)

  // Text input handler
  useInput((input, key) => {
    if (key.escape || key.return) {
      setEditing(false)
      if (key.return && focusIdx < TOTAL_FIELDS - 1) setFocusIdx(i => i + 1)
      return
    }
    if (key.backspace || key.delete) {
      if (focusIdx === 2) setTask(v => v.slice(0, -1))
      else if (focusIdx === 5) setModel(v => v.slice(0, -1))
      else if (focusIdx === 6) setTag(v => v.slice(0, -1))
      return
    }
    if (!key.ctrl && !key.meta) {
      if (focusIdx === 2) setTask(v => v + input)
      else if (focusIdx === 5) setModel(v => v + input)
      else if (focusIdx === 6) setTag(v => v + input)
    }
  }, { isActive: fieldFocused })

  // Navigation handler
  useInput((input, key) => {
    void input
    if (key.tab || key.downArrow) { setFocusIdx(i => Math.min(TOTAL_FIELDS - 1, i + 1)); return }
    if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
    if (key.leftArrow) {
      if (focusIdx === 0) setProvider(p => cycle(PROVIDERS, p, -1))
      else if (focusIdx === 1) setAuth(a => cycle(AUTHS, a, -1))
      else if (focusIdx === 3) setEffort(e => cycle(EFFORTS, e, -1))
      else if (focusIdx === 4) setPermissions(p => cycle(PERMS, p, -1))
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 0) setProvider(p => cycle(PROVIDERS, p, 1))
      else if (focusIdx === 1) setAuth(a => cycle(AUTHS, a, 1))
      else if (focusIdx === 3) setEffort(e => cycle(EFFORTS, e, 1))
      else if (focusIdx === 4) setPermissions(p => cycle(PERMS, p, 1))
      return
    }
    if (key.return) {
      if (isTextField) { setEditing(true); return }
      if (focusIdx === TOTAL_FIELDS - 1) {
        if (!task.trim()) { setError('task is required'); return }
        setError('')
        try {
          const session = spawn({
            provider,
            auth,
            model: model || undefined,
            permissions,
            effort,
            tag: tag || undefined,
            start_prompt: task,
          })
          setResult(session)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'spawn failed')
        }
      }
    }
  }, { isActive: !fieldFocused && !cmdMode })

  // After successful spawn, auto-update auth when provider changes
  const handleProviderChange = (p: Provider) => {
    setProvider(p)
    const pc = cfg.providers[p]
    setAuth(pc.auth)
    setEffort(pc.default_effort)
    setPermissions(pc.default_permissions)
  }

  function rowColor(idx: number) { return focusIdx === idx ? '#5a96e0' : 'gray' }
  function marker(idx: number) { return focusIdx === idx ? '>' : ' ' }

  function selectRow(idx: number, label: string, options: (string | null)[], value: string | null, labelFn = (v: string | null) => v ?? '—') {
    const focused = focusIdx === idx
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {options.map((opt, i) => (
          <React.Fragment key={String(opt)}>
            {i > 0 && <Text color="gray"> </Text>}
            <Text color={value === opt ? '#7eb8f5' : 'gray'} bold={value === opt}>{labelFn(opt)}</Text>
          </React.Fragment>
        ))}
        {focused && <Text color="gray" dimColor>  ← →</Text>}
      </Box>
    )
  }

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

  if (result) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>spawned</Text>
        </Box>
        <Box><Text color="gray" dimColor>id        </Text><Text color="#7eb8f5">{result.id}</Text></Box>
        <Box><Text color="gray" dimColor>name      </Text><Text>{result.name}</Text></Box>
        <Box><Text color="gray" dimColor>provider  </Text><Text>{result.provider}</Text></Box>
        <Box><Text color="gray" dimColor>window    </Text><Text color="gray">{result.tmux_session}:{result.tmux_window}</Text></Box>
        {result.tag && <Box><Text color="gray" dimColor>tag       </Text><Text>{result.tag}</Text></Box>}
        <Box marginTop={1}>
          <Text color="gray" dimColor>press l to view sessions, esc to go back</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
            <Text color="gray">/ </Text>
            <Text>{cmdMode ? cmdValue : ''}</Text>
            {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
          </Box>
        </Box>
        <StatusBar screen="spawn" />
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>spawn</Text>
        <Text color="gray" dimColor>  tab/↑↓ navigate  ← → select  enter edit/submit</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        {selectRow(0, 'provider', PROVIDERS, provider, v => v ?? '—')}
        {selectRow(1, 'auth', AUTHS, auth)}
        {textRow(2, 'task', task, '(required) what should the agent do?')}
        {selectRow(3, 'effort', EFFORTS, effort, effortLabel)}
        {selectRow(4, 'permissions', PERMS, permissions)}
        {textRow(5, 'model', model, '(optional) leave blank for default')}
        {textRow(6, 'tag', tag, '(optional) e.g. feature-branch')}
      </Box>

      {error && <Text color="red">{error}</Text>}

      <Box>
        <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
          {marker(TOTAL_FIELDS - 1)} [spawn]
        </Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>

      <StatusBar screen="spawn" />
    </Box>
  )
}
