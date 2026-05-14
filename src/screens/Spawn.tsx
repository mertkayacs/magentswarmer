// Spawn a single agent session. Form with working_dir/provider/auth/task/effort/permissions/model/tag.
// Inputs: form state (pre-filled from last_spawn). Outputs: Session on submit.
// Invariant: text fields active on focus (no enter-to-edit); useScreenNav disabled on text fields.

import React, { useState, useEffect, useRef } from 'react'
import { Box, Text, useInput } from 'ink'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { spawn } from '../launcher/spawn.js'
import { read } from '../state/registry.js'
import { loadState } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import { validateName } from '../utils/validateName.js'
import type { Provider, Auth, Effort, Permissions, Session } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini', 'opencode', 'aider', 'hermes']
const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PERMS: Permissions[] = ['ask', 'skip']
const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// 0=working_dir 1=provider 2=auth 3=task 4=effort 5=permissions 6=model 7=tag 8=name 9=remote_ctrl 10=submit
const TOTAL_FIELDS = 11
const TEXT_FIELDS = new Set([0, 3, 6, 7, 8])

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]
}


const FIELD_HELP: Record<number, { label: string; text: string }> = {
  0: { label: 'working dir', text: 'directory the agent will start in — defaults to current directory' },
  1: { label: 'provider', text: 'cc = Claude Code  codex = OpenAI Codex  gemini = Gemini CLI\nopencode = OpenCode  aider = Aider  hermes = Hermes (NousResearch)' },
  2: { label: 'auth', text: 'subscription = your plan  api-key = env var  custom = proxy/self-hosted' },
  3: { label: 'task', text: 'what should the agent do? leave blank for interactive session' },
  4: { label: 'effort', text: 'high = more thinking/tokens  low = faster/cheaper  — = default\ncc + codex only (opencode/aider ignore this field)' },
  5: { label: 'permissions', text: 'skip = agent acts without asking  ask = agent asks before each tool call' },
  6: { label: 'model', text: 'leave blank for provider default  e.g. opus, sonnet-4, gemini-2.0-flash' },
  7: { label: 'tag', text: 'optional label for grouping sessions  e.g. feature-auth, bugfix-race' },
  8: { label: 'name', text: 'optional session name override  alphanumeric, dash, underscore  max 30 chars' },
  9: { label: 'remote ctrl', text: 'enable remote control URL (CC only) — starts a web session for watching the agent' },
  10: { label: 'launch', text: 'press enter to spawn the agent in a new tmux window' },
}

export function Spawn() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [focusIdx, setFocusIdx] = useState(0)
  const [result, setResult] = useState<Session | null>(null)
  const [rcRequested, setRcRequested] = useState(false)
  const [rcPollGiveUp, setRcPollGiveUp] = useState(false)
  const rcPollCount = useRef(0)
  const [error, setError] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [spawnSpinIdx, setSpawnSpinIdx] = useState(0)
  const [spinIdx, setSpinIdx] = useState(0)

  const [ls] = useState(() => loadState().last_spawn)
  const [workingDir, setWorkingDir] = useState(ls.working_dir || process.cwd())
  const [provider, setProvider] = useState<Provider>(ls.provider)
  const [auth, setAuth] = useState<Auth>(ls.auth)
  const [task, setTask] = useState(ls.prompt)
  const [effort, setEffort] = useState<Effort | null>(ls.effort)
  const [permissions, setPermissions] = useState<Permissions>(ls.permissions)
  const [model, setModel] = useState(ls.model ?? '')
  const [tag, setTag] = useState(ls.tag ?? '')
  const [name, setName] = useState(ls.name ?? '')
  const [nameError, setNameError] = useState('')
  const [remoteControl, setRemoteControl] = useState(false)
  const [cursor, setCursor] = useState(0)

  useEffect(() => {
    if (!spawning) return
    const id = setInterval(() => setSpawnSpinIdx(i => (i + 1) % SPINNER.length), 80)
    return () => clearInterval(id)
  }, [spawning])

  useEffect(() => {
    if (!result || result.rc_url || rcPollGiveUp) return
    const id = setInterval(() => setSpinIdx(i => (i + 1) % SPINNER.length), 100)
    return () => clearInterval(id)
  }, [result?.id, result?.rc_url, rcPollGiveUp])

  useEffect(() => {
    if (!result || result.rc_url || !rcRequested || rcPollGiveUp) return
    rcPollCount.current = 0
    // Poll for up to 60s (120 × 500ms); give up and surface an error after that.
    const id = setInterval(() => {
      rcPollCount.current++
      if (rcPollCount.current > 120) {
        setRcPollGiveUp(true)
        clearInterval(id)
        return
      }
      try {
        const fresh = read(result.id)
        if (fresh.rc_url) setResult(fresh)
      } catch { /* registry miss */ }
    }, 500)
    return () => clearInterval(id)
  }, [result?.id, result?.rc_url, rcRequested, rcPollGiveUp])

  const isTextField = TEXT_FIELDS.has(focusIdx)
  const nav = useScreenNav(push, pop, isTextField)
  const { cmdMode } = nav

  function getTextFieldValue(idx: number): string {
    if (idx === 0) return workingDir
    if (idx === 3) return task
    if (idx === 6) return model
    if (idx === 7) return tag
    if (idx === 8) return name
    return ''
  }

  function moveFocus(newIdx: number) {
    setFocusIdx(newIdx)
    if (TEXT_FIELDS.has(newIdx)) setCursor(getTextFieldValue(newIdx).length)
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

  // Result view keys
  useInput((input, key) => {
    if (!result || cmdMode) return
    if (input === 'a') {
      if (process.env.TMUX) {
        try {
          execFileSync('tmux', ['switch-client', '-t', `${result.tmux_session}:${result.tmux_window}`], { stdio: 'ignore' })
        } catch {
          setError('tmux switch failed')
          setTimeout(() => setError(''), 3000)
        }
      } else {
        setError(`run: tmux attach -t ${result.tmux_session}:${result.tmux_window}`)
        setTimeout(() => setError(''), 5000)
      }
      return
    }
    if (input === 'c' && result.rc_url) {
      process.stdout.write('\x1b]52;c;' + Buffer.from(result.rc_url).toString('base64') + '\x07')
      return
    }
    if (input === 'l') { push('Sessions'); return }
  }, { isActive: !!result && !cmdMode })

  // Main form handler — text fields accept input on focus, no enter-to-edit step
  useInput((input, key) => {
    if (result) return

    if (key.tab) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }

    if (isTextField) {
      if (key.escape) { pop(); return }
      if (key.upArrow) { moveFocus(Math.max(0, focusIdx - 1)); return }
      if (key.downArrow || key.return) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }
      if (key.leftArrow) { setCursor(c => Math.max(0, c - 1)); return }
      if (key.rightArrow) { setCursor(c => Math.min(getTextFieldValue(focusIdx).length, c + 1)); return }
      if (key.ctrl && input === 'a') { setCursor(0); return }
      if (key.ctrl && input === 'e') { setCursor(getTextFieldValue(focusIdx).length); return }
      if (key.backspace) {
        if (cursor === 0) return
        if (focusIdx === 8) { const next = name.slice(0, cursor - 1) + name.slice(cursor); setName(next); setNameError(validateName(next) || '') }
        else if (focusIdx === 0) setWorkingDir(v => v.slice(0, cursor - 1) + v.slice(cursor))
        else if (focusIdx === 3) setTask(v => v.slice(0, cursor - 1) + v.slice(cursor))
        else if (focusIdx === 6) setModel(v => v.slice(0, cursor - 1) + v.slice(cursor))
        else if (focusIdx === 7) setTag(v => v.slice(0, cursor - 1) + v.slice(cursor))
        setCursor(c => c - 1)
        return
      }
      if (key.delete) {
        const fv = getTextFieldValue(focusIdx)
        if (cursor >= fv.length) return
        if (focusIdx === 8) { const next = name.slice(0, cursor) + name.slice(cursor + 1); setName(next); setNameError(validateName(next) || '') }
        else if (focusIdx === 0) setWorkingDir(v => v.slice(0, cursor) + v.slice(cursor + 1))
        else if (focusIdx === 3) setTask(v => v.slice(0, cursor) + v.slice(cursor + 1))
        else if (focusIdx === 6) setModel(v => v.slice(0, cursor) + v.slice(cursor + 1))
        else if (focusIdx === 7) setTag(v => v.slice(0, cursor) + v.slice(cursor + 1))
        return
      }
      if (!key.ctrl && !key.meta && input) {
        if (focusIdx === 8) {
          const next = name.slice(0, cursor) + input + name.slice(cursor)
          const err = validateName(next)
          if (err) { setNameError(err); return }
          setName(next); setNameError('')
        } else if (focusIdx === 0) setWorkingDir(v => v.slice(0, cursor) + input + v.slice(cursor))
        else if (focusIdx === 3) setTask(v => v.slice(0, cursor) + input + v.slice(cursor))
        else if (focusIdx === 6) setModel(v => v.slice(0, cursor) + input + v.slice(cursor))
        else if (focusIdx === 7) setTag(v => v.slice(0, cursor) + input + v.slice(cursor))
        setCursor(c => c + 1)
        return
      }
      return
    }

    // Select / toggle / submit
    if (key.upArrow) { moveFocus(Math.max(0, focusIdx - 1)); return }
    if (key.downArrow) { moveFocus(Math.min(TOTAL_FIELDS - 1, focusIdx + 1)); return }
    if (key.leftArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, -1))
      else if (focusIdx === 2) setAuth(a => cycle(AUTHS, a, -1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, -1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, -1))
      else if (focusIdx === 9 && provider === 'cc') setRemoteControl(rc => !rc)
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, 1))
      else if (focusIdx === 2) setAuth(a => cycle(AUTHS, a, 1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, 1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, 1))
      else if (focusIdx === 9 && provider === 'cc') setRemoteControl(rc => !rc)
      return
    }
    if (key.return && focusIdx === TOTAL_FIELDS - 1) {
      setError('')
      setSpawning(true)
      setSpawnSpinIdx(0)
      const rcEnabled = remoteControl && provider === 'cc'
      try {
        const session = spawn({
          provider, auth,
          model: model || undefined,
          permissions, effort,
          tag: tag || undefined,
          start_prompt: task || undefined,
          working_dir: workingDir || undefined,
          name: name || undefined,
          remote_control: rcEnabled || undefined,
        })
        setRcRequested(rcEnabled)
        setResult(session)
        setSpawning(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'spawn failed')
        setSpawning(false)
      }
      return
    }
  }, { isActive: !cmdMode })

  function rowColor(idx: number) { return focusIdx === idx ? '#5a96e0' : 'gray' }
  function marker(idx: number) { return focusIdx === idx ? '>' : ' ' }

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

  const help = FIELD_HELP[focusIdx]

  if (result) {
    return (
      <ScreenLayout
        screen="Spawn"
        panes={panes}
        nav={nav}
        hint="a attach  c copy URL  l sessions  esc back"
        header={
          <Box>
            <Text color="#5a96e0" bold>REEVES AGENTS</Text>
            <Text color="#4a6fa5">  /spawn</Text>
            <Text color="green" dimColor>  spawned</Text>
          </Box>
        }
      >
        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingLeft={1} paddingRight={1} marginBottom={1}>
          <Text color="#4a6fa5">── SESSION ──────────────────────</Text>
          <Box><Text color="gray" dimColor>{'id          '}</Text><Text color="#7eb8f5">{result.id}</Text></Box>
          <Box><Text color="gray" dimColor>{'provider    '}</Text><Text color={providerColor(result.provider)}>●{result.provider}</Text></Box>
          <Box><Text color="gray" dimColor>{'name        '}</Text><Text>{result.name}</Text></Box>
          {result.working_dir && (
            <Box><Text color="gray" dimColor>{'working dir '}</Text><Text color="gray">{result.working_dir.replace(homedir(), '~')}</Text></Box>
          )}
          {result.tag && (
            <Box><Text color="gray" dimColor>{'tag         '}</Text><Text>{result.tag}</Text></Box>
          )}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingLeft={1} paddingRight={1} marginBottom={1}>
          <Text color="#4a6fa5">── ATTACH ───────────────────────</Text>
          <Text color="gray" dimColor>tmux attach -t {result.tmux_session}:{result.tmux_window}</Text>
          <Text color="#6e7681" dimColor>or if in tmux: tmux switch-client -t {result.tmux_session}:{result.tmux_window}</Text>
        </Box>

        {rcRequested && (
          <Box flexDirection="column" borderStyle="round" borderColor={result.rc_url ? 'green' : rcPollGiveUp ? 'yellow' : 'gray'} paddingLeft={1} paddingRight={1} marginBottom={1}>
            <Text color="#4a6fa5">── REMOTE CONTROL ───────────────</Text>
            {result.rc_url ? (
              <Box>
                <Text color="green">{result.rc_url}</Text>
                <Text color="gray" dimColor>  c to copy</Text>
              </Box>
            ) : rcPollGiveUp ? (
              <Text color="yellow">URL not received after 60s — type /remote-control in the session</Text>
            ) : (
              <Box>
                <Text color="gray" dimColor>{SPINNER[spinIdx]} </Text>
                <Text color="gray" dimColor>waiting for URL...</Text>
              </Box>
            )}
          </Box>
        )}

        {error && <Text color="yellow">{error}</Text>}
      </ScreenLayout>
    )
  }

  return (
    <ScreenLayout
      screen="Spawn"
      panes={panes}
      nav={nav}
      hint="tab/↑↓ navigate  ← → select/cursor  ctrl-a/e home/end"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /spawn</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 && help ? (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── {help.label.toUpperCase()} {'─'.repeat(Math.max(0, 34 - help.label.length))}</Text>
            <Text color="gray" wrap="wrap">{help.text}</Text>
            {ls.prompt && focusIdx === 3 && (
              <Box marginTop={1}>
                <Text color="#6e7681" dimColor>last: {ls.prompt.slice(0, 60)}{ls.prompt.length > 60 ? '…' : ''}</Text>
              </Box>
            )}
          </Box>
        ) : undefined
      }
    >
      {spawning ? (
        <Box marginBottom={1}>
          <Text color="#5a96e0">{SPINNER[spawnSpinIdx]} spawning...</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {textRow(0, 'working dir', workingDir, process.cwd())}
          {selectRow(1, 'provider', provider, p => p ? providerColor(p as Provider) : 'gray')}
          {selectRow(2, 'auth', auth)}
          {textRow(3, 'task', task, '(optional) leave blank for interactive session')}
          {selectRow(4, 'effort', effort, undefined, v => v ?? '—')}
          {selectRow(5, 'permissions', permissions)}
          {textRow(6, 'model', model, '(optional) leave blank for default')}
          {textRow(7, 'tag', tag, '(optional) e.g. feature-branch')}
          {textRow(8, 'name', name, '(optional) override session name')}
          {nameError && <Box paddingLeft={2}><Text color="red" dimColor>{nameError}</Text></Box>}
          <Box>
            <Text color={rowColor(9)} bold={focusIdx === 9}>{marker(9)} {'remote ctrl'.padEnd(14)}</Text>
            {provider === 'cc' ? (
              <>
                {focusIdx === 9 && <Text color="gray" dimColor>{'← '}</Text>}
                <Text color="#7eb8f5" bold={focusIdx === 9}>{remoteControl ? 'on' : 'off'}</Text>
                {focusIdx === 9 && <Text color="gray" dimColor>{' →'}</Text>}
              </>
            ) : (
              <Text color="gray" dimColor>off  (cc only)</Text>
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
