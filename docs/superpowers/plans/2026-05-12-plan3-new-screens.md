# Plan 3 — New Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver three fully functional screens: Welcome splash with diagonal gradient art and auto-advance, History browser with delete/wipe, and /top live monitor with auto-refresh and dead session detection.

**Architecture:** Welcome uses a module-level `splashShown` flag to skip on repeat visits, a 5-second timer cleared on unmount, and a first-run check via `detectAvailable()`. History filters `ended_at !== null`, groups by `working_dir`, computes duration from timestamps. Top runs `setInterval(refresh, 5000)` with `clearInterval` on unmount, same dead session detection as Sessions, and updates a peek right panel each cycle.

**Tech Stack:** TypeScript, React/Ink v7, Vitest, chalk, tmux

---

## File map

| File | Action |
|---|---|
| `src/utils/display.ts` | Modify — add `formatDuration()` |
| `test/display.test.ts` | Create — tests for formatDuration |
| `src/screens/Welcome.tsx` | Modify — full redesign as gradient splash |
| `src/screens/History.tsx` | Modify — full implementation |
| `src/screens/Top.tsx` | Modify — full implementation |

---

## Task 1: Add formatDuration to display.ts

**Files:**
- Modify: `src/utils/display.ts`
- Create: `test/display.test.ts`

- [ ] **Step 1: Write failing tests**

Create `test/display.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'

describe('display', () => {
  it('formatDuration: seconds only when under 60s', async () => {
    const { formatDuration } = await import('../src/utils/display.js')
    const start = '2026-01-01T00:00:00.000Z'
    const end   = '2026-01-01T00:00:42.000Z'
    expect(formatDuration(start, end)).toBe('42s')
  })

  it('formatDuration: minutes and seconds when under 1h', async () => {
    const { formatDuration } = await import('../src/utils/display.js')
    const start = '2026-01-01T00:00:00.000Z'
    const end   = '2026-01-01T00:23:05.000Z'
    expect(formatDuration(start, end)).toBe('23m 5s')
  })

  it('formatDuration: hours and minutes when 1h or more', async () => {
    const { formatDuration } = await import('../src/utils/display.js')
    const start = '2026-01-01T00:00:00.000Z'
    const end   = '2026-01-01T03:45:00.000Z'
    expect(formatDuration(start, end)).toBe('3h 45m')
  })

  it('formatDuration: zero seconds returns 0s', async () => {
    const { formatDuration } = await import('../src/utils/display.js')
    const ts = '2026-01-01T00:00:00.000Z'
    expect(formatDuration(ts, ts)).toBe('0s')
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm test test/display.test.ts 2>&1 | tail -10
```

Expected: import error or "formatDuration is not a function".

- [ ] **Step 3: Add formatDuration to display.ts**

Append to `src/utils/display.ts`:

```typescript
export function formatDuration(createdAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(createdAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) {
    const rs = s % 60
    return `${m}m ${rs}s`
  }
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
pnpm test test/display.test.ts 2>&1 | tail -5
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/utils/display.ts test/display.test.ts
git commit -m "add formatDuration to display utils"
```

---

## Task 2: Welcome splash redesign

**Files:**
- Modify: `src/screens/Welcome.tsx`

- [ ] **Step 1: Replace Welcome.tsx entirely**

```typescript
// Welcome splash. Diagonal-gradient ASCII art, auto-advances to Home after 5s.
// Inputs: push from router. Detects first-run (no providers on PATH → Settings).
// Invariant: timer cleared on unmount; splashShown prevents re-showing on revisit.

import React, { useEffect, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import chalk from 'chalk'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { detectAvailable } from '../launcher/providers.js'
import { listAll } from '../state/registry.js'
import { loadState } from '../state/store.js'
import { gradientChars, REEVES_ART, AGENTS_ART, GRADIENT_STOPS } from '../brand/banner.js'

let splashShown = false

export function Welcome() {
  const { push } = useRouter()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, () => {})

  useEffect(() => {
    // Skip splash on revisit
    if (splashShown) {
      push('Home')
      return
    }

    // First-run: no providers installed → Settings
    const available = detectAvailable()
    const anyAvailable = Object.values(available).some(Boolean)
    if (!anyAvailable) {
      splashShown = true
      push('Settings')
      return
    }

    // Repeat session: already spawned something before → skip to Home
    const state = loadState()
    if (state.history.spawned_total > 0 || listAll().length > 0) {
      splashShown = true
      push('Home')
      return
    }

    const timer = setTimeout(() => {
      splashShown = true
      push('Home')
    }, 5000)

    return () => clearTimeout(timer)
  }, [push])

  useInput(() => {
    splashShown = true
    push('Home')
  }, { isActive: !cmdMode })

  const reevesLines = useMemo(() => {
    return gradientChars(REEVES_ART, GRADIENT_STOPS, 'diagonal').map(line =>
      line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
    )
  }, [])

  const agentsLines = useMemo(() => {
    return gradientChars(AGENTS_ART, GRADIENT_STOPS, 'diagonal').map(line =>
      line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
    )
  }, [])

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 2: content — fills available height */}
      <Box flexGrow={1} flexDirection="column" justifyContent="center">
        <Box flexDirection="column" alignItems="center">
          {reevesLines.map((line, i) => (
            <Box key={`r${i}`} justifyContent="center">
              <Text>{line}</Text>
            </Box>
          ))}
          {agentsLines.map((line, i) => (
            <Box key={`a${i}`} justifyContent="center">
              <Text>{line}</Text>
            </Box>
          ))}
          <Box marginTop={1} justifyContent="center">
            <Text color="#6e7681" dimColor>spawn  ·  watch  ·  jump</Text>
          </Box>
        </Box>

        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      </Box>

      {/* Zone 3: command bar */}
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>any key to skip</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "Welcome\|error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Build**

```bash
pnpm build 2>&1 | tail -5
```

Expected: successful build.

- [ ] **Step 5: Smoke test**

```bash
node dist/cli.js
```

Expected: gradient ASCII art fills the terminal, "spawn · watch · jump" tagline below, auto-advances to Home after 5 seconds. Any keypress advances immediately. Running again (splashShown = true) goes directly to Home.

- [ ] **Step 6: Commit**

```bash
git add src/screens/Welcome.tsx
git commit -m "redesign Welcome: gradient splash, auto-advance, first-run detection"
```

---

## Task 3: History screen full implementation

**Files:**
- Modify: `src/screens/History.tsx`

- [ ] **Step 1: Replace History.tsx entirely**

```typescript
// Session history. Shows ended sessions sorted by end time, grouped by working_dir.
// Inputs: registry (ended_at set). Outputs: history list with duration column.
// Invariant: only sessions with ended_at !== null appear; wipe-all requires 'y' confirm.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { listAll, remove as removeSession } from '../state/registry.js'
import { providerColor, formatDuration } from '../utils/display.js'
import type { Session } from '../state/types.js'

function groupByDir(sessions: Session[]): Array<[string, Session[]]> {
  const home = homedir()
  const map = new Map<string, Session[]>()
  for (const s of sessions) {
    const key = (s.working_dir ?? '(no project)').replace(home, '~')
    const list = map.get(key) ?? []
    list.push(s)
    map.set(key, list)
  }
  return Array.from(map.entries())
}

function flatSessions(groups: Array<[string, Session[]]>): Session[] {
  return groups.flatMap(([, sessions]) => sessions)
}

export function History() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [wipePending, setWipePending] = useState(false)

  const load = useCallback(() => {
    const all = listAll()
      .filter(s => s.ended_at !== null)
      .sort((a, b) => new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime())
    setSessions(all)
    setSelectedIdx(i => Math.min(i, Math.max(0, all.length - 1)))
  }, [])

  useEffect(() => { load() }, [load])

  const groups = groupByDir(sessions)
  const flat = flatSessions(groups)
  const selected = flat[selectedIdx] ?? null

  useInput((input, key) => {
    if (cmdMode) return

    if (wipePending) {
      if (input === 'y') {
        for (const s of sessions) removeSession(s.id)
        setWipePending(false)
        load()
      } else {
        setWipePending(false)
      }
      return
    }

    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(flat.length - 1, i + 1))
      return
    }
    if (input === 'd' && selected) {
      removeSession(selected.id)
      load()
      return
    }
    if (input === 'D') {
      if (sessions.length > 0) setWipePending(true)
      return
    }
    if (input === 'r') {
      load()
      return
    }
  }, { isActive: !cmdMode })

  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /history</Text>
        <Text color="gray" dimColor>  {sessions.length} ended  ↑↓ select  d delete  D wipe all  r refresh</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>no history — sessions appear here after they end</Text>
          ) : (
            groups.map(([dir, groupSessions]) => (
              <Box key={dir} flexDirection="column" marginBottom={0}>
                <Text color="#4a6fa5">{'── ' + dir + ' ' + '─'.repeat(Math.max(0, dashLen - dir.length - 1))}</Text>
                {groupSessions.map(s => {
                  const flatIdx = flat.indexOf(s)
                  const isSelected = flatIdx === selectedIdx
                  const duration = formatDuration(s.created_at, s.ended_at!)
                  const endedDate = new Date(s.ended_at!).toLocaleString('en-US', {
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
                  })
                  return (
                    <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                      {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                      <Text color={isSelected ? '#7eb8f5' : '#30363d'} bold={isSelected}>{s.id}</Text>
                      <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                      <Text color={isSelected ? 'white' : 'gray'}>  {(s.tag ?? s.name).slice(0, 20).padEnd(20)}</Text>
                      <Text color="#6e7681" dimColor>  {duration.padEnd(8)}</Text>
                      <Text color="#21262d" dimColor>  {endedDate}</Text>
                    </Box>
                  )
                })}
              </Box>
            ))
          )}

          {wipePending && (
            <Box marginTop={1} borderStyle="round" borderColor="red" paddingLeft={1} paddingRight={1}>
              <Text color="red">wipe all {sessions.length} history entries? </Text>
              <Text color="white" bold>y</Text>
              <Text color="gray">/any other key to cancel</Text>
            </Box>
          )}

          <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
        </Box>

        {panes >= 2 && selected && (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="#1e2d3e"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── SESSION ───────────────────────────</Text>
            {(Object.entries(selected) as [string, unknown][]).map(([k, v]) => (
              <Box key={k}>
                <Text color="#6e7681" dimColor>{k.padEnd(14)}</Text>
                <Text color="gray" wrap="truncate">{v === null ? 'null' : String(v)}</Text>
              </Box>
            ))}
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
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "History\|error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Build + smoke test**

```bash
pnpm build 2>&1 | tail -5
node dist/cli.js
```

Navigate to `/history`. Expected: "no history" message if no ended sessions. Kill a tmux window manually to create one, then re-enter — it should appear with provider, name, duration, and end timestamp. Press `d` to delete it. Press `D` to see the wipe-all confirmation, then press any key other than `y` to cancel.

- [ ] **Step 5: Commit**

```bash
git add src/screens/History.tsx
git commit -m "implement History screen: ended sessions, grouped, duration, delete, wipe-all"
```

---

## Task 4: /top live monitor full implementation

**Files:**
- Modify: `src/screens/Top.tsx`

- [ ] **Step 1: Replace Top.tsx entirely**

```typescript
// Live session monitor. Flat table, auto-refreshes every 5s with dead session detection.
// Inputs: registry, tmux (has-session), peek (capture-pane). Outputs: session table + peek panel.
// Invariant: refresh interval always cleared on unmount; peek updates each refresh cycle.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { listAll, updateSession, isStale } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import { peek } from '../launcher/peek.js'
import type { Session } from '../state/types.js'

export function Top() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState('')
  const [attachHint, setAttachHint] = useState('')

  const refresh = useCallback(() => {
    const all = listAll()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', `${s.tmux_session}:${s.tmux_window}`], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const alive = listAll()
      .filter(s => s.ended_at === null)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    setSessions(alive)
    setSelectedIdx(i => Math.min(i, Math.max(0, alive.length - 1)))
    // Update peek for selected session
    setSelectedIdx(prev => {
      const sel = alive[prev]
      if (sel) setPeekContent(peek(sel.id, 15))
      return prev
    })
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const selected = sessions[selectedIdx] ?? null

  useInput((input, key) => {
    if (cmdMode) return

    if (key.upArrow) {
      const next = Math.max(0, selectedIdx - 1)
      setSelectedIdx(next)
      const sel = sessions[next]
      if (sel) setPeekContent(peek(sel.id, 15))
      return
    }
    if (key.downArrow) {
      const next = Math.min(sessions.length - 1, selectedIdx + 1)
      setSelectedIdx(next)
      const sel = sessions[next]
      if (sel) setPeekContent(peek(sel.id, 15))
      return
    }
    if (input === 'a' && selected) {
      const target = `${selected.tmux_session}:${selected.tmux_window}`
      if (process.env.TMUX) {
        try {
          execFileSync('tmux', ['switch-client', '-t', target], { stdio: 'ignore' })
        } catch {
          setAttachHint(`could not switch to ${target}`)
          setTimeout(() => setAttachHint(''), 4000)
        }
      } else {
        setAttachHint(`tmux attach -t ${selected.tmux_session}`)
        setTimeout(() => setAttachHint(''), 4000)
      }
      return
    }
    if (input === 'k' && selected) {
      try {
        execFileSync('tmux', ['kill-window', '-t', `${selected.tmux_session}:${selected.tmux_window}`], { stdio: 'ignore' })
      } catch { /* already gone */ }
      refresh()
      return
    }
    if (input === 'r') {
      refresh()
      return
    }
  }, { isActive: !cmdMode })

  const home = homedir()
  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /top · auto-refresh 5s</Text>
        <Text color="gray" dimColor>  {sessions.length} active  ↑↓ select  a attach  k kill  r refresh</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 && peekContent ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>no active sessions</Text>
          ) : (
            <Box flexDirection="column">
              {/* Column headers */}
              <Box paddingLeft={2}>
                <Text color="#4a6fa5">{'id'.padEnd(6)}</Text>
                <Text color="#4a6fa5">{'prov'.padEnd(8)}</Text>
                <Text color="#4a6fa5">{'name'.padEnd(24)}</Text>
                <Text color="#4a6fa5">{'dir'.padEnd(22)}</Text>
                <Text color="#4a6fa5">{'age'.padEnd(6)}</Text>
                <Text color="#4a6fa5">{'status'}</Text>
              </Box>
              <Text color="#1e2d3e">{'─'.repeat(dashLen)}</Text>
              {sessions.map((s, i) => {
                const isSelected = i === selectedIdx
                const stale = isStale(s)
                const dir = (s.working_dir ?? '(no project)').replace(home, '~').slice(0, 20)
                return (
                  <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                    {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                    <Text color={isSelected ? '#7eb8f5' : 'gray'} bold={isSelected}>{s.id.padEnd(6)}</Text>
                    <Text color={providerColor(s.provider)}>{('●' + s.provider).padEnd(8)}</Text>
                    <Text color={isSelected ? 'white' : 'gray'}>{(s.tag ?? s.name).slice(0, 22).padEnd(24)}</Text>
                    <Text color="#6e7681" dimColor>{dir.padEnd(22)}</Text>
                    <Text color="#6e7681" dimColor>{formatAge(s.created_at).padEnd(6)}</Text>
                    <Text color={stale ? '#facc15' : '#4ade80'} bold>{'● '}</Text>
                    <Text color={stale ? '#facc15' : '#4ade80'}>{stale ? 'stale' : 'active'}</Text>
                  </Box>
                )
              })}
            </Box>
          )}

          {attachHint !== '' && (
            <Box marginTop={1}>
              <Text color="yellow">{attachHint}</Text>
            </Box>
          )}

          <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
        </Box>

        {panes >= 2 && peekContent && (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="gray"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── PEEK ──────────────────────────────</Text>
            <Text color="gray" dimColor>{selected?.name ?? ''}</Text>
            {peekContent.split('\n').map((line, i) => (
              <Text key={i} wrap="truncate">{line || ' '}</Text>
            ))}
          </Box>
        )}
      </Box>

      {/* Zone 3 */}
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>type a command</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

- [ ] **Step 2: Run typecheck**

```bash
pnpm typecheck 2>&1 | grep "Top\|error TS" | head -10
```

Expected: 0 errors.

- [ ] **Step 3: Run full test suite**

```bash
pnpm test 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Build + smoke test**

```bash
pnpm build 2>&1 | tail -5
node dist/cli.js
```

Navigate to `/top`. With active sessions: table shows ID, provider dot, name, dir, age, status dot. Press `↑↓` to select — right panel (if wide terminal) shows peek output. Press `r` to force refresh. Confirm status dots turn yellow for stale sessions (those with `last_seen_at` older than 5 minutes). Kill a tmux window manually — within 5s it disappears from the table.

- [ ] **Step 5: Commit**

```bash
git add src/screens/Top.tsx
git commit -m "implement Top: flat session table, 5s auto-refresh, dead session detection, peek panel"
```

---

## Self-review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Welcome diagonal gradient art | Task 2 |
| Welcome 5s auto-advance | Task 2 |
| Welcome any-key skip | Task 2 |
| Welcome first-run: no providers → Settings | Task 2 |
| Welcome repeat visits: skip to Home | Task 2 |
| Welcome timer cleared on unmount | Task 2 |
| formatDuration (hours, minutes, seconds) | Task 1 |
| History: filter ended_at !== null | Task 3 |
| History: sort by ended_at desc | Task 3 |
| History: group by working_dir | Task 3 |
| History: ID, provider, name, duration, ended_at columns | Task 3 |
| History: d delete selected | Task 3 |
| History: D wipe all with y confirm | Task 3 |
| History: right panel full session JSON (2+ panes) | Task 3 |
| History: r manual refresh | Task 3 |
| Top: auto-refresh 5s with clearInterval | Task 4 |
| Top: dead session detection + ended_at stamp | Task 4 |
| Top: flat table sorted by created_at asc | Task 4 |
| Top: ID, provider, name, dir, age, status columns | Task 4 |
| Top: ↑↓ select, a attach, k kill, r refresh | Task 4 |
| Top: right panel peek updated each cycle (2+ panes) | Task 4 |
| Top: stale = yellow, active = green status dot | Task 4 |

**Not in Plan 3 (Plan 4):**
- NavSidebar (3-pane Top layout with sidebar)
- RC URL in peek panel
