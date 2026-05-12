# Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the autocomplete command picker across all screens, extend the Session type with working_dir/ended_at/rc_url, add updateSession to registry, extend the banner with diagonal gradient, and register placeholder Top + History screens — producing a fully functional autocomplete bar on every screen and a type system ready for all subsequent plans.

**Architecture:** Types first (no runtime change), then registry patch function (tested), then banner math (tested), then useScreenNav rebuilt with completions state and Tab handling, then a shared CommandPicker display component, then mechanical wiring into all 8 existing screens plus 2 new placeholder screens, then router registration.

**Tech Stack:** TypeScript, React/Ink v7, Vitest, chalk, tmux

---

## File map

| File | Action |
|---|---|
| `src/state/types.ts` | Modify — add Session fields, SpawnRequest fields, ScreenName union |
| `src/state/registry.ts` | Modify — add `updateSession()`, update `mergeDefaults` for new fields |
| `src/brand/banner.ts` | Modify — add `direction` param to `gradientChars()` |
| `src/hooks/useScreenNav.ts` | Modify — add `DEDUPED_ROUTES`, `completions`, `selectedIdx`, Tab |
| `src/components/CommandPicker.tsx` | Create — shared autocomplete picker display component |
| `src/screens/Top.tsx` | Create — placeholder screen (route registration only) |
| `src/screens/History.tsx` | Create — placeholder screen (route registration only) |
| `src/router.tsx` | Modify — import + render Top and History |
| `src/screens/Welcome.tsx` | Modify — wire CommandPicker |
| `src/screens/Home.tsx` | Modify — wire CommandPicker |
| `src/screens/Spawn.tsx` | Modify — wire CommandPicker |
| `src/screens/Orchestrate.tsx` | Modify — wire CommandPicker |
| `src/screens/Sessions.tsx` | Modify — wire CommandPicker |
| `src/screens/Settings.tsx` | Modify — wire CommandPicker |
| `src/screens/Doctor.tsx` | Modify — wire CommandPicker |
| `src/screens/Help.tsx` | Modify — wire CommandPicker |
| `test/registry.test.ts` | Modify — add updateSession tests |
| `test/banner.test.ts` | Create — diagonal gradient tests |

---

## Task 1: Extend Session types

**Files:**
- Modify: `src/state/types.ts`

- [ ] **Step 1: Add fields to types.ts**

Open `src/state/types.ts`. Make these three changes:

**1a. Add `'Top'` and `'History'` to ScreenName union (line ~8):**

```typescript
export type ScreenName =
  | 'Welcome'
  | 'Home'
  | 'Spawn'
  | 'Orchestrate'
  | 'Sessions'
  | 'Top'
  | 'History'
  | 'Settings'
  | 'Doctor'
  | 'Help'
```

**1b. Add three fields to the `Session` interface, after `last_seen_at` (~line 110):**

```typescript
  last_seen_at: string
  working_dir: string | null
  ended_at: string | null
  rc_url: string | null
```

**1c. Add two fields to `SpawnRequest`, after `goal` (~line 127):**

```typescript
  goal?: string | null
  working_dir?: string
  remote_control?: boolean
```

**1d. Add `working_dir` to `SpawnFormState`, after `prompt` (~line 51):**

```typescript
  prompt: string
  working_dir: string
```

- [ ] **Step 2: Run typecheck — expect errors in registry.ts (mergeDefaults missing fields)**

```bash
pnpm typecheck 2>&1 | head -30
```

Expected: errors in `src/state/registry.ts` about missing `working_dir`, `ended_at`, `rc_url` in mergeDefaults. These get fixed in Task 2.

---

## Task 2: Update registry — mergeDefaults + updateSession

**Files:**
- Modify: `src/state/registry.ts`
- Modify: `test/registry.test.ts`

- [ ] **Step 1: Write failing tests for updateSession**

First, add a type import to `test/registry.test.ts` at the top (after the existing imports):

```typescript
import type { Session } from '../src/state/types.js'
```

Then add inside `describe('registry', ...)`:

```typescript
  it('updateSession patches a single field without disturbing others', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    const session = makeSession('upd1')
    write(session)
    updateSession('upd1', { ended_at: '2026-01-01T00:00:00.000Z' })
    const loaded = read('upd1')
    expect(loaded.ended_at).toBe('2026-01-01T00:00:00.000Z')
    expect(loaded.provider).toBe('cc')
    expect(loaded.name).toBe('agent-upd1')
  })

  it('updateSession patches working_dir', async () => {
    const { write, updateSession, read } = await import('../src/state/registry.js')
    const session = makeSession('upd2')
    write(session)
    updateSession('upd2', { working_dir: '/home/user/project' })
    const loaded = read('upd2')
    expect(loaded.working_dir).toBe('/home/user/project')
  })

  it('read returns null for new Session fields when absent from file', async () => {
    const { write, read } = await import('../src/state/registry.js')
    const session = makeSession('legacy1')
    // Write without new fields (simulates old file format)
    const { working_dir, ended_at, rc_url, ...legacySession } = session as Session & {
      working_dir: unknown; ended_at: unknown; rc_url: unknown
    }
    void working_dir; void ended_at; void rc_url
    write(legacySession as Session)
    const loaded = read('legacy1')
    expect(loaded.working_dir).toBeNull()
    expect(loaded.ended_at).toBeNull()
    expect(loaded.rc_url).toBeNull()
  })
```

Also update the `makeSession` helper to include new fields so it satisfies the Session type:

```typescript
function makeSession(id: string) {
  return {
    id,
    name: `agent-${id}`,
    parent_id: null,
    provider: 'cc' as const,
    auth: 'subscription' as const,
    base_url: null,
    model: null,
    key_ref: null,
    tag: null,
    permissions: 'skip' as const,
    effort: null,
    start_prompt: null,
    goal: null,
    tmux_session: 'reevesagents',
    tmux_window: `agent-${id}`,
    created_at: new Date().toISOString(),
    last_seen_at: new Date().toISOString(),
    working_dir: null,
    ended_at: null,
    rc_url: null,
  }
}
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test test/registry.test.ts 2>&1 | tail -20
```

Expected: failures on `updateSession` (not exported), and possibly type errors on `makeSession`.

- [ ] **Step 3: Update mergeDefaults in registry.ts**

In `src/state/registry.ts`, add three lines to the `merged` object inside `mergeDefaults` (after `last_seen_at`):

```typescript
    last_seen_at: (obj.last_seen_at as string) || nowIso(),
    working_dir: (obj.working_dir as string | null) ?? null,
    ended_at: (obj.ended_at as string | null) ?? null,
    rc_url: (obj.rc_url as string | null) ?? null,
```

- [ ] **Step 4: Add updateSession function at the end of registry.ts (before the last export)**

Add after the `isStale` function:

```typescript
export function updateSession(sessionId: string, patch: Partial<Session>): void {
  const session = read(sessionId)
  write({ ...session, ...patch })
}
```

- [ ] **Step 5: Run tests — expect pass**

```bash
pnpm test test/registry.test.ts 2>&1 | tail -10
```

Expected: all registry tests pass (including the 3 new ones and all pre-existing ones).

- [ ] **Step 6: Run full typecheck — expect clean**

```bash
pnpm typecheck 2>&1 | grep -c "error" || echo "0 errors"
```

Expected: 0 errors (or only pre-existing unrelated errors — note any).

- [ ] **Step 7: Commit**

```bash
git add src/state/types.ts src/state/registry.ts test/registry.test.ts
git commit -m "add working_dir/ended_at/rc_url to Session, add updateSession to registry"
```

---

## Task 3: Extend banner with diagonal gradient

**Files:**
- Modify: `src/brand/banner.ts`
- Create: `test/banner.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/banner.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('banner', () => {
  it('gradientChars horizontal: left and right chars have different colors', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const lines = gradientChars('ABCDE', ['#000000', '#ffffff'])
    expect(lines[0]).toBeDefined()
    const first = lines[0]![0]!.color
    const last = lines[0]![4]!.color
    expect(first).not.toBe(last)
  })

  it('gradientChars diagonal: top-left and bottom-right have different colors', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'ABC\nDEF\nGHI'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    const topLeft = lines[0]![0]!.color
    const bottomRight = lines[2]![2]!.color
    expect(topLeft).not.toBe(bottomRight)
  })

  it('gradientChars diagonal: t=0 at top-left gives first stop color', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'AB\nCD'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    // top-left: t = (0/(2-1) + 0/(2-1)) / 2 = 0 → first stop
    expect(lines[0]![0]!.color).toBe('#000000')
  })

  it('gradientChars diagonal: t=1 at bottom-right gives last stop color', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const art = 'AB\nCD'
    const lines = gradientChars(art, ['#000000', '#ffffff'], 'diagonal')
    // bottom-right: t = (1/(2-1) + 1/(2-1)) / 2 = 1 → last stop
    expect(lines[1]![1]!.color).toBe('#ffffff')
  })

  it('gradientChars default direction is horizontal (backward compat)', async () => {
    const { gradientChars } = await import('../src/brand/banner.js')
    const linesHoriz = gradientChars('ABCDE', ['#ff0000', '#0000ff'])
    const linesDefault = gradientChars('ABCDE', ['#ff0000', '#0000ff'], 'horizontal')
    expect(linesHoriz[0]![0]!.color).toBe(linesDefault[0]![0]!.color)
    expect(linesHoriz[0]![4]!.color).toBe(linesDefault[0]![4]!.color)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test test/banner.test.ts 2>&1 | tail -15
```

Expected: import errors since `gradientChars` doesn't accept a third argument yet. The diagonal tests will fail.

- [ ] **Step 3: Update gradientChars in banner.ts**

Replace the existing `gradientChars` function with:

```typescript
export function gradientChars(
  art: string = BANNER_ART,
  stops: readonly string[] = GRADIENT_STOPS,
  direction: 'horizontal' | 'diagonal' = 'horizontal',
): ColoredChar[][] {
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

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm test test/banner.test.ts 2>&1 | tail -10
```

Expected: all 5 banner tests pass.

- [ ] **Step 5: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/brand/banner.ts test/banner.test.ts
git commit -m "extend gradientChars with diagonal direction param"
```

---

## Task 4: Rebuild useScreenNav with autocomplete

**Files:**
- Modify: `src/hooks/useScreenNav.ts`

- [ ] **Step 1: Replace useScreenNav.ts entirely with the new version**

```typescript
// Shared command-bar navigation hook. Handles '/' command mode, esc, ? shortcut.
// Inputs: push/pop from router, optional disabled flag. Outputs: cmdMode, cmdValue,
// cmdError, completions (filtered routes), selectedIdx (Tab/↑↓ to cycle).
// Invariant: screen shortcuts check cmdMode and skip when true.

import { useState, useMemo } from 'react'
import { useInput, useApp } from 'ink'
import type { ScreenName } from '../state/types.js'

export interface DeduplicatedRoute {
  primary: string
  alias: string
  screen: ScreenName | '__quit__'
  description: string
}

// Ordered route table: one entry per destination, longer form as primary.
export const DEDUPED_ROUTES: DeduplicatedRoute[] = [
  { primary: '/home',        alias: '/h',   screen: 'Home',        description: 'go to home screen' },
  { primary: '/spawn',       alias: '/s',   screen: 'Spawn',       description: 'spawn a single agent' },
  { primary: '/orchestrate', alias: '/o',   screen: 'Orchestrate', description: 'fan out multiple agents' },
  { primary: '/sessions',    alias: '/l',   screen: 'Sessions',    description: 'view all running sessions' },
  { primary: '/top',         alias: '/t',   screen: 'Top',         description: 'live session monitor' },
  { primary: '/history',     alias: '/hi',  screen: 'History',     description: 'view session history' },
  { primary: '/settings',    alias: '/cfg', screen: 'Settings',    description: 'configure providers' },
  { primary: '/doctor',      alias: '/d',   screen: 'Doctor',      description: 'run health checks' },
  { primary: '/help',        alias: '',     screen: 'Help',        description: 'keyboard reference' },
  { primary: '/quit',        alias: '/q',   screen: '__quit__',    description: 'exit' },
]

// Flat lookup map for direct Enter without picker selection
const SLASH_ROUTES: Partial<Record<string, ScreenName | '__quit__'>> = {}
for (const r of DEDUPED_ROUTES) {
  SLASH_ROUTES[r.primary] = r.screen
  if (r.alias) SLASH_ROUTES[r.alias] = r.screen
}
// Legacy aliases kept for backward compat
SLASH_ROUTES['/welcome'] = 'Welcome'

interface ScreenNavState {
  cmdMode: boolean
  cmdValue: string
  cmdError: string
  completions: DeduplicatedRoute[]
  selectedIdx: number
}

export function useScreenNav(
  push: (screen: ScreenName) => void,
  pop: () => void,
  disabled = false,
): ScreenNavState {
  const { exit } = useApp()
  const [cmdMode, setCmdMode] = useState(false)
  const [cmdValue, setCmdValue] = useState('')
  const [cmdError, setCmdError] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const completions = useMemo(
    () =>
      cmdValue.length > 0
        ? DEDUPED_ROUTES.filter(r => r.primary.startsWith('/' + cmdValue))
        : [],
    [cmdValue],
  )

  useInput(
    (input, key) => {
      if (cmdMode) {
        if (key.escape) {
          setCmdMode(false)
          setCmdValue('')
          setCmdError('')
          setSelectedIdx(0)
          return
        }
        if (key.tab || key.downArrow) {
          if (completions.length > 0) {
            setSelectedIdx(i => (i + 1) % completions.length)
          }
          return
        }
        if (key.upArrow) {
          if (completions.length > 0) {
            setSelectedIdx(i => (i - 1 + completions.length) % completions.length)
          }
          return
        }
        if (key.backspace || key.delete) {
          const next = cmdValue.slice(0, -1)
          setCmdValue(next)
          setSelectedIdx(0)
          if (!next) {
            setCmdMode(false)
            setCmdError('')
          }
          return
        }
        if (key.return) {
          const chosen = completions[selectedIdx]
          const dest = chosen ? chosen.screen : SLASH_ROUTES['/' + cmdValue.trim()]
          if (dest === '__quit__') {
            exit()
          } else if (dest) {
            push(dest as ScreenName)
          } else {
            setCmdError(`unknown: /${cmdValue.trim()}`)
          }
          setCmdMode(false)
          setCmdValue('')
          setSelectedIdx(0)
          return
        }
        if (!key.ctrl && !key.meta) {
          setCmdValue(prev => prev + input)
          setSelectedIdx(0)
        }
        return
      }

      // Normal mode
      if (input === '/') {
        setCmdMode(true)
        setCmdValue('')
        setCmdError('')
        setSelectedIdx(0)
        return
      }
      if (input === '?') {
        push('Help')
        return
      }
      if (key.escape) {
        pop()
        return
      }
    },
    { isActive: !disabled },
  )

  return { cmdMode, cmdValue, cmdError, completions, selectedIdx }
}

export { SLASH_ROUTES }
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "useScreenNav\|types" | head -20
```

Expected: errors in screen files because `completions` and `selectedIdx` are now returned but not yet destructured. That's fine — fixed in Task 6.

- [ ] **Step 3: Run existing tests**

```bash
pnpm test 2>&1 | tail -15
```

Expected: all tests pass (hook changes don't break any existing tests since tests don't test the hook directly).

---

## Task 5: Create CommandPicker component

**Files:**
- Create: `src/components/CommandPicker.tsx`

- [ ] **Step 1: Create the file**

```typescript
// Autocomplete picker shown above the command bar when cmdMode is active.
// Inputs: filtered completions array, currently highlighted index.
// Outputs: none (display only). Returns null when completions is empty.
// Invariant: never renders when completions.length === 0.

import React from 'react'
import { Box, Text } from 'ink'
import type { DeduplicatedRoute } from '../hooks/useScreenNav.js'

interface Props {
  completions: DeduplicatedRoute[]
  selectedIdx: number
}

export function CommandPicker({ completions, selectedIdx }: Props) {
  if (completions.length === 0) return null

  const visible = completions.slice(0, 5)

  return (
    <Box flexDirection="column" marginBottom={0}>
      {visible.map((route, i) => {
        const isSelected = i === selectedIdx
        return (
          <Box key={route.primary}>
            <Text color={isSelected ? '#5a96e0' : '#30363d'}>
              {isSelected ? '●' : '○'}
            </Text>
            <Text color={isSelected ? '#7eb8f5' : '#484f58'} bold={isSelected}>
              {' '}{route.primary}
            </Text>
            {route.alias.length > 0 && (
              <Text color={isSelected ? '#4a6fa5' : '#21262d'}>
                {'  '}{route.alias}
              </Text>
            )}
            <Text color={isSelected ? '#8b949e' : '#1e2d3e'}>
              {'  — '}{route.description}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "CommandPicker" | head -5
```

Expected: no CommandPicker errors.

---

## Task 6: Wire CommandPicker into all existing screens

**Files:**
- Modify: all 8 screens in `src/screens/`

Each screen needs the same three changes:
1. Import `CommandPicker`
2. Add `completions, selectedIdx` to the `useScreenNav` destructure
3. Render `<CommandPicker>` just above the command bar Box

The command bar block in every screen looks like this (find it by the `borderStyle="round"` Box):

```tsx
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
<Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} ...>
  ...
</Box>
```

Insert `<CommandPicker completions={completions} selectedIdx={selectedIdx} />` directly above that block.

- [ ] **Step 1: Update Welcome.tsx**

Add import after existing imports:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~19):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, () => {})
```

Add picker above the command bar block (find the `borderStyle="round"` Box and insert before it):
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
<Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
```

- [ ] **Step 2: Update Home.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~19):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 3: Update Spawn.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~51):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)
```

Add picker above command bar (present in both the result view and the form view — add to both):
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 4: Update Orchestrate.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~61):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 5: Update Sessions.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~30):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 6: Update Settings.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~40):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 7: Update Doctor.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~28):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 8: Update Help.tsx**

Add import:
```typescript
import { CommandPicker } from '../components/CommandPicker.js'
```

Change destructure (line ~13):
```typescript
const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
```

Add picker above command bar:
```tsx
<CommandPicker completions={completions} selectedIdx={selectedIdx} />
{cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
```

- [ ] **Step 9: Run typecheck — expect clean**

```bash
pnpm typecheck 2>&1 | grep -c "error TS" && echo "errors found" || echo "clean"
```

Expected: 0 TypeScript errors.

- [ ] **Step 10: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/hooks/useScreenNav.ts src/components/CommandPicker.tsx \
  src/screens/Welcome.tsx src/screens/Home.tsx src/screens/Spawn.tsx \
  src/screens/Orchestrate.tsx src/screens/Sessions.tsx src/screens/Settings.tsx \
  src/screens/Doctor.tsx src/screens/Help.tsx
git commit -m "add autocomplete picker to all screens via useScreenNav completions"
```

---

## Task 7: Create placeholder Top and History screens

**Files:**
- Create: `src/screens/Top.tsx`
- Create: `src/screens/History.tsx`

- [ ] **Step 1: Create Top.tsx**

```typescript
// Live session monitor. Auto-refreshes every 5s. Arrow keys select, a attaches,
// k kills, r forces refresh. Full implementation in Plan 3.
// Inputs: session registry. Outputs: tabular session list + peek panel (wide).
// Invariant: refresh interval always cleared on unmount.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function Top() {
  const { push, pop } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /top · live session monitor</Text>
      </Box>
      <Box flexGrow={1}>
        <Text color="#6e7681" dimColor>full implementation coming in plan 3</Text>
      </Box>
      <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
      <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
        <Text color="#5a96e0" bold>/ </Text>
        <Text>{cmdMode ? cmdValue : ''}</Text>
        {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Create History.tsx**

```typescript
// Session history. Shows ended sessions with duration. d to delete, D to wipe all.
// Full implementation in Plan 3.
// Inputs: session registry (ended_at set). Outputs: history list.
// Invariant: only shows sessions where ended_at is non-null.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function History() {
  const { push, pop } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /history</Text>
      </Box>
      <Box flexGrow={1}>
        <Text color="#6e7681" dimColor>full implementation coming in plan 3</Text>
      </Box>
      <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
      <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
        <Text color="#5a96e0" bold>/ </Text>
        <Text>{cmdMode ? cmdValue : ''}</Text>
        {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
      </Box>
    </Box>
  )
}
```

---

## Task 8: Register Top and History in the router

**Files:**
- Modify: `src/router.tsx`

- [ ] **Step 1: Update router.tsx**

Add two imports after the existing screen imports:
```typescript
import { Top } from './screens/Top.js'
import { History } from './screens/History.js'
```

Add two cases to `renderScreen`:
```typescript
    case 'Top': return <Top />
    case 'History': return <History />
```

The full `renderScreen` function becomes:
```typescript
function renderScreen(screen: ScreenName) {
  switch (screen) {
    case 'Welcome': return <Welcome />
    case 'Home': return <Home />
    case 'Spawn': return <Spawn />
    case 'Orchestrate': return <Orchestrate />
    case 'Sessions': return <Sessions />
    case 'Top': return <Top />
    case 'History': return <History />
    case 'Settings': return <Settings />
    case 'Doctor': return <Doctor />
    case 'Help': return <Help />
  }
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep -c "error TS" && echo "errors" || echo "clean"
```

Expected: 0 errors. TypeScript switch exhaustiveness check will enforce all ScreenName values are handled.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Build to confirm no runtime errors**

```bash
pnpm build 2>&1 | tail -10
```

Expected: successful build with `dist/cli.js` and `dist/index.js` updated.

- [ ] **Step 5: Smoke test the autocomplete**

```bash
node dist/cli.js
```

Open the TUI, press `/`, then type `sp`. Verify:
- The picker appears above the command bar showing `● /spawn  /s  — spawn a single agent`
- Press Tab: selectedIdx advances (row highlights)
- Press Enter: navigates to Spawn screen
- Press `/hi`: navigates to History placeholder screen
- Press `/t`: navigates to Top placeholder screen

- [ ] **Step 6: Commit**

```bash
git add src/screens/Top.tsx src/screens/History.tsx src/router.tsx
git commit -m "add placeholder Top and History screens, register in router"
```

---

## Task 9: Export index.ts update (if needed)

**Files:**
- Modify: `src/index.ts`

- [ ] **Step 1: Check if Top/History need to be exported from the public API**

```bash
grep -n "Sessions\|Spawn\|Orchestrate" src/index.ts | head -5
```

- [ ] **Step 2: If screens are exported, add Top and History**

If the existing screens are exported from `src/index.ts`, add:
```typescript
export { Top } from './screens/Top.js'
export { History } from './screens/History.js'
```

If screens are not exported from `src/index.ts`, skip this step.

- [ ] **Step 3: Run final full test suite**

```bash
pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Final typecheck**

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors.

- [ ] **Step 5: Final commit**

```bash
git add src/index.ts  # only if modified
git commit -m "plan 1 complete: autocomplete, session types, banner diagonal, Top/History routes"
```

---

## Self-review

**Spec coverage check:**

| Spec requirement | Task that covers it |
|---|---|
| DEDUPED_ROUTES, completions, selectedIdx, Tab/↑↓ | Task 4 |
| /top and /history routes in useScreenNav | Task 4 |
| 'Top' and 'History' in ScreenName union | Task 1 |
| CommandPicker component | Task 5 |
| Picker wired to all screens | Task 6 |
| Top and History screens registered in router | Tasks 7 + 8 |
| Session.working_dir, ended_at, rc_url | Tasks 1 + 2 |
| SpawnRequest.working_dir, remote_control | Task 1 |
| SpawnFormState.working_dir | Task 1 |
| updateSession() in registry | Task 2 |
| mergeDefaults handles new fields (null default) | Task 2 |
| Banner diagonal gradient | Task 3 |

**Not covered in Plan 1 (by design — belongs to later plans):**

- Actual screen content redesigns (Plan 2)
- Pane-responsive layouts (Plan 2)
- working_dir actually set in spawn() (Plan 2)
- ended_at actually set in refresh loop (Plan 3)
- NavSidebar component (Plan 4)

**Placeholder scan:** No TBDs or TODOs in the plan. All code blocks are complete.

**Type consistency:** `DeduplicatedRoute` defined once in `useScreenNav.ts`, imported by `CommandPicker.tsx`. `Session` additions defined once in `types.ts`, used in `registry.ts` and screens. `ScreenName` union extended in `types.ts`, switch in `router.tsx` exhaustively handles all cases.
