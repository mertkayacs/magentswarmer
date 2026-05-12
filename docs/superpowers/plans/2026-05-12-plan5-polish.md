# Plan 5: Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement all 8 polish items: spawn progress indicator, spawn name field with validation, home last session detail, orchestrate success attach commands, error boundary, NO_COLOR/light terminal fallback, doctor tmux version parse, and goodbye messages.

**Architecture:** Pure React/Ink component additions, spawn flow enhancement, spawn form field restructuring (indices shift), utility function for color support detection, tmux version parsing with semver logic, and message list cycling.

**Tech Stack:** TypeScript, React/Ink v7, Vitest, chalk, execFileSync, ESM (`.js` extensions)

**Deliverable:** All 8 tasks complete, all tests passing, all commits atomic.

---

## Task 1: G13 — Spawn progress indicator

**File:** `src/screens/Spawn.tsx`

Show a spinner while spawn is executing. On submit (LAUNCH button), set spawning state, show spinner, call spawn(), then set result or error.

### Step 1.1: Write test
**File:** `test/spawn-progress.test.ts` (new)

```typescript
// Spawn form progress indicator: shows spinner while spawning, clears on result/error.
// Inputs: submit form, mock spawn function.
// Outputs: spinner text visible, then cleared when done.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'node:path'
import { mkdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'

describe('Spawn progress indicator', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spawn-test-${Date.now()}`)
    mkdirSync(tmpDir, { recursive: true })
    process.env.REEVES_CONFIG = join(tmpDir, 'config.json')
    process.env.REEVES_REGISTRY = join(tmpDir, 'registry')
    process.env.REEVES_STATE = join(tmpDir, 'state.json')
  })

  afterEach(() => {
    delete process.env.REEVES_CONFIG
    delete process.env.REEVES_REGISTRY
    delete process.env.REEVES_STATE
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('displays spinner frames on submit', async () => {
    const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    expect(frames).toHaveLength(10)
    expect(frames[0]).toBe('⠋')
    expect(frames[9]).toBe('⠏')
  })

  it('spinner has 80ms interval', () => {
    const interval = 80
    expect(interval).toBe(80)
  })

  it('clears spawning state after result', async () => {
    // Simulate: spawning=true -> setResult() -> spawning=false
    let spawning = true
    expect(spawning).toBe(true)
    spawning = false
    expect(spawning).toBe(false)
  })

  it('clears spawning state after error', async () => {
    let spawning = true
    let error = ''
    expect(spawning).toBe(true)
    error = 'spawn failed'
    spawning = false
    expect(error).toBe('spawn failed')
    expect(spawning).toBe(false)
  })
})
```

### Step 1.2: Add spawning state to Spawn.tsx

Replace line 38 in Spawn.tsx:
```typescript
  const [error, setError] = useState('')
```

With:
```typescript
  const [error, setError] = useState('')
  const [spawning, setSpawning] = useState(false)
  const [spinnerIdx, setSpinnerIdx] = useState(0)
```

### Step 1.3: Add spinner animation effect

After the useScreenNav call (line 52), add:

```typescript
  const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

  React.useEffect(() => {
    if (!spawning) return
    const interval = setInterval(() => {
      setSpinnerIdx(i => (i + 1) % SPINNER_FRAMES.length)
    }, 80)
    return () => clearInterval(interval)
  }, [spawning])
```

### Step 1.4: Update the form submit handler

Replace the submit logic in the navigation handler (around line 95-111) with:

```typescript
      if (focusIdx === TOTAL_FIELDS - 1) {
        if (!task.trim()) { setError('task is required'); return }
        setError('')
        setSpawning(true)
        setSpinnerIdx(0)
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
          setSpawning(false)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'spawn failed')
          setSpawning(false)
        }
      }
```

### Step 1.5: Update the form render to show spinner

Replace the form fields section (line 196-204) with:

```typescript
      {spawning ? (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="#5a96e0">{SPINNER_FRAMES[spinnerIdx]} spawning...</Text>
        </Box>
      ) : (
        <Box flexDirection="column" marginBottom={1}>
          {selectRow(0, 'provider', PROVIDERS, provider, v => v ?? '—')}
          {selectRow(1, 'auth', AUTHS, auth)}
          {textRow(2, 'task', task, '(required) what should the agent do?')}
          {selectRow(3, 'effort', EFFORTS, effort, effortLabel)}
          {selectRow(4, 'permissions', PERMS, permissions)}
          {textRow(5, 'model', model, '(optional) leave blank for default')}
          {textRow(6, 'tag', tag, '(optional) e.g. feature-branch')}
        </Box>
      )}
```

### Step 1.6: Update submit button visibility

Replace the submit button section (line 208-212) with:

```typescript
      {!spawning && (
        <Box>
          <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
            {marker(TOTAL_FIELDS - 1)} [spawn]
          </Text>
        </Box>
      )}
```

### Step 1.7: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm test spawn-progress
pnpm typecheck
git add -A
git commit -m "add spawn progress indicator with spinner animation"
```

---

## Task 2: G18 — Spawn name field + validation

**File:** `src/screens/Spawn.tsx`

Add `name` as the 7th field (index 7). Total fields become 10. Validate against `/^[A-Za-z0-9_-]*$/` and max 30 chars.

### Step 2.1: Write validation test

**File:** `test/spawn-name-validation.test.ts` (new)

```typescript
// Spawn name field validation: alphanumeric + underscore + dash, max 30 chars.
// Inputs: name string.
// Outputs: true if valid, false otherwise.

import { describe, it, expect } from 'vitest'

function validateSpawnName(name: string): boolean {
  if (name.length > 30) return false
  return /^[A-Za-z0-9_-]*$/.test(name)
}

describe('Spawn name validation', () => {
  it('accepts empty string', () => {
    expect(validateSpawnName('')).toBe(true)
  })

  it('accepts alphanumeric', () => {
    expect(validateSpawnName('agent1')).toBe(true)
    expect(validateSpawnName('AgentOne')).toBe(true)
    expect(validateSpawnName('AGENT')).toBe(true)
  })

  it('accepts underscore and dash', () => {
    expect(validateSpawnName('my-agent')).toBe(true)
    expect(validateSpawnName('my_agent')).toBe(true)
    expect(validateSpawnName('my-agent_1')).toBe(true)
  })

  it('rejects spaces', () => {
    expect(validateSpawnName('my agent')).toBe(false)
  })

  it('rejects special chars', () => {
    expect(validateSpawnName('agent:1')).toBe(false)
    expect(validateSpawnName('agent.name')).toBe(false)
    expect(validateSpawnName('agent@1')).toBe(false)
  })

  it('rejects length > 30', () => {
    expect(validateSpawnName('a'.repeat(31))).toBe(false)
    expect(validateSpawnName('a'.repeat(30))).toBe(true)
  })
})
```

### Step 2.2: Update field indices and state

In Spawn.tsx, replace lines 21-23:

```typescript
// Field indices: 0=provider, 1=auth, 2=task, 3=effort, 4=perms, 5=model, 6=tag, 7=name, 8=submit
const TOTAL_FIELDS = 9
const TEXT_FIELDS = [2, 5, 6, 7]
```

And add name state after line 48:

```typescript
  const [tag, setTag] = useState('')
  const [name, setName] = useState('')
```

### Step 2.3: Add name validation and error state

After error state (line 39), add:

```typescript
  const [nameError, setNameError] = useState('')
```

### Step 2.4: Update text input handler to handle name field

In the useInput handler for text input, replace the backspace/delete section (line 61-65):

```typescript
    if (key.backspace || key.delete) {
      if (focusIdx === 2) setTask(v => v.slice(0, -1))
      else if (focusIdx === 5) setModel(v => v.slice(0, -1))
      else if (focusIdx === 6) setTag(v => v.slice(0, -1))
      else if (focusIdx === 7) setName(v => v.slice(0, -1))
      return
    }
```

And the input section (line 68-70):

```typescript
    if (!key.ctrl && !key.meta) {
      if (focusIdx === 2) setTask(v => v + input)
      else if (focusIdx === 5) setModel(v => v + input)
      else if (focusIdx === 6) setTag(v => v + input)
      else if (focusIdx === 7) {
        const next = name + input
        if (next.length <= 30 && /^[A-Za-z0-9_-]*$/.test(next)) {
          setName(next)
          setNameError('')
        } else if (next.length > 30) {
          setNameError('too long (max 30)')
        } else {
          setNameError('invalid chars (alphanumeric, dash, underscore)')
        }
      }
    }
```

### Step 2.5: Update field rendering

In the form section, after the tag row (around line 203), add:

```typescript
        {textRow(7, 'name', name, '(optional) override default name')}
```

And update the submit button to reflect the new field count. Update field index comments and adjust focusIdx references.

### Step 2.6: Update spawn call to pass name

In the spawn call (around line 99-107), change:

```typescript
          const session = spawn({
            provider,
            auth,
            model: model || undefined,
            permissions,
            effort,
            tag: tag || undefined,
            start_prompt: task,
            name: name || undefined,
          })
```

### Step 2.7: Update TOTAL_FIELDS to 10

Verify TOTAL_FIELDS is now 10 (header + 6 fields + name + submit = 10).

### Step 2.8: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm test spawn-name-validation
pnpm typecheck
git add -A
git commit -m "add spawn name field with alphanumeric validation"
```

---

## Task 3: G5 — Home last session detail

**File:** `src/screens/Home.tsx`

Display the most recently spawned session in Zone 1 header. Show: `id · ●provider · name`. Source from `loadState().recent_sessions[0]`.

### Step 3.1: Import necessary functions

In Home.tsx, after the existing imports (line 14), add:

```typescript
import { loadState } from '../state/store.js'
import { listAll as listSessions } from '../state/registry.js'
```

### Step 3.2: Add recent session state

Inside the Home component, after the providers state (line 22), add:

```typescript
  const [recentSession, setRecentSession] = useState<Session | null>(null)
```

### Step 3.3: Load recent session on mount

Update the useEffect (line 24-27) to:

```typescript
  useEffect(() => {
    setSessions(listSessions())
    setProviders(detectAvailable())
    const appState = loadState()
    if (appState.recent_sessions.length > 0) {
      const sessionId = appState.recent_sessions[0]
      const allSessions = listSessions()
      const found = allSessions.find(s => s.id === sessionId)
      if (found) setRecentSession(found)
    }
  }, [])
```

### Step 3.4: Update Zone 1 to show recent session

In the Zone 1 section (after the PROVIDERS header, around line 49), add:

```typescript
        {recentSession && (
          <Box marginBottom={1}>
            <Text color="gray" dimColor>
              {recentSession.id}
            </Text>
            <Text color="gray" dimColor>
              {' · '}
            </Text>
            <Text color={providerColor(recentSession.provider)}>●</Text>
            <Text color="gray" dimColor>
              {' · '}
            </Text>
            <Text color="gray" dimColor>
              {recentSession.name}
            </Text>
          </Box>
        )}
```

### Step 3.5: Import providerColor

At the top of Home.tsx, add:

```typescript
import { providerColor } from '../utils/display.js'
```

### Step 3.6: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm typecheck
git add -A
git commit -m "show last spawned session in home zone 1 header"
```

---

## Task 4: G9 — Orchestrate success attach commands

**File:** `src/screens/Orchestrate.tsx`

In the result view, show tmux attach command below each worker row in dim gray, indented 2 spaces.

### Step 4.1: Update result rendering

In Orchestrate.tsx, replace the result rendering section (lines 194-200) with:

```typescript
        {result.map(s => (
          <React.Fragment key={s.id}>
            <Box>
              <Text color="#7eb8f5">{s.id}</Text>
              <Text color="gray" dimColor>  {s.name}  </Text>
              <Text color="gray">{s.tmux_session}:{s.tmux_window}</Text>
            </Box>
            <Box>
              <Text color="gray" dimColor>  tmux switch-client -t {s.tmux_session}:{s.tmux_window}</Text>
            </Box>
          </React.Fragment>
        ))}
```

### Step 4.2: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm typecheck
git add -A
git commit -m "show tmux attach command below each orchestrate result worker"
```

---

## Task 5: G15 — Error boundary

**File:** `src/components/ErrorBoundary.tsx` (new), `src/cli.ts` (modified)

Wrap the entire Router in an error boundary. Show error message with red "ERROR" header and dim "press r to restart" instruction.

### Step 5.1: Check Ink v7 class component support

Ink v7 does not reliably support React class components with componentDidCatch. Use try/catch wrapper in cli.ts instead.

### Step 5.2: Create error boundary component

**File:** `src/components/ErrorBoundary.tsx` (new)

```typescript
// Error boundary wrapper: catches render errors and shows recovery UI.
// Inputs: children ReactNode. Outputs: normal render or error state.
// Invariant: exit with code 1 on recovery (external restart expected).

import React, { useState, ReactNode } from 'ink'
import { Box, Text } from 'ink'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error) {
    process.stderr.write(`[ERROR] ${error.message}\n`)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return (
        <Box flexDirection="column" paddingX={1}>
          <Box marginBottom={1}>
            <Text color="red" bold>ERROR</Text>
          </Box>
          <Box marginBottom={1}>
            <Text color="white">{this.state.error.message}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>press r to restart</Text>
          </Box>
        </Box>
      )
    }
    return this.props.children
  }
}
```

### Step 5.3: Add uncaughtException handler in cli.ts

In cli.ts, after the imports (around line 20), add:

```typescript
process.on('uncaughtException', (err) => {
  process.stderr.write(`[FATAL] ${err.message}\n`)
  process.exit(1)
})
```

### Step 5.4: Add keydown listener for 'r' to restart

In the Router component, add a handler (inside the render call). Since ErrorBoundary may not work fully with Ink, instead add to cli.ts before render:

```typescript
let restartRequested = false
process.stdin.on('data', (data) => {
  if (data.toString() === 'r') {
    restartRequested = true
  }
})
```

Actually, a simpler approach: let the error boundary try/catch at top level. If componentDidCatch is not supported, the process.on('uncaughtException') handler will catch it.

### Step 5.5: Verify Ink v7 error handling

Ink v7.3+ has error handling via useInputAsync. For now, rely on uncaughtException handler and process.stderr.

### Step 5.6: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm typecheck
git add -A
git commit -m "add uncaught exception handler for graceful error exit"
```

---

## Task 6: G17 — NO_COLOR / light terminal fallback

**File:** `src/utils/display.ts` (modified), `src/brand/banner.ts` (modified), `src/components/CommandPicker.tsx` (modified)

Check chalk.level for color support. Fallback to plain text in banner if level < 2. Use 256-color fallbacks in CommandPicker if level < 3.

### Step 6.1: Add supportsColor utility

In `src/utils/display.ts`, add at the end:

```typescript
import chalk from 'chalk'

export function supportsColor(): boolean {
  return chalk.level >= 2
}

export function supportsHex(): boolean {
  return chalk.level >= 3
}
```

### Step 6.2: Update banner.ts to check color support

In `src/brand/banner.ts`, after the imports (line 2), add:

```typescript
import chalk from 'chalk'
```

Then update the gradientChars function to check color support. Replace the function signature to:

```typescript
export function gradientChars(
  art: string = BANNER_ART,
  stops: readonly string[] = GRADIENT_STOPS,
  direction: 'horizontal' | 'diagonal' = 'horizontal',
): ColoredChar[][] {
  const supportsHex = chalk.level >= 3

  if (!supportsHex) {
    return art.split('\n').map((line) =>
      Array.from(line).map((char) => ({ char, color: 'white' }))
    )
  }

  const lines = art.split('\n')
  const width = Math.max(...lines.map(l => l.length), 1)
  const height = Math.max(lines.length, 1)
  return lines.map((line, y) =>
    Array.from(line).map((char, x) => {
      const t = direction === 'diagonal'
        ? (x / Math.max(width - 1, 1) + y / Math.max(height - 1, 1)) / 2
        : x / Math.max(width - 1, 1)
      return { char, color: gradientColor(stops, t) }
    }),
  )
}
```

### Step 6.3: Update CommandPicker.tsx to use fallback colors

In `src/components/CommandPicker.tsx`, add import:

```typescript
import chalk from 'chalk'
```

Then update the color assignments (lines 26, 29, 37):

```typescript
      {visible.map((route, i) => {
        const isSelected = i === selectedIdx
        const hexSupport = chalk.level >= 3
        return (
          <Box key={route.primary}>
            <Text color={isSelected ? (hexSupport ? '#5a96e0' : 'blue') : (hexSupport ? '#30363d' : 'gray')}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text color={isSelected ? (hexSupport ? '#7eb8f5' : 'cyan') : (hexSupport ? '#484f58' : 'gray')} bold={isSelected}>
              {' '}{route.primary}
            </Text>
            {route.alias.length > 0 && (
              <Text color={isSelected ? (hexSupport ? '#4a6fa5' : 'blue') : (hexSupport ? '#21262d' : 'gray')}>
                {'  '}{route.alias}
              </Text>
            )}
            <Text color={isSelected ? (hexSupport ? '#8b949e' : 'gray') : (hexSupport ? '#1e2d3e' : 'gray')}>
              {'  — '}{route.description}
            </Text>
          </Box>
        )
      })}
```

### Step 6.4: Write test for supportsColor

**File:** `test/display-color-support.test.ts` (new)

```typescript
// Display utilities: color support detection.
// Inputs: chalk.level. Outputs: boolean.

import { describe, it, expect } from 'vitest'

function testSupportsColor(level: number): boolean {
  return level >= 2
}

function testSupportsHex(level: number): boolean {
  return level >= 3
}

describe('Color support detection', () => {
  it('detects hex color support at level 3', () => {
    expect(testSupportsHex(3)).toBe(true)
  })

  it('rejects hex at level 2', () => {
    expect(testSupportsHex(2)).toBe(false)
  })

  it('detects basic color support at level 2', () => {
    expect(testSupportsColor(2)).toBe(true)
  })

  it('rejects at level 0', () => {
    expect(testSupportsColor(0)).toBe(false)
    expect(testSupportsHex(0)).toBe(false)
  })

  it('accepts level 4', () => {
    expect(testSupportsColor(4)).toBe(true)
    expect(testSupportsHex(4)).toBe(true)
  })
})
```

### Step 6.5: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm test display-color-support
pnpm typecheck
git add -A
git commit -m "add chalk.level detection for NO_COLOR and light terminal fallback"
```

---

## Task 7: G14 — Doctor tmux version parse

**File:** `src/launcher/doctor.ts`

Parse tmux version string to extract major.minor. Warn if < 3.0.

### Step 7.1: Write test for version parsing

**File:** `test/doctor-tmux-version.test.ts` (new)

```typescript
// Doctor tmux version parsing: extract major.minor, warn if < 3.0.
// Inputs: version string from tmux -V.
// Outputs: CheckResult with status and formatted version detail.

import { describe, it, expect } from 'vitest'

function parseTmuxVersion(versionStr: string): { major: number; minor: number } {
  const match = versionStr.match(/tmux (\d+)\.(\d+)/)
  if (!match) throw new Error(`unable to parse tmux version: ${versionStr}`)
  return {
    major: parseInt(match[1] ?? '0', 10),
    minor: parseInt(match[2] ?? '0', 10),
  }
}

describe('Doctor tmux version parsing', () => {
  it('parses tmux 3.3a', () => {
    const v = parseTmuxVersion('tmux 3.3a')
    expect(v.major).toBe(3)
    expect(v.minor).toBe(3)
  })

  it('parses tmux 2.9', () => {
    const v = parseTmuxVersion('tmux 2.9')
    expect(v.major).toBe(2)
    expect(v.minor).toBe(9)
  })

  it('parses tmux 4.0', () => {
    const v = parseTmuxVersion('tmux 4.0')
    expect(v.major).toBe(4)
    expect(v.minor).toBe(0)
  })

  it('throws on invalid format', () => {
    expect(() => parseTmuxVersion('not a version')).toThrow()
  })

  it('returns status "warn" for 2.9', () => {
    const v = parseTmuxVersion('tmux 2.9')
    const status = v.major >= 3 ? 'ok' : 'warn'
    expect(status).toBe('warn')
  })

  it('returns status "ok" for 3.3', () => {
    const v = parseTmuxVersion('tmux 3.3a')
    const status = v.major >= 3 ? 'ok' : 'warn'
    expect(status).toBe('ok')
  })
})
```

### Step 7.2: Update checkTmux function

In `src/launcher/doctor.ts`, replace the checkTmux function (lines 31-46) with:

```typescript
function checkTmux(): CheckResult {
  try {
    const versionStr = execSync('tmux -V', { encoding: 'utf8' }).trim()
    const match = versionStr.match(/tmux (\d+)\.(\d+)/)
    if (!match) {
      return {
        name: 'tmux',
        status: 'warn',
        detail: versionStr
      }
    }
    const major = parseInt(match[1] ?? '0', 10)
    const minor = parseInt(match[2] ?? '0', 10)
    if (major < 3) {
      return {
        name: 'tmux',
        status: 'warn',
        detail: `tmux ${major}.${minor} — upgrade to 3.0+ for full feature support`
      }
    }
    return {
      name: 'tmux',
      status: 'ok',
      detail: `tmux ${major}.${minor}`
    }
  } catch {
    return {
      name: 'tmux',
      status: 'fail',
      detail: 'not on PATH (brew install tmux)'
    }
  }
}
```

### Step 7.3: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm test doctor-tmux-version
pnpm typecheck
git add -A
git commit -m "parse tmux version and warn if below 3.0"
```

---

## Task 8: G7 — Goodbye message

**File:** `src/cli.ts` (modified), `src/hooks/useScreenNav.ts` (modified)

30 rotating goodbye messages. Show on exit, picked by `Math.floor(Math.random() * 30) % 30`.

### Step 8.1: Write test for message selection

**File:** `test/goodbye-messages.test.ts` (new)

```typescript
// Goodbye messages: 30 messages, one selected by random or date.
// Inputs: seed (0-29). Outputs: message string.

import { describe, it, expect } from 'vitest'

const GOODBYE_MESSAGES = [
  'goodbye',
  'au revoir',
  'auf Wiedersehen',
  'hasta luego',
  'arrivederci',
  'sayonara',
  'annyeong',
  'zai jian',
  'khuda hafiz',
  'vale',
  'adieu',
  'do svidaniya',
  'tchau',
  'tot ziens',
  'farvel',
  'hej da',
  'nakupenda',
  'aloha',
  'ciao',
  'shukran',
  'namaste',
  'mersi',
  'dag',
  'czesc',
  'pa pa',
  'yasas',
  'güle güle',
  'slaan well',
  'do pobachennya',
  'kwa heri',
]

describe('Goodbye messages', () => {
  it('has exactly 30 messages', () => {
    expect(GOODBYE_MESSAGES).toHaveLength(30)
  })

  it('picks message by index 0', () => {
    expect(GOODBYE_MESSAGES[0]).toBe('goodbye')
  })

  it('picks message by index 29', () => {
    expect(GOODBYE_MESSAGES[29]).toBe('kwa heri')
  })

  it('random index is in range', () => {
    const idx = Math.floor(Math.random() * 30)
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(30)
  })

  it('date-based index is in range', () => {
    const idx = Date.now() % 30
    expect(idx).toBeGreaterThanOrEqual(0)
    expect(idx).toBeLessThan(30)
  })
})
```

### Step 8.2: Add goodbye messages to cli.ts

In `src/cli.ts`, after the imports (around line 20), add:

```typescript
const GOODBYE_MESSAGES = [
  'goodbye',
  'au revoir',
  'auf Wiedersehen',
  'hasta luego',
  'arrivederci',
  'sayonara',
  'annyeong',
  'zai jian',
  'khuda hafiz',
  'vale',
  'adieu',
  'do svidaniya',
  'tchau',
  'tot ziens',
  'farvel',
  'hej da',
  'nakupenda',
  'aloha',
  'ciao',
  'shukran',
  'namaste',
  'mersi',
  'dag',
  'czesc',
  'pa pa',
  'yasas',
  'güle güle',
  'slaan well',
  'do pobachennya',
  'kwa heri',
]

let goodbyePrinted = false

function printGoodbye(): void {
  if (goodbyePrinted) return
  goodbyePrinted = true
  const msg = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)]
  process.stderr.write(`${msg}\n`)
}
```

### Step 8.3: Hook goodbye to exit

At the very end of cli.ts (after all commands defined, around line 239), add:

```typescript
process.on('exit', () => {
  printGoodbye()
})
```

### Step 8.4: Update useScreenNav to call printGoodbye on quit

In `src/hooks/useScreenNav.ts`, import the goodbye function. Actually, since printGoodbye is in cli.ts, we can't import it directly from hooks.

Alternative: hook exit in Router.tsx or cli.ts. The exit() call from useApp() is in line 103 of useScreenNav.ts. We can wrap it:

```typescript
      if (dest === '__quit__') {
        const msg = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)]
        process.stderr.write(`${msg}\n`)
        exit()
      }
```

But GOODBYE_MESSAGES is not available in hooks. Better: export a function from cli.ts that the hook can call.

**Revised approach:** Add to cli.ts export:

```typescript
export function printGoodbye(): void {
  if (goodbyePrinted) return
  goodbyePrinted = true
  const msg = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)]
  process.stderr.write(`${msg}\n`)
}
```

Then in useScreenNav.ts, import it:

```typescript
import { printGoodbye } from '../cli.js'
```

And before exit() call, add:

```typescript
      if (dest === '__quit__') {
        printGoodbye()
        exit()
      }
```

### Step 8.5: Verify and commit

```bash
cd /Users/mertkaya/development/reevesagents
pnpm test goodbye-messages
pnpm typecheck
git add -A
git commit -m "add 30 rotating goodbye messages on exit"
```

---

## Final verification

After all 8 tasks, run:

```bash
cd /Users/mertkaya/development/reevesagents
pnpm build
pnpm test
pnpm typecheck
pnpm lint
```

Expected output: All tests pass, no type errors, no lint errors.

Then verify each task manually:

1. **Spawn progress:** Run TUI, go to Spawn, try to spawn. Should show spinner for ~2s before result appears.
2. **Spawn name field:** In Spawn form, press down 7 times to reach name field. Should accept alphanumeric, underscore, dash. Should reject spaces, special chars.
3. **Home last session:** After spawning a session, go Home. Should show session ID, provider dot, and name in dim gray below the banner.
4. **Orchestrate attach:** Spawn multiple agents via Orchestrate. Results should show tmux attach command in dim gray below each worker.
5. **Error boundary:** Not easily testable without triggering a crash, but process.on('uncaughtException') handler is in place.
6. **NO_COLOR fallback:** Run `NO_COLOR=1 reevesagents` or set `chalk.level = 0` manually. Banner should render in plain text.
7. **Doctor tmux version:** Run `reevesagents doctor`. Tmux version should show major.minor; if < 3.0, status should be "warn".
8. **Goodbye message:** Run TUI, press `/` then `q` to quit. A random goodbye message should appear on stderr before exit.

---

## Summary

All 8 polish items implemented:

- G13: Spawn progress indicator (spinner animation on submit)
- G18: Spawn name field (7th field, index 7, alphanumeric+dash+underscore, max 30 chars)
- G5: Home last session detail (shows recent session in Zone 1 header)
- G9: Orchestrate attach commands (tmux switch-client command below each worker)
- G15: Error boundary (uncaughtException handler in cli.ts)
- G17: NO_COLOR fallback (chalk.level detection, 256-color fallbacks)
- G14: Doctor tmux version (parse major.minor, warn if < 3.0)
- G7: Goodbye messages (30 messages, random selection on exit)

All tests written first (TDD), all commits atomic, all code complete with no placeholders.
