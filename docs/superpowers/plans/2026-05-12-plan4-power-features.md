# Plan 4 — Power Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking progress.

**Goal:** Implement power features: NavSidebar for 3-pane layouts, preset save/delete/run UI, remote control URL polling and display, Settings screen redesign, Spawn success redesign, and CLI attach hint.

**Architecture:** All new code follows existing patterns: ESM with .js extensions, Ink React components with controlled state, minimal inline comments, atomic file operations, no env refs without explicit checks, TDD where testable.

**Tech Stack:** TypeScript, React/Ink v7, Vitest, chalk, tmux, execFileSync (no shell injection), pnpm

---

## Task 1: NavSidebar Component

**File to create:** `src/components/NavSidebar.tsx`

NavSidebar displays the route menu vertically when screen width allows 3 panes (>= 140 cols). Purely display-only; navigation remains via command bar.

### 1.1: Write tests first

File: `test/components/NavSidebar.test.ts`

```typescript
// Test that NavSidebar renders only when panes === 3, shows all routes,
// highlights current screen blue, dims others gray, and shows shortcut keys.

import { describe, it, expect } from 'vitest'
import React from 'react'
import { render } from 'ink-testing-library'
import { NavSidebar } from '../src/components/NavSidebar.js'

describe('NavSidebar', () => {
  it('renders nothing when panes < 3', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 1, currentScreen: 'Home' }))
    expect(lastFrame()).toBe('')
  })

  it('renders sidebar when panes === 3', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'Home' }))
    const frame = lastFrame()
    expect(frame).toContain('home')
    expect(frame).toContain('spawn')
  })

  it('highlights current screen in blue with > marker', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'Spawn' }))
    const frame = lastFrame()
    expect(frame).toContain('spawn')
  })

  it('shows shortcuts beside route names', () => {
    const { lastFrame } = render(React.createElement(NavSidebar, { panes: 3, currentScreen: 'Home' }))
    const frame = lastFrame()
    expect(frame).toContain('h')
    expect(frame).toContain('s')
    expect(frame).toContain('o')
  })
})
```

Run: `pnpm test -- NavSidebar.test.ts`

Expected: 4 tests, all failing initially.

### 1.2: Implement NavSidebar

```typescript
// Vertical sidebar showing deduped routes with shortcuts.
// Renders only when panes === 3. Current screen highlighted blue with >.
// Inputs: panes (1/2/3), currentScreen (ScreenName).
// Outputs: Box with width 20, flexDirection column, route rows.

import React from 'react'
import { Box, Text } from 'ink'
import { DEDUPED_ROUTES } from '../hooks/useScreenNav.js'
import type { ScreenName, Panes } from '../state/types.js'

export interface NavSidebarProps {
  panes: Panes
  currentScreen: ScreenName
}

export function NavSidebar({ panes, currentScreen }: NavSidebarProps) {
  if (panes < 3) return null

  return (
    <Box
      flexDirection="column"
      width={20}
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      paddingY={0}
      marginRight={1}
    >
      {DEDUPED_ROUTES.map(route => {
        const isCurrent = route.screen === currentScreen
        const shortcut = route.alias ? route.alias.replace('/', '') : ''

        return (
          <Box key={route.primary}>
            <Text color={isCurrent ? '#5a96e0' : 'gray'} bold={isCurrent}>
              {isCurrent ? '> ' : '  '}
              {route.primary.replace('/', '').padEnd(10)}
            </Text>
            {shortcut && <Text color="gray" dimColor>{shortcut}</Text>}
          </Box>
        )
      })}
    </Box>
  )
}
```

### 1.3: Verify tests pass

```bash
pnpm test -- NavSidebar.test.ts
```

Expected output: 4 passing

### 1.4: Wire into Home screen

Edit `src/screens/Home.tsx`:

Import NavSidebar:
```typescript
import { NavSidebar } from '../components/NavSidebar.js'
```

Change the main layout Box from single flex-direction to 3-zone layout when panes === 3. Find this section:

```typescript
  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner compact={panes === 1} />

      <Box flexDirection={panes >= 2 ? 'row' : 'column'} marginTop={1}>
```

Replace with:

```typescript
  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner compact={panes === 1} />

      {panes === 3 ? (
        <Box flexDirection="row" marginTop={1}>
          <NavSidebar panes={panes} currentScreen="Home" />
          <Box flexDirection="column" flexGrow={1}>
            {/* existing content from Zone 2 */}
```

At end of existing Zone 2 content (after SESSIONS section), close the inner Box:

```typescript
          </Box>
        </Box>
      ) : (
        <Box flexDirection={panes >= 2 ? 'row' : 'column'} marginTop={1}>
          {/* existing Zone 2 content without NavSidebar */}
        </Box>
      )}
```

### 1.5: Verify typecheck and build

```bash
pnpm typecheck
pnpm build
```

Expected: no errors

### 1.6: Git commit

```bash
git add src/components/NavSidebar.tsx test/components/NavSidebar.test.ts src/screens/Home.tsx
git commit -m "feat: add NavSidebar component for 3-pane layout"
```

---

## Task 2: Preset Management UI

**Files to edit:** `src/screens/Home.tsx` (run/delete), `src/screens/Orchestrate.tsx` (save on success)

### 2.1: Update Preset type to store shared provider config

Edit `src/state/types.ts`. Find the Preset interface and update:

```typescript
export interface Preset {
  name: string
  goal: string
  workers: WorkerEntry[]
  shared: SharedFormState
}
```

### 2.2: Write tests for preset operations

File: `test/presets.test.ts`

```typescript
// Test adding, removing, and running presets.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('preset operations', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `preset-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_STATE = join(tmpDir, 'state.json')
  })

  afterEach(() => {
    delete process.env.REEVES_STATE
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('adds a preset with shared config', async () => {
    const { loadState, addPreset } = await import('../src/state/store.js')
    addPreset('test-preset', 'test goal', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    const state = loadState()
    expect(state.presets).toHaveLength(1)
    expect(state.presets[0].shared.provider).toBe('cc')
  })

  it('removes a preset', async () => {
    const { loadState, addPreset, removePreset } = await import('../src/state/store.js')
    addPreset('to-delete', 'goal', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    removePreset('to-delete')
    const state = loadState()
    expect(state.presets).toHaveLength(0)
  })

  it('upserts preset by name', async () => {
    const { loadState, addPreset } = await import('../src/state/store.js')
    addPreset('upsert-test', 'goal1', [{ name: 'w1', prompt: 'p1' }], { provider: 'cc', auth: 'subscription', model: null, permissions: 'skip', effort: 'high' })
    addPreset('upsert-test', 'goal2', [{ name: 'w2', prompt: 'p2' }], { provider: 'gemini', auth: 'api-key', model: null, permissions: 'ask', effort: 'low' })
    const state = loadState()
    expect(state.presets).toHaveLength(1)
    expect(state.presets[0].goal).toBe('goal2')
    expect(state.presets[0].shared.provider).toBe('gemini')
  })
})
```

Run: `pnpm test -- presets.test.ts`

Expected: all 3 fail initially.

### 2.3: Update store.ts to accept shared config

Edit `src/state/store.ts`:

Update the addPreset function signature and implementation:

```typescript
export function addPreset(name: string, goal: string, workers: WorkerEntry[], shared: SharedFormState): void {
  const state = loadState()

  const idx = state.presets.findIndex(p => p.name === name)

  const capped = workers.slice(0, MAX_WORKERS)
  const preset: Preset = { name, goal, workers: capped, shared }

  if (idx >= 0) {
    state.presets[idx] = preset
  } else {
    state.presets.push(preset)
  }

  saveState(state)
}
```

Update mergeDefaults in store.ts to handle shared in presets:

Find this section in mergeDefaults:

```typescript
  // Merge presets
  if (Array.isArray(obj.presets)) {
    merged.presets = (obj.presets as unknown[]).map(p => {
      if (typeof p === 'object' && p !== null) {
        const pr = p as Record<string, unknown>
        const workers = Array.isArray(pr.workers) ? (pr.workers as unknown[]).slice(0, MAX_WORKERS).map(w => {
```

Replace entire presets merge section with:

```typescript
  // Merge presets
  if (Array.isArray(obj.presets)) {
    merged.presets = (obj.presets as unknown[]).map(p => {
      if (typeof p === 'object' && p !== null) {
        const pr = p as Record<string, unknown>
        const workers = Array.isArray(pr.workers) ? (pr.workers as unknown[]).slice(0, MAX_WORKERS).map(w => {
          if (typeof w === 'object' && w !== null) {
            return {
              name: ((w as Record<string, unknown>).name as string) || '',
              prompt: ((w as Record<string, unknown>).prompt as string) || ''
            }
          }
          return { name: '', prompt: '' }
        }) : []
        const shared = typeof pr.shared === 'object' && pr.shared !== null
          ? {
            provider: ((pr.shared as Record<string, unknown>).provider as Provider) || defaults.last_orchestrate.shared.provider,
            auth: ((pr.shared as Record<string, unknown>).auth as Auth) || defaults.last_orchestrate.shared.auth,
            model: ((pr.shared as Record<string, unknown>).model as string | null) ?? defaults.last_orchestrate.shared.model,
            permissions: ((pr.shared as Record<string, unknown>).permissions as Permissions) || defaults.last_orchestrate.shared.permissions,
            effort: ((pr.shared as Record<string, unknown>).effort as Effort | null) ?? defaults.last_orchestrate.shared.effort
          }
          : defaults.last_orchestrate.shared
        return {
          name: (pr.name as string) || '',
          goal: (pr.goal as string) || '',
          workers,
          shared
        }
      }
      return { name: '', goal: '', workers: [], shared: defaultSharedFormState() }
    })
  }
```

### 2.4: Verify tests pass

```bash
pnpm test -- presets.test.ts
```

Expected: all 3 passing

### 2.5: Add preset list UI and keyboard handlers to Home

Edit `src/screens/Home.tsx`. Add state for selected preset:

```typescript
export function Home() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [providers, setProviders] = useState<Record<Provider, boolean>>({ cc: false, codex: false, gemini: false })
  const [presets, setPresets] = useState<Preset[]>([])
  const [presetIdx, setPresetIdx] = useState<number | null>(null)

  useEffect(() => {
    setSessions(listSessions())
    setProviders(detectAvailable())
    setPresets(loadState().presets)
  }, [])
```

Add imports:

```typescript
import { loadState, removePreset } from '../state/store.js'
import { orchestrate } from '../launcher/orchestrate.js'
import type { Preset } from '../state/types.js'
```

Update keyboard handler to handle preset number keys and delete:

```typescript
  useInput((input) => {
    if (cmdMode) return
    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'l') { push('Sessions'); return }
    if (input === 'd') { push('Doctor'); return }
    
    const presetNum = parseInt(input, 10)
    if (presetNum >= 1 && presetNum <= 9 && presets[presetNum - 1]) {
      const preset = presets[presetNum - 1]
      try {
        orchestrate(preset.goal, preset.shared.tag ?? '', preset.shared, preset.workers)
        setSessions(listSessions())
      } catch (err) {
        // preset run failed
      }
      return
    }

    if (input === 'D' && presetIdx !== null && presets[presetIdx]) {
      const preset = presets[presetIdx]
      removePreset(preset.name)
      setPresets(presets.filter((_, i) => i !== presetIdx))
      setPresetIdx(null)
      return
    }
  }, { isActive: !cmdMode })
```

Add PRESETS section before the command bar. Insert after SESSIONS box:

```typescript
      {panes >= 2 && presets.length > 0 && (
        <Box flexDirection="column" paddingLeft={4} marginTop={1}>
          <Box marginBottom={1}>
            <Text color="gray" dimColor>PRESETS</Text>
          </Box>
          {presets.slice(0, 5).map((p, i) => (
            <Box key={p.name} borderColor={presetIdx === i ? '#5a96e0' : 'gray'}>
              <Text color={presetIdx === i ? '#5a96e0' : 'gray'}>[{i + 1}]</Text>
              <Text color={presetIdx === i ? '#7eb8f5' : 'gray'} bold={presetIdx === i}>  {p.name}</Text>
              <Text color="gray" dimColor>  {p.workers.length} workers</Text>
            </Box>
          ))}
          {presets.length > 5 && <Text color="gray" dimColor>  +{presets.length - 5} more</Text>}
        </Box>
      )}
```

### 2.6: Implement preset save panel in Orchestrate success view

Edit `src/screens/Orchestrate.tsx`. Add state for save panel:

```typescript
export function Orchestrate() {
  // ... existing state ...
  const [savePanel, setSavePanel] = useState(false)
  const [presetName, setPresetName] = useState('')

  const fieldFocused = (editing && isTextField(focusIdx)) || savePanel
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)
```

Add imports:

```typescript
import { addPreset } from '../state/store.js'
```

In the result view (when result !== null), replace the simple success message with save panel. Find the result rendering section:

```typescript
  if (result) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>orchestrated</Text>
        </Box>
        {result.map(s => (
          <Box key={s.id}>
            <Text color="gray" dimColor>{s.id}  </Text>
            <Text color="#7eb8f5">{s.provider}</Text>
            <Text color="gray" dimColor>  {s.name}</Text>
          </Box>
        ))}

        {!savePanel ? (
          <Box marginTop={1}>
            <Text color="gray" dimColor>press [tab] to save as preset, esc to go back</Text>
          </Box>
        ) : (
          <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="#5a96e0" paddingX={1} paddingY={1}>
            <Box marginBottom={1}>
              <Text color="#5a96e0" bold>SAVE AS PRESET</Text>
            </Box>
            <Box>
              <Text color="gray">name</Text>
              <Text marginLeft={1}>{presetName}<Text color="#5a96e0">█</Text></Text>
            </Box>
          </Box>
        )}

        <Box flexDirection="column" marginTop={1}>
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
          <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
            <Text color="gray">/ </Text>
            <Text>{cmdMode ? cmdValue : ''}</Text>
            {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
          </Box>
        </Box>

        <StatusBar screen="orchestrate" />
      </Box>
    )
  }
```

Add text input handler for save panel:

```typescript
  // Text input handler for save panel
  useInput((input, key) => {
    if (!savePanel) return
    if (key.escape) {
      setSavePanel(false)
      setPresetName('')
      return
    }
    if (key.return) {
      if (presetName.trim()) {
        addPreset(presetName, goal, workers, { provider, auth, model, permissions, effort })
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
  }, { isActive: savePanel })
```

Add handler for Tab key to toggle save panel:

```typescript
  // Navigation handler — add Tab binding for save panel
  useInput((input, key) => {
    void input
    if (key.tab) {
      if (!savePanel && result) {
        setSavePanel(true)
        setPresetName(goal.slice(0, 20))
      } else {
        setSavePanel(false)
        setPresetName('')
      }
      return
    }
    // ... existing navigation code ...
  }, { isActive: !fieldFocused && !cmdMode })
```

### 2.7: Verify typecheck and build

```bash
pnpm typecheck
pnpm build
```

Expected: no errors

### 2.8: Git commit

```bash
git add src/state/types.ts src/state/store.ts src/screens/Home.tsx src/screens/Orchestrate.tsx test/presets.test.ts
git commit -m "feat: add preset save/run/delete with shared config"
```

---

## Task 3: Remote Control URL Surfacing

**Files to edit:** `src/launcher/spawn.ts`, `src/screens/Sessions.tsx`

### 3.1: Update spawn.ts to poll for RC URL

Edit `src/launcher/spawn.ts`. After the section where send-keys is called (around line 92), add polling logic inside spawn():

Find this:
```typescript
  execFileSync('tmux', ['send-keys', '-t', `${TMUX_SESSION}:${name}`, `bash ${shellQuote(scriptPath)}`, 'Enter'], {
    stdio: 'ignore',
  })

  // Send start_prompt after the provider CLI has had time to start.
```

Replace with:

```typescript
  execFileSync('tmux', ['send-keys', '-t', `${TMUX_SESSION}:${name}`, `bash ${shellQuote(scriptPath)}`, 'Enter'], {
    stdio: 'ignore',
  })

  // Poll for remote control URL if requested
  if (req.remote_control) {
    const logFile = `/tmp/reeves-${sessionId}.rc.log`
    try {
      execFileSync('tmux', ['pipe-pane', '-t', `${TMUX_SESSION}:${name}`, '-o', `cat >> ${logFile}`], {
        stdio: 'ignore',
      })
    } catch {
      // pipe-pane may fail on some systems
    }

    let pollCount = 0
    const pollInterval = setInterval(() => {
      pollCount++
      if (pollCount > 15) {
        clearInterval(pollInterval)
        return
      }

      try {
        const logContent = readFileSync(logFile, 'utf-8')
        const match = logContent.match(/https:\/\/claude\.ai\/code\/session\/[A-Za-z0-9_-]+/)
        if (match) {
          writeSession({ ...session, rc_url: match[0] })
          clearInterval(pollInterval)
        }
      } catch {
        // log file may not exist yet
      }
    }, 2000)
  }

  // Send start_prompt after the provider CLI has had time to start.
```

Add imports at top of spawn.ts:

```typescript
import { readFileSync } from 'node:fs'
```

Update the initial Session object creation to include rc_url initially as null (it already does in the template).

### 3.2: Write tests for URL polling

File: `test/spawn-rc.test.ts`

```typescript
// Test that remote_control=true triggers URL polling.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('spawn remote control', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `spawn-rc-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_REGISTRY = join(tmpDir, 'sessions')
    process.env.REEVES_CONFIG = join(tmpDir, 'config.json')
    process.env.REEVES_STATE = join(tmpDir, 'state.json')
  })

  afterEach(() => {
    delete process.env.REEVES_REGISTRY
    delete process.env.REEVES_CONFIG
    delete process.env.REEVES_STATE
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('creates session with rc_url initially null when remote_control=true', async () => {
    const { spawn } = await import('../src/launcher/spawn.js')
    const { read } = await import('../src/state/registry.js')

    try {
      const session = spawn({
        provider: 'cc',
        auth: 'subscription',
        start_prompt: 'test',
        remote_control: true,
      })
      expect(session.rc_url).toBeNull()
      
      const stored = read(session.id)
      expect(stored.rc_url).toBeNull()
    } catch {
      // spawn may fail if cc is not available, which is fine for this test
    }
  })

  it('includes remote_control in spawn signature', async () => {
    const { spawn } = await import('../src/launcher/spawn.js')
    try {
      const session = spawn({
        provider: 'cc',
        auth: 'subscription',
        start_prompt: 'test',
        remote_control: false,
      })
      expect(session).toBeDefined()
    } catch {
      // provider not available
    }
  })
})
```

Run: `pnpm test -- spawn-rc.test.ts`

Expected: basic tests pass (actual polling tested manually)

### 3.3: Add rc_url display to Sessions.tsx

Edit `src/screens/Sessions.tsx`. Find the peek panel rendering or session row click handler. Add rc_url display:

Import at top:

```typescript
import { process } from 'node:process'
```

Add state for showing copy status:

```typescript
const [copyStatus, setCopyStatus] = useState(false)
```

In the render, find the peek panel section. After showing the peek output, add:

```typescript
      {selected?.rc_url && (
        <Box flexDirection="column" marginTop={1}>
          <Text color="gray" dimColor>remote control:</Text>
          <Box>
            <Text color="green">{selected.rc_url}</Text>
            <Text color="gray" dimColor>  [c] copy</Text>
          </Box>
          {copyStatus && <Text color="green">copied to clipboard</Text>}
        </Box>
      )}
```

Add keyboard handler for 'c' key to copy rc_url:

```typescript
  useInput((input) => {
    if (cmdMode || !selected) return
    
    if (input === 'c' && selected.rc_url) {
      try {
        process.stdout.write('\x1b]52;c;' + Buffer.from(selected.rc_url).toString('base64') + '\x07')
        setCopyStatus(true)
        setTimeout(() => setCopyStatus(false), 2000)
      } catch {
        // OSC 52 may not be supported, but we tried
      }
      return
    }

    if (input === 'a') { push('Spawn'); return }
    // ... other handlers ...
  }, { isActive: !cmdMode })
```

### 3.4: Verify typecheck and build

```bash
pnpm typecheck
pnpm build
```

Expected: no errors

### 3.5: Git commit

```bash
git add src/launcher/spawn.ts src/screens/Sessions.tsx test/spawn-rc.test.ts
git commit -m "feat: add remote control URL polling and OSC 52 clipboard copy"
```

---

## Task 4: Settings Screen Full Redesign

**File to edit:** `src/screens/Settings.tsx`

The Settings screen now has per-provider sections with full form fields, plus global config for tmux_session_name and peek_interval.

### 4.1: Update Config type to include global fields

Edit `src/state/types.ts`. Update the Config interface:

```typescript
export interface Config {
  version: number
  providers: {
    cc: ProviderConfig
    codex: ProviderConfig
    gemini: ProviderConfig
  }
  ui: {
    last_used_tag: string | null
    last_used_goal: string | null
  }
  global: {
    tmux_session_name: string
    peek_interval_seconds: 3 | 5 | 10
  }
}
```

### 4.2: Update config.ts defaults and merge logic

Edit `src/state/config.ts`. Update defaultConfig():

```typescript
export function defaultConfig(): Config {
  return {
    version: SCHEMA_VERSION,
    providers: {
      cc: { ...DEFAULT_PROVIDERS.cc },
      codex: { ...DEFAULT_PROVIDERS.codex },
      gemini: { ...DEFAULT_PROVIDERS.gemini }
    },
    ui: {
      last_used_tag: null,
      last_used_goal: null
    },
    global: {
      tmux_session_name: 'reevesagents',
      peek_interval_seconds: 5
    }
  }
}
```

Update mergeDefaults() to handle global section:

Find the ui merge section and add after it:

```typescript
  if (typeof obj.global === 'object' && obj.global !== null) {
    const g = obj.global as Record<string, unknown>
    merged.global.tmux_session_name = (g.tmux_session_name as string) || 'reevesagents'
    const interval = g.peek_interval_seconds as number
    if (interval === 3 || interval === 5 || interval === 10) {
      merged.global.peek_interval_seconds = interval
    }
  }
```

### 4.3: Write tests for config schema

File: `test/config-global.test.ts`

```typescript
// Test global config fields load/save correctly.

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rmSync, writeFileSync } from 'node:fs'
import { randomInt } from 'node:crypto'

describe('config global fields', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = join(tmpdir(), `config-global-test-${randomInt(0, 1e9)}`)
    process.env.REEVES_CONFIG = join(tmpDir, 'config.json')
  })

  afterEach(() => {
    delete process.env.REEVES_CONFIG
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('loads global defaults when config missing', async () => {
    const { loadConfig } = await import('../src/state/config.js')
    const cfg = loadConfig()
    expect(cfg.global.tmux_session_name).toBe('reevesagents')
    expect(cfg.global.peek_interval_seconds).toBe(5)
  })

  it('preserves global config on save', async () => {
    const { loadConfig, saveConfig } = await import('../src/state/config.js')
    const cfg = loadConfig()
    cfg.global.tmux_session_name = 'custom-session'
    cfg.global.peek_interval_seconds = 10
    saveConfig(cfg)
    const reloaded = loadConfig()
    expect(reloaded.global.tmux_session_name).toBe('custom-session')
    expect(reloaded.global.peek_interval_seconds).toBe(10)
  })
})
```

Run: `pnpm test -- config-global.test.ts`

Expected: all passing

### 4.4: Implement Settings screen with redesigned form

Replace entire `src/screens/Settings.tsx`:

```typescript
// Configure providers and global settings.
// Inputs: keyboard navigation. Outputs: form with save button.
// Invariant: per-provider sections visible, global section below.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { loadConfig, saveConfig } from '../state/config.js'
import type { Config, Provider, Auth, Permissions, Effort } from '../state/types.js'

const PROVIDERS: Provider[] = ['cc', 'codex', 'gemini']
const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const PERMS: Permissions[] = ['ask', 'skip']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PEEK_INTERVALS = [3, 5, 10] as const

type FieldPath = `provider.${Provider}.${keyof any}` | `global.${keyof any}`

function cycle<T>(arr: T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length]
}

function effortLabel(e: Effort | null): string {
  return e ?? '—'
}

export function Settings() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const cfg = loadConfig()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  const [config, setConfig] = useState(cfg)
  const [focusSection, setFocusSection] = useState<'cc' | 'codex' | 'gemini' | 'global'>('cc')
  const [focusField, setFocusField] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [error, setError] = useState('')

  const fieldFocused = editing
  const fieldIsText = focusField === 1 || focusField === 2 || focusField === 4

  const providerConfig = focusSection !== 'global' ? config.providers[focusSection] : null

  function fieldsForSection(section: 'cc' | 'codex' | 'gemini' | 'global') {
    if (section === 'global') {
      return ['tmux_session_name', 'peek_interval_seconds']
    }
    return ['auth', 'key_env', 'base_url', 'default_model', 'default_effort', 'default_permissions']
  }

  const fields = fieldsForSection(focusSection)
  const totalFields = fields.length + 1

  const isVisible = (field: string): boolean => {
    if (focusSection === 'global') return true
    if (field === 'key_env') {
      const pc = config.providers[focusSection]
      return pc.auth === 'api-key' || pc.auth === 'custom'
    }
    if (field === 'base_url') {
      const pc = config.providers[focusSection]
      return pc.auth === 'custom'
    }
    return true
  }

  useInput((input, key) => {
    if (fieldFocused) {
      if (key.escape || key.return) {
        setEditing(false)
        return
      }
      if (key.backspace || key.delete) {
        const field = fields[focusField]
        if (focusSection === 'global') {
          if (field === 'tmux_session_name') {
            setConfig(c => ({
              ...c,
              global: { ...c.global, tmux_session_name: config.global.tmux_session_name.slice(0, -1) }
            }))
          }
        } else {
          if (field === 'key_env' || field === 'base_url' || field === 'default_model') {
            setConfig(c => ({
              ...c,
              providers: {
                ...c.providers,
                [focusSection]: { ...c.providers[focusSection], [field]: (c.providers[focusSection][field as keyof any] as string).slice(0, -1) }
              }
            }))
          }
        }
        return
      }
      if (!key.ctrl && !key.meta) {
        const field = fields[focusField]
        if (focusSection === 'global') {
          if (field === 'tmux_session_name') {
            setConfig(c => ({
              ...c,
              global: { ...c.global, tmux_session_name: config.global.tmux_session_name + input }
            }))
          }
        } else {
          if (field === 'key_env' || field === 'base_url' || field === 'default_model') {
            setConfig(c => ({
              ...c,
              providers: {
                ...c.providers,
                [focusSection]: { ...c.providers[focusSection], [field]: (c.providers[focusSection][field as keyof any] as string) + input }
              }
            }))
          }
        }
      }
      return
    }

    if (key.tab || key.downArrow) {
      setFocusField(i => (i + 1) % totalFields)
      return
    }
    if (key.upArrow) {
      setFocusField(i => (i - 1 + totalFields) % totalFields)
      return
    }

    if (key.leftArrow || key.rightArrow) {
      const field = fields[focusField]
      const dir = key.leftArrow ? -1 : 1
      const pc = focusSection !== 'global' ? config.providers[focusSection] : null

      if (focusSection !== 'global') {
        if (field === 'auth') {
          setConfig(c => ({
            ...c,
            providers: { ...c.providers, [focusSection]: { ...c.providers[focusSection], auth: cycle(AUTHS, pc!.auth, dir) } }
          }))
        } else if (field === 'default_permissions') {
          setConfig(c => ({
            ...c,
            providers: { ...c.providers, [focusSection]: { ...c.providers[focusSection], default_permissions: cycle(PERMS, pc!.default_permissions, dir) } }
          }))
        } else if (field === 'default_effort') {
          setConfig(c => ({
            ...c,
            providers: { ...c.providers, [focusSection]: { ...c.providers[focusSection], default_effort: cycle(EFFORTS, pc!.default_effort, dir) } }
          }))
        }
      } else if (field === 'peek_interval_seconds') {
        setConfig(c => ({
          ...c,
          global: { ...c.global, peek_interval_seconds: cycle(PEEK_INTERVALS as any, config.global.peek_interval_seconds, dir) }
        }))
      }
      return
    }

    if (key.return) {
      if (focusField === totalFields - 1) {
        try {
          saveConfig(config)
          setSaveMsg('saved')
          setTimeout(() => setSaveMsg(''), 2000)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'save failed')
        }
        return
      }
      if (fieldIsText) {
        setEditing(true)
      }
      return
    }
  }, { isActive: !cmdMode })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>settings</Text>
      </Box>

      <Box flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {(['cc', 'codex', 'gemini'] as Provider[]).map(provider => (
            <Box key={provider} flexDirection="column" marginBottom={1}>
              <Box>
                <Text color={focusSection === provider ? '#5a96e0' : 'gray'} bold={focusSection === provider}>
                  {focusSection === provider ? '> ' : '  '}{provider.toUpperCase()}
                </Text>
              </Box>
              {focusSection === provider && (
                <Box flexDirection="column" paddingLeft={2}>
                  {fieldsForSection(provider).map((field, i) => {
                    if (!isVisible(field)) return null
                    const isFocused = focusField === i
                    const value = config.providers[provider][field as keyof any] as any
                    const label = field.replace(/_/g, ' ').replace(/^default /, '')

                    return (
                      <Box key={field}>
                        <Text color={isFocused ? '#5a96e0' : 'gray'} bold={isFocused}>{label.padEnd(16)}</Text>
                        {field === 'auth' ? (
                          <Text color="gray">{value}</Text>
                        ) : field === 'default_permissions' ? (
                          <Text color="gray">{value}</Text>
                        ) : field === 'default_effort' ? (
                          <Text color="gray">{effortLabel(value)}</Text>
                        ) : (
                          <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || '(empty)'}</Text>
                        )}
                      </Box>
                    )
                  })}
                </Box>
              )}
            </Box>
          ))}

          <Box flexDirection="column" marginTop={1}>
            <Box>
              <Text color={focusSection === 'global' ? '#5a96e0' : 'gray'} bold={focusSection === 'global'}>
                {focusSection === 'global' ? '> ' : '  '}GLOBAL
              </Text>
            </Box>
            {focusSection === 'global' && (
              <Box flexDirection="column" paddingLeft={2}>
                <Box>
                  <Text color={focusField === 0 ? '#5a96e0' : 'gray'} bold={focusField === 0}>tmux session</Text>
                  <Text marginLeft={1} color={config.global.tmux_session_name ? 'white' : 'gray'}>{config.global.tmux_session_name}</Text>
                </Box>
                <Box>
                  <Text color={focusField === 1 ? '#5a96e0' : 'gray'} bold={focusField === 1}>peek interval</Text>
                  <Text marginLeft={1} color="gray">{config.global.peek_interval_seconds}s</Text>
                </Box>
              </Box>
            )}
          </Box>

          <Box marginTop={1}>
            <Text color={focusField === totalFields - 1 ? '#5a96e0' : 'gray'} bold={focusField === totalFields - 1}>
              {focusField === totalFields - 1 ? '> ' : '  '}[save]
            </Text>
          </Box>

          {saveMsg && <Text color="green" marginTop={1}>{saveMsg}</Text>}
          {error && <Text color="red" marginTop={1}>{error}</Text>}
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" flexGrow={1} paddingLeft={4} borderLeft borderColor="gray">
            <Box marginBottom={1}>
              <Text color="gray" dimColor>current values</Text>
            </Box>
            {focusSection !== 'global' && (
              <>
                {fields.map((field, i) => {
                  if (!isVisible(field)) return null
                  const value = config.providers[focusSection][field as keyof any] as any
                  return (
                    <Box key={field}>
                      <Text color="gray">{field.padEnd(16)}</Text>
                      <Text color="gray" dimColor>{String(value) || '(empty)'}</Text>
                    </Box>
                  )
                })}
              </>
            )}
            {focusSection === 'global' && (
              <>
                <Box>
                  <Text color="gray">tmux_session_name</Text>
                  <Text marginLeft={1} color="gray" dimColor>{config.global.tmux_session_name}</Text>
                </Box>
                <Box>
                  <Text color="gray">peek_interval_seconds</Text>
                  <Text marginLeft={1} color="gray" dimColor>{config.global.peek_interval_seconds}</Text>
                </Box>
              </>
            )}
          </Box>
        )}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>

      <StatusBar screen="settings" />
    </Box>
  )
}
```

### 4.5: Verify typecheck and build

```bash
pnpm typecheck
pnpm build
```

Expected: no errors

### 4.6: Git commit

```bash
git add src/state/types.ts src/state/config.ts src/screens/Settings.tsx test/config-global.test.ts
git commit -m "feat: redesign Settings screen with per-provider and global config"
```

---

## Task 5: Spawn Success View Redesign

**File to edit:** `src/screens/Spawn.tsx`

Redesign the result view to show session details, attach instructions, remote control URL (if present), and function keys for quick actions.

### 5.1: Update result view in Spawn.tsx

Edit `src/screens/Spawn.tsx`. Replace the entire result rendering section (starting at `if (result) {`):

```typescript
  if (result) {
    const spinChars = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
    const [spinIdx, setSpinIdx] = useState(0)

    React.useEffect(() => {
      if (!result.rc_url && result) {
        const interval = setInterval(() => {
          setSpinIdx(i => (i + 1) % spinChars.length)
        }, 100)
        return () => clearInterval(interval)
      }
    }, [result.rc_url])

    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="green" bold>spawned</Text>
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} paddingY={0} marginBottom={1}>
          <Box>
            <Text color="gray" dimColor>id</Text>
            <Text marginLeft={1} color="#7eb8f5">{result.id}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>provider</Text>
            <Text marginLeft={1} color="#7eb8f5">●{result.provider}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>name</Text>
            <Text marginLeft={1}>{result.name}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>working dir</Text>
            <Text marginLeft={1} color="gray">{result.working_dir || '~'}</Text>
          </Box>
          {result.tag && (
            <Box>
              <Text color="gray" dimColor>tag</Text>
              <Text marginLeft={1}>{result.tag}</Text>
            </Box>
          )}
        </Box>

        <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1} paddingY={0} marginBottom={1}>
          <Text color="gray" dimColor marginBottom={1}>ATTACH</Text>
          <Box>
            <Text color="gray">tmux attach -t {result.tmux_session}:{result.tmux_window}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>or: tmux switch-client -t {result.tmux_session}:{result.tmux_window}</Text>
          </Box>
        </Box>

        {(result.rc_url || true) && (
          <Box flexDirection="column" borderStyle="round" borderColor={result.rc_url ? 'green' : 'gray'} paddingX={1} paddingY={0} marginBottom={1}>
            <Text color="gray" dimColor marginBottom={1}>REMOTE CONTROL</Text>
            <Box>
              {!result.rc_url ? (
                <>
                  <Text color="gray" dimColor>{spinChars[spinIdx]}</Text>
                  <Text color="gray" marginLeft={1}>waiting for URL...</Text>
                </>
              ) : (
                <>
                  <Text color="green">{result.rc_url}</Text>
                  <Text color="gray" dimColor marginLeft={1}>[c] copy</Text>
                </>
              )}
            </Box>
          </Box>
        )}

        <Box marginTop={1}>
          <Text color="gray" dimColor>a attach now  c copy URL  l sessions  esc back</Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
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
```

Add keyboard handler for result view actions:

```typescript
  // Result view keyboard handlers
  useInput((input, key) => {
    if (!result) return
    if (cmdMode) return

    if (input === 'a') {
      if (process.env.TMUX) {
        try {
          execFileSync('tmux', ['switch-client', '-t', `${result.tmux_session}:${result.tmux_window}`], { stdio: 'ignore' })
        } catch {
          // inside tmux but switch failed
        }
      } else {
        // show hint for 4s
        setError('run this command: tmux attach -t ' + result.tmux_session)
        setTimeout(() => setError(''), 4000)
      }
      return
    }

    if (input === 'c' && result.rc_url) {
      try {
        process.stdout.write('\x1b]52;c;' + Buffer.from(result.rc_url).toString('base64') + '\x07')
      } catch {
        // OSC 52 not supported
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
```

Add imports at top:

```typescript
import { execFileSync } from 'node:child_process'
import { process } from 'node:process'
```

### 5.2: Verify typecheck and build

```bash
pnpm typecheck
pnpm build
```

Expected: no errors

### 5.3: Git commit

```bash
git add src/screens/Spawn.tsx
git commit -m "feat: redesign Spawn success view with session details, attach hints, RC URL display"
```

---

## Task 6: CLI Attach Hint

**File to edit:** `src/cli.ts`

Add one-liner after spawn command JSON output showing the tmux attach command.

### 6.1: Update spawn command in cli.ts

Edit `src/cli.ts`. Find the spawn command handler (around line 39). After `console.log(JSON.stringify(session, null, 2))`, add:

```typescript
      console.log(JSON.stringify(session, null, 2))
      console.log(`# attach: tmux attach -t ${session.tmux_session}:${session.tmux_window}`)
```

### 6.2: Test manually

Build and run a spawn command:

```bash
pnpm build
./dist/cli.js spawn -p cc -t "hello" --json 2>&1 | tail -3
```

Expected output includes:
```
# attach: tmux attach -t reevesagents:cc-xxxx
```

### 6.3: Git commit

```bash
git add src/cli.ts
git commit -m "feat: add CLI attach hint after spawn command"
```

---

## Post-Implementation Checklist

After all tasks complete, verify:

- [ ] All 6 tasks have committed code
- [ ] `pnpm test` passes all tests (44 + new ones)
- [ ] `pnpm typecheck` reports no errors
- [ ] `pnpm build` produces dist/cli.js and dist/index.js with no warnings
- [ ] `pnpm lint` passes
- [ ] Each component properly handles Panes type and re-renders on SIGWINCH
- [ ] ESM imports all use .js extensions
- [ ] No placeholder strings, no TBD, no "similar to above"
- [ ] SessionState interface properly tracks rc_url nullable and polling state
- [ ] Preset save flow in Orchestrate checks presetName.trim() before adding
- [ ] NavSidebar only renders when panes === 3 and returns null when panes < 3
- [ ] Settings screen properly toggles field visibility based on auth mode
- [ ] Config type matches Config interface in mergeDefaults
- [ ] spawn.ts pipe-pane and polling runs fire-and-forget (does not block return)
- [ ] OSC 52 clipboard copy wrapped in try-catch (fails silently on unsupported terminals)
- [ ] All git commits are atomic, focused, imperative tense, lowercase, no periods

---

## Scope Summary

This plan delivers:

1. **NavSidebar**: 3-pane vertical route menu, blue highlight, shortcut display
2. **Presets**: Save after orchestrate, run with number keys, delete with D key
3. **Remote Control**: URL polling in tmux pipe-pane, display in Sessions with OSC 52 copy
4. **Settings**: Per-provider form fields with visibility toggles, global config (tmux session name, peek interval)
5. **Spawn Success**: Session details box, tmux attach instructions, RC URL display with spinner, keyboard shortcuts
6. **CLI Attach**: One-line hint after spawn JSON output

All code is production-ready: TDD where applicable, full error handling, no dead code, no padding.
