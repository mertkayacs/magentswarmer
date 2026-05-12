// Spawn a single agent session. Form with working_dir/provider/auth/task/effort/permissions/model/tag.
// Inputs: form state (pre-filled from loadState().last_spawn). Outputs: Session on submit.
// Invariant: useScreenNav disabled while a text field is being edited.

import React, { useState, useMemo, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { homedir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { FieldHint } from '../components/FieldHint.js'
import { spawn } from '../launcher/spawn.js'
import { loadState } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import type { Provider, Auth, Effort, Permissions, Session } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini']
const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PERMS: Permissions[] = ['ask', 'skip']

// Field indices: 0=working_dir, 1=provider, 2=auth, 3=task, 4=effort, 5=permissions, 6=model, 7=tag, 8=submit
const TOTAL_FIELDS = 9
const TEXT_FIELDS = [0, 3, 6, 7]

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]
}

function effortLabel(e: string | null): string {
  return e ?? '—'
}

const FIELD_HELP: Record<number, { label: string; text: string }> = {
  0: { label: 'working dir', text: 'directory the agent will start in — defaults to current directory' },
  1: { label: 'provider', text: 'cc = Claude Code  codex = OpenAI Codex  gemini = Gemini CLI' },
  2: { label: 'auth', text: 'subscription = your plan  api-key = env var  custom = proxy/self-hosted' },
  3: { label: 'task', text: 'what should the agent do? the more specific the better' },
  4: { label: 'effort', text: 'high = more thinking/tokens  low = faster/cheaper  — = provider default' },
  5: { label: 'permissions', text: 'skip = agent acts without asking  ask = agent asks before each tool call' },
  6: { label: 'model', text: 'leave blank for provider default  e.g. opus, sonnet-4, gemini-2.0-flash' },
  7: { label: 'tag', text: 'optional label for grouping sessions  e.g. feature-auth, bugfix-race' },
  8: { label: 'launch', text: 'press enter to spawn the agent in a new tmux window' },
}

export function Spawn() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [focusIdx, setFocusIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState<Session | null>(null)
  const [error, setError] = useState('')

  const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  const [spinIdx, setSpinIdx] = useState(0)

  const savedState = loadState()
  const ls = savedState.last_spawn
  const [workingDir, setWorkingDir] = useState(ls.working_dir || process.cwd())
  const [provider, setProvider] = useState<Provider>(ls.provider)
  const [auth, setAuth] = useState<Auth>(ls.auth)
  const [task, setTask] = useState(ls.prompt)
  const [effort, setEffort] = useState<Effort | null>(ls.effort)
  const [permissions, setPermissions] = useState<Permissions>(ls.permissions)
  const [model, setModel] = useState(ls.model ?? '')
  const [tag, setTag] = useState(ls.tag ?? '')

  useEffect(() => {
    if (result && !result.rc_url) {
      const interval = setInterval(() => {
        setSpinIdx(i => (i + 1) % spinChars.length)
      }, 100)
      return () => clearInterval(interval)
    }
  }, [result?.rc_url])

  const isTextField = TEXT_FIELDS.includes(focusIdx)
  const fieldFocused = editing && isTextField
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)

  const currentFieldSetter = useMemo(() => {
    if (focusIdx === 0) return (fn: (v: string) => string) => setWorkingDir(fn)
    if (focusIdx === 3) return (fn: (v: string) => string) => setTask(fn)
    if (focusIdx === 6) return (fn: (v: string) => string) => setModel(fn)
    if (focusIdx === 7) return (fn: (v: string) => string) => setTag(fn)
    return null
  }, [focusIdx])

  // Result view keyboard handler
  useInput((input, key) => {
    if (!result) return
    if (cmdMode) return

    if (input === 'a') {
      if (typeof process !== 'undefined' && process.env.TMUX) {
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
      if (typeof process !== 'undefined') {
        process.stdout.write('\x1b]52;c;' + Buffer.from(result.rc_url).toString('base64') + '\x07')
      }
      return
    }

    if (input === 'l') {
      push('Sessions')
      return
    }

    if (key.escape) {
      pop()
      return
    }
  }, { isActive: !!result && !cmdMode })

  // Text input handler
  useInput((input, key) => {
    if (!currentFieldSetter) return
    if (key.escape || key.return) {
      setEditing(false)
      if (key.return && focusIdx < TOTAL_FIELDS - 1) setFocusIdx(i => i + 1)
      return
    }
    if (key.backspace || key.delete) {
      currentFieldSetter(v => v.slice(0, -1))
      return
    }
    if (!key.ctrl && !key.meta) {
      currentFieldSetter(v => v + input)
    }
  }, { isActive: fieldFocused })

  // Navigation handler
  useInput((input, key) => {
    void input
    if (key.tab || key.downArrow) { setFocusIdx(i => Math.min(TOTAL_FIELDS - 1, i + 1)); return }
    if (key.upArrow) { setFocusIdx(i => Math.max(0, i - 1)); return }
    if (key.leftArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, -1))
      else if (focusIdx === 2) setAuth(a => cycle(AUTHS, a, -1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, -1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, -1))
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 1) setProvider(p => cycle(PROVIDERS, p, 1))
      else if (focusIdx === 2) setAuth(a => cycle(AUTHS, a, 1))
      else if (focusIdx === 4) setEffort(e => cycle(EFFORTS, e, 1))
      else if (focusIdx === 5) setPermissions(p => cycle(PERMS, p, 1))
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
            working_dir: workingDir || undefined,
          })
          setResult(session)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'spawn failed')
        }
      }
    }
  }, { isActive: !fieldFocused && !cmdMode })

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
            <Text
              color={value === opt ? (opt === 'cc' || opt === 'codex' || opt === 'gemini' ? providerColor(opt as Provider) : '#7eb8f5') : 'gray'}
              bold={value === opt}
            >
              {labelFn(opt)}
            </Text>
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

  const help = FIELD_HELP[focusIdx]

  if (result) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /spawn</Text>
          <Text color="green" dimColor>  spawned</Text>
        </Box>

        <Box flexGrow={1} flexDirection="column">
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
          </Box>

          <Box flexDirection="column" borderStyle="round" borderColor={result.rc_url ? 'green' : 'gray'} paddingLeft={1} paddingRight={1} marginBottom={1}>
            <Text color="#4a6fa5">── REMOTE CONTROL ───────────────</Text>
            {!result.rc_url ? (
              <Box>
                <Text color="gray" dimColor>{spinChars[spinIdx]} </Text>
                <Text color="gray" dimColor>waiting for URL...</Text>
              </Box>
            ) : (
              <Box>
                <Text color="green">{result.rc_url}</Text>
                <Text color="gray" dimColor>  c to copy</Text>
              </Box>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color="gray" dimColor>a attach  c copy URL  l sessions  esc back</Text>
          </Box>

          {error && <Text color="yellow">{error}</Text>}

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
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /spawn</Text>
        <Text color="gray" dimColor>  tab/↑↓ navigate  ← → select  enter edit/submit</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column" marginBottom={1}>
            {textRow(0, 'working dir', workingDir, process.cwd())}
            {selectRow(1, 'provider', PROVIDERS, provider, v => v ?? '—')}
            {selectRow(2, 'auth', AUTHS, auth)}
            {textRow(3, 'task', task, '(required) what should the agent do?')}
            {selectRow(4, 'effort', EFFORTS, effort, effortLabel)}
            {selectRow(5, 'permissions', PERMS, permissions)}
            {textRow(6, 'model', model, '(optional) leave blank for default')}
            {textRow(7, 'tag', tag, '(optional) e.g. feature-branch')}
          </Box>

          {error && <Text color="red">{error}</Text>}

          <Box>
            <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
              {marker(TOTAL_FIELDS - 1)} [ LAUNCH ]
            </Text>
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && help && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── {help.label.toUpperCase()} {'─'.repeat(Math.max(0, 34 - help.label.length))}</Text>
            <Text color="gray" wrap="wrap">{help.text}</Text>
            {ls.prompt && focusIdx === 3 && (
              <Box marginTop={1}>
                <Text color="#6e7681" dimColor>last: {ls.prompt.slice(0, 60)}{ls.prompt.length > 60 ? '…' : ''}</Text>
              </Box>
            )}
          </Box>
        )}
      </Box>

      {/* Zone 3 */}
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
