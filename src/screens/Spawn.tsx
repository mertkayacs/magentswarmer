// Spawn a single agent. Form: working_dir/provider/task/permissions/model/nickname/rc_enabled.
// Inputs: form defaults. Outputs: Session on submit.
// Invariant: text fields always active on focus; useScreenNav disabled during text input.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { spawn } from '../launcher/spawn.js'
import { jumpToSession } from '../launcher/jump.js'
import { loadLastSpawn, saveLastSpawn } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import { PROVIDERS } from '../launcher/providers.js'
import type { Provider, Permissions, AuthMode, Effort, Session } from '../state/types.js'

const PERMS: Permissions[] = ['ask', 'skip']
const AUTH_MODES: AuthMode[] = ['default', 'api-key']
const EFFORTS: Effort[] = ['default', 'low', 'medium', 'high', 'xhigh', 'max']
const RC_PROVIDERS = new Set<Provider>(['cc', 'codex'])
const EFFORT_PROVIDERS = new Set<Provider>(['cc'])
const AUTH_PROVIDERS = new Set<Provider>(['cc'])

// 0=working_dir 1=provider 2=task 3=permissions 4=auth 5=effort 6=model 7=nickname 8=rc_enabled 9=submit
const TOTAL_FIELDS = 10
const TEXT_FIELDS = new Set([0, 2, 6, 7])

const FIELD_HELP: Record<number, { label: string; text: string }> = {
  0: { label: 'working dir', text: 'directory the agent starts in — defaults to current directory' },
  1: { label: 'provider',    text: 'cc=Claude Code  codex=OpenAI Codex  gemini=Gemini CLI  hermes=Hermes' },
  2: { label: 'task',        text: 'what should the agent do? leave blank for interactive session' },
  3: { label: 'permissions', text: 'skip = acts without asking (dangerously-skip-permissions)\nask = agent confirms each tool call' },
  4: { label: 'auth',        text: 'api-key maps to Claude Code --bare; other providers use their own default auth' },
  5: { label: 'effort',      text: 'Claude Code supports low, medium, high, xhigh, and max' },
  6: { label: 'model',       text: 'leave blank for provider default, for example claude-opus-4-5' },
  7: { label: 'nickname',    text: 'short label shown in tree view and tmux session name' },
  8: { label: 'remote ctrl', text: 'inject /remote-control (CC) or --enable remote_control (Codex) at startup' },
  9: { label: 'launch',      text: 'press enter to spawn the agent in a new tmux session' },
}

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]!
}

export function Spawn() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [focusIdx, setFocusIdx] = useState(0)
  const [result, setResult] = useState<Session | null>(null)
  const [error, setError] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [cursor, setCursor] = useState(0)

  const lastSpawn = loadLastSpawn()
  const [workingDir, setWorkingDir] = useState(lastSpawn.working_dir || process.cwd())
  const [provider, setProvider] = useState<Provider>(lastSpawn.provider)
  const [task, setTask] = useState(lastSpawn.task)
  const [permissions, setPermissions] = useState<Permissions>(lastSpawn.permissions)
  const [authMode, setAuthMode] = useState<AuthMode>(lastSpawn.auth_mode)
  const [effort, setEffort] = useState<Effort>(lastSpawn.effort)
  const [model, setModel] = useState(lastSpawn.model)
  const [nickname, setNickname] = useState(lastSpawn.nickname)
  const [rcEnabled, setRcEnabled] = useState(lastSpawn.rc_enabled)

  const isTextField = TEXT_FIELDS.has(focusIdx)
  const nav = useScreenNav(push, pop, isTextField)
  const { cmdMode } = nav

  function getVal(idx: number): string {
    if (idx === 0) return workingDir
    if (idx === 2) return task
    if (idx === 6) return model
    if (idx === 7) return nickname
    return ''
  }

  function setVal(idx: number, updater: (_prev: string) => string) {
    if (idx === 0) setWorkingDir(updater)
    else if (idx === 2) setTask(updater)
    else if (idx === 6) setModel(updater)
    else if (idx === 7) setNickname(updater)
  }

  function moveFocus(newIdx: number) {
    setFocusIdx(newIdx)
    if (TEXT_FIELDS.has(newIdx)) setCursor(getVal(newIdx).length)
  }

  function renderCursor(value: string, cur: number): React.ReactNode {
    const MAX = 53
    if (value.length <= MAX) {
      return <Text>{value.slice(0, cur)}<Text color="#5a96e0">█</Text>{value.slice(cur)}</Text>
    }
    const half = Math.floor(MAX / 2)
    const start = Math.max(0, Math.min(cur - half, value.length - MAX))
    const end = start + MAX
    const view = value.slice(start, end)
    const civ = cur - start
    return (
      <Text>
        {start > 0 ? '…' : ''}{view.slice(0, civ)}<Text color="#5a96e0">█</Text>{view.slice(civ)}{end < value.length ? '…' : ''}
      </Text>
    )
  }

  useInput((input, _key) => {
    if (!result || cmdMode) return
    if (input === 'a') {
      try {
        const jump = jumpToSession(result)
        if (!jump.inside_tmux) setError(jump.attach_command)
      } catch {
        setError('tmux jump failed')
        setTimeout(() => setError(''), 5000)
      }
      return
    }
    if (input === 'h') push('TreeNavigator')
  }, { isActive: !!result && !cmdMode })

  useInput((input, key) => {
    if (result) return
    if (key.tab) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }

    if (isTextField) {
      if (key.escape) { pop(); return }
      if (key.upArrow) { moveFocus(Math.max(0, focusIdx - 1)); return }
      if (key.downArrow || key.return) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }
      if (key.leftArrow) { setCursor(c => Math.max(0, c - 1)); return }
      if (key.rightArrow) { setCursor(c => Math.min(getVal(focusIdx).length, c + 1)); return }
      if (key.ctrl && input === 'a') { setCursor(0); return }
      if (key.ctrl && input === 'e') { setCursor(getVal(focusIdx).length); return }
      if (key.backspace) {
        if (cursor === 0) return
        setVal(focusIdx, v => v.slice(0, cursor - 1) + v.slice(cursor))
        setCursor(c => c - 1)
        return
      }
      if (key.delete) {
        const v = getVal(focusIdx)
        if (cursor >= v.length) return
        setVal(focusIdx, prev => prev.slice(0, cursor) + prev.slice(cursor + 1))
        return
      }
      if (!key.ctrl && !key.meta && input) {
        setVal(focusIdx, v => v.slice(0, cursor) + input + v.slice(cursor))
        setCursor(c => c + 1)
      }
      return
    }

    if (key.upArrow) { moveFocus(Math.max(0, focusIdx - 1)); return }
    if (key.downArrow) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }
    if (key.leftArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, -1))
      else if (focusIdx === 3) setPermissions(p => cycle(PERMS, p, -1))
      else if (focusIdx === 4 && AUTH_PROVIDERS.has(provider)) setAuthMode(p => cycle(AUTH_MODES, p, -1))
      else if (focusIdx === 5 && EFFORT_PROVIDERS.has(provider)) setEffort(p => cycle(EFFORTS, p, -1))
      else if (focusIdx === 8 && RC_PROVIDERS.has(provider)) setRcEnabled(v => !v)
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, 1))
      else if (focusIdx === 3) setPermissions(p => cycle(PERMS, p, 1))
      else if (focusIdx === 4 && AUTH_PROVIDERS.has(provider)) setAuthMode(p => cycle(AUTH_MODES, p, 1))
      else if (focusIdx === 5 && EFFORT_PROVIDERS.has(provider)) setEffort(p => cycle(EFFORTS, p, 1))
      else if (focusIdx === 8 && RC_PROVIDERS.has(provider)) setRcEnabled(v => !v)
      return
    }
    if (key.return && focusIdx === TOTAL_FIELDS - 1) {
      setError('')
      setSpawning(true)
      try {
        const session = spawn({
          provider,
          model,
          auth_mode: AUTH_PROVIDERS.has(provider) ? authMode : 'default',
          effort: EFFORT_PROVIDERS.has(provider) ? effort : 'default',
          task: task || '(interactive)',
          working_dir: workingDir || process.cwd(),
          nickname: nickname || undefined,
          permissions,
          rc_enabled: rcEnabled && RC_PROVIDERS.has(provider),
        })
        saveLastSpawn({ provider, model, auth_mode: authMode, effort, task, working_dir: workingDir, nickname, permissions, rc_enabled: rcEnabled })
        setResult(session)
        setSpawning(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'spawn failed')
        setSpawning(false)
      }
    }
  }, { isActive: !cmdMode })

  const rowColor = (idx: number) => focusIdx === idx ? '#5a96e0' : 'gray'
  const marker = (idx: number) => focusIdx === idx ? '>' : ' '
  const help = FIELD_HELP[focusIdx]

  function textRow(idx: number, label: string, value: string, placeholder: string) {
    const focused = focusIdx === idx
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {focused
          ? renderCursor(value, cursor)
          : <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || placeholder}</Text>
        }
      </Box>
    )
  }

  function selectRow(idx: number, label: string, displayVal: string, color = '#7eb8f5') {
    const focused = focusIdx === idx
    return (
      <Box>
        <Text color={rowColor(idx)} bold={focused}>{marker(idx)} {label.padEnd(14)}</Text>
        {focused && <Text color="gray" dimColor>{'← '}</Text>}
        <Text color={color} bold={focused}>{displayVal}</Text>
        {focused && <Text color="gray" dimColor>{' →'}</Text>}
      </Box>
    )
  }

  if (result) {
    return (
      <ScreenLayout
        screen="Spawn"
        panes={panes}
        nav={nav}
        hint="a attach  h home  esc back"
        header={
          <Box>
            <Text color="#5a96e0" bold>REEVES AGENTS</Text>
            <Text color="#4a6fa5">  /spawn</Text>
            <Text color="green" dimColor>  spawned</Text>
          </Box>
        }
      >
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text color="#4a6fa5">── SESSION ──────────────────────</Text>
          <Box><Text color="gray" dimColor>{'id          '}</Text><Text color="#7eb8f5">{result.id}</Text></Box>
          <Box><Text color="gray" dimColor>{'nickname    '}</Text><Text>{result.nickname}</Text></Box>
          <Box><Text color="gray" dimColor>{'provider    '}</Text><Text color={providerColor(result.provider)}>● {result.provider}</Text></Box>
          <Box><Text color="gray" dimColor>{'working dir '}</Text><Text color="gray">{result.working_dir.replace(homedir(), '~')}</Text></Box>
        </Box>
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} marginBottom={1}>
          <Text color="#4a6fa5">── ATTACH ───────────────────────</Text>
          <Text color="gray" dimColor>tmux attach -t {result.tmux_session}</Text>
          {process.env.TMUX && <Text color="gray" dimColor>or press a</Text>}
        </Box>
        {error && <Text color="yellow">{error}</Text>}
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout
      screen="Spawn"
      panes={panes}
      nav={nav}
      hint="tab/↑↓ navigate  ← → select  ctrl-a/e home/end"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /spawn</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 && help ? (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingX={1}>
            <Text color="#4a6fa5">── {help.label.toUpperCase()} {'─'.repeat(Math.max(0, 34 - help.label.length))}</Text>
            <Text color="gray" wrap="wrap">{help.text}</Text>
          </Box>
        ) : undefined
      }
    >
      {spawning ? (
        <Box marginBottom={1}><Text color="#5a96e0">spawning...</Text></Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {textRow(0, 'working dir', workingDir, process.cwd())}
          {selectRow(1, 'provider', provider, providerColor(provider))}
          {textRow(2, 'task', task, '(optional) leave blank for interactive session')}
          {selectRow(3, 'permissions', permissions)}
          {selectRow(4, 'auth', AUTH_PROVIDERS.has(provider) ? authMode : 'default')}
          {selectRow(5, 'effort', EFFORT_PROVIDERS.has(provider) ? effort : 'default')}
          {textRow(6, 'model', model, '(optional) leave blank for default')}
          {textRow(7, 'nickname', nickname, '(optional) label in tree view')}
          <Box>
            <Text color={rowColor(8)} bold={focusIdx === 8}>{marker(8)} {'remote ctrl'.padEnd(14)}</Text>
            {RC_PROVIDERS.has(provider) ? (
              <>
                {focusIdx === 8 && <Text color="gray" dimColor>{'← '}</Text>}
                <Text color="#7eb8f5" bold={focusIdx === 8}>{rcEnabled ? 'on' : 'off'}</Text>
                {focusIdx === 8 && <Text color="gray" dimColor>{' →'}</Text>}
              </>
            ) : (
              <Text color="gray" dimColor>off  (cc/codex only)</Text>
            )}
          </Box>
        </Box>
      )}

      {error && <Text color="red">{error}</Text>}

      {!spawning && (
        <Box>
          <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
            {marker(TOTAL_FIELDS - 1)} [ LAUNCH ]
          </Text>
        </Box>
      )}
    </ScreenLayout>
  )
}
