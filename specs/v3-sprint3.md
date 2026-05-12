> **Superseded.** See `docs/superpowers/specs/2026-05-12-reevesagents-design.md` for the current unified design.

---

# reevesagents v3 — Sprint 3 spec

Sprint 3 polish items from v3-audit-2026-05-12.md. Sprint 2 must be complete and on
master before starting. These are incremental improvements — none block the core flow.

---

## G13 — Spawn progress indicator (do this first, trivial)

`spawn()` is synchronous and takes ~200ms. Currently pressing `[spawn]` freezes the
UI with no feedback until the result renders. Add a `spawning` state.

In `Spawn.tsx`, in the submit handler:

```typescript
if (focusIdx === TOTAL_FIELDS - 1) {
  if (!task.trim()) { setError('task is required'); return }
  setError('')
  setSpawning(true)   // new
  try {
    const session = spawn({ ... })
    setResult(session)
  } catch (err) {
    setError(err instanceof Error ? err.message : 'spawn failed')
  } finally {
    setSpawning(false)  // new
  }
}
```

Add `const [spawning, setSpawning] = useState(false)`. Replace the `[spawn]` button
render:

```tsx
<Box>
  <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'}
        bold={focusIdx === TOTAL_FIELDS - 1}>
    {spawning ? '  spawning...' : `${marker(TOTAL_FIELDS - 1)} [spawn]`}
  </Text>
</Box>
```

Files: `src/screens/Spawn.tsx`. No new files.

---

## G18 — Spawn form: name field with validation

### What to add

Currently the Spawn form has no name field. Session name auto-generates as
`${provider}-${sessionId}`. Add a `name` field (field index 7, before submit which
becomes index 8) so users can give sessions meaningful names.

The tmux window name has restrictions: no spaces, no colons (`:`), no dots (`.`),
max 30 chars. Validate before submit.

### INVALID_NAME_CHARS and validation function

```typescript
const INVALID_NAME_CHARS = /[\s:.]/

function validateName(name: string): string | null {
  if (!name) return null  // empty = auto-generate, always valid
  if (name.length > 30) return 'name too long (max 30 chars)'
  if (INVALID_NAME_CHARS.test(name)) return 'name cannot contain spaces, colons, or dots'
  return null
}
```

### Field index shift

Current: 0=provider, 1=auth, 2=task, 3=effort, 4=perms, 5=model, 6=tag, 7=submit.
New:     0=provider, 1=auth, 2=task, 3=effort, 4=perms, 5=model, 6=tag, 7=name, 8=submit.

Update `TOTAL_FIELDS = 9`, `TEXT_FIELDS = [2, 5, 6, 7]`.

Add `const [name, setName] = useState(ls.name ?? '')` (pulling from last_spawn after
Sprint 1's F5 fix). Update the submit call: `name: name || undefined`.

Run validation in the submit handler:
```typescript
const nameErr = validateName(name)
if (nameErr) { setError(nameErr); return }
```

Field hint for the name field when focused: "optional. auto-generates as provider-id if blank. no spaces, : or ."

Files: `src/screens/Spawn.tsx` only.

---

## G9 — Orchestrate post-spawn summary: attach commands

Currently Orchestrate success view shows session IDs and names. Add attach commands.

In Orchestrate.tsx, in the success render, after each session row:

```tsx
{results.map(s => (
  <Box key={s.id} flexDirection="column" marginBottom={0}>
    <Box>
      <Text color="gray" dimColor>  </Text>
      <Text color="#7eb8f5">{s.id}</Text>
      <Text color="gray" dimColor>  </Text>
      <Text color={providerColor(s.provider)}>{s.provider}</Text>
      <Text color="gray" dimColor>  {s.tag ?? s.name}</Text>
    </Box>
    <Box paddingLeft={4}>
      <Text color="gray" dimColor>
        tmux switch-client -t {s.tmux_session}:{s.tmux_window}
      </Text>
    </Box>
  </Box>
))}
```

Show `tmux switch-client` (for use inside tmux) rather than `tmux attach`, since
most users running the TUI are already inside a tmux session.

Files: `src/screens/Orchestrate.tsx` only.

---

## G5 — Home screen: show most recent session in 1-pane mode

Sprint 1's UX spec added recent sessions to the right panel (2+ panes). The 1-pane
mode still shows only a count. Fix: in 1-pane mode, show the single most recent
session inline below the count.

In Home.tsx, in the 1-pane branch:

```tsx
{panes === 1 && sessions.length > 0 && (
  <Box marginTop={1}>
    <Text color="gray" dimColor>last  </Text>
    <Text color="#7eb8f5">{sessions[0].id}</Text>
    <Text color="gray" dimColor>  </Text>
    <Text color={providerColor(sessions[0].provider)}>{sessions[0].provider}</Text>
    <Text color="gray" dimColor>  {sessions[0].tag ?? sessions[0].name}</Text>
  </Box>
)}
```

`sessions` is already sorted by created_at desc (registry.ts `listAll` sorts), so
index 0 is the most recent.

Files: `src/screens/Home.tsx` only.

---

## F7 — Goodbye messages (30-language rotating)

### Rotation logic

Pick by `new Date().getDay() * 4 + new Date().getHours() % 4` — gives 28 slots cycling
by day + time, more varied than a pure modulo on startup.

### src/brand/goodbye.ts (new file)

```typescript
// Rotating multilingual goodbye shown on clean exit.
// One message per language, 30 languages.
// Invariant: array length === 30, each message is short enough for one terminal line.

export const GOODBYE_MESSAGES: string[] = [
  'goodbye',                    // english
  'görüşürüz',                 // turkish
  'adiós',                     // spanish
  'au revoir',                  // french
  'auf Wiedersehen',            // german
  'さようなら',                  // japanese
  '再见',                       // chinese (simplified)
  'مع السلامة',                 // arabic
  'até logo',                   // portuguese
  'arrivederci',                // italian
  'до свидания',                // russian
  '안녕히 가세요',               // korean
  'अलविदा',                    // hindi
  'tot ziens',                  // dutch
  'do widzenia',                // polish
  'hej då',                     // swedish
  'ha det bra',                 // norwegian
  'farvel',                     // danish
  'näkemiin',                   // finnish
  'αντίο',                      // greek
  'na shledanou',               // czech
  'viszlát',                    // hungarian
  'la revedere',                // romanian
  'довиждане',                  // bulgarian
  'doviđenja',                  // croatian
  'dovidenia',                  // slovak
  'nasvidenje',                 // slovenian
  'head aega',                  // estonian
  'uz redzēšanos',              // latvian
  'iki pasimatymo',             // lithuanian
]

export function pickGoodbye(): string {
  const d = new Date()
  const idx = (d.getDay() * 4 + (d.getHours() % 4)) % GOODBYE_MESSAGES.length
  return GOODBYE_MESSAGES[idx] ?? 'goodbye'
}
```

### Where to call it

In `useScreenNav.ts`, in the `/quit` and `Escape` handlers that call `exit()`:

```typescript
import { pickGoodbye } from '../brand/goodbye.js'

// before exit():
process.stdout.write(pickGoodbye() + '\n')
exit()
```

The write to stdout is fine — Ink is not in raw mode at exit time.

Files: `src/brand/goodbye.ts` (new), `src/hooks/useScreenNav.ts`.

---

## G15 — Error boundary in Router

### Why

If any screen throws an unhandled React error, Ink crashes with a raw stack trace
dumped to the terminal. An error boundary catches it and shows a clean message.

### src/components/ErrorBoundary.tsx (new file)

```typescript
// React error boundary for the Router. Catches render errors in any screen.
// Inputs: children. Outputs: either children or a clean error fallback view.
// Invariant: reset by pressing r, which exits cleanly (user relaunches).

import React from 'react'
import { Box, Text } from 'ink'

interface State {
  error: Error | null
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <Box flexDirection="column" paddingX={2} paddingY={1}>
          <Text color="red" bold>error</Text>
          <Text color="gray" dimColor>{this.state.error.message}</Text>
          <Box marginTop={1}>
            <Text color="gray" dimColor>press ctrl-c to exit and relaunch</Text>
          </Box>
        </Box>
      )
    }
    return this.props.children
  }
}
```

### router.tsx change

Wrap `{renderScreen(current)}` in `<ErrorBoundary>`:

```tsx
import { ErrorBoundary } from './components/ErrorBoundary.js'

// in Router return:
<RouterContext.Provider value={{ screen: current, push, pop, replace }}>
  <ErrorBoundary>
    {renderScreen(current)}
  </ErrorBoundary>
</RouterContext.Provider>
```

Files: `src/components/ErrorBoundary.tsx` (new), `src/router.tsx`.

---

## G14 — Doctor: parse and validate tmux version

### Current behavior

`checkTmux()` returns the raw string `tmux 3.3a` as the detail. No version check.

### Target behavior

Parse the version number and warn if below 3.0 (minimum for `display-popup` and
session-specific env support we may use in future sprints).

```typescript
function checkTmux(): CheckResult {
  try {
    const raw = execSync('tmux -V', { encoding: 'utf8' }).trim()  // keep execSync: safe, no user input
    // raw is e.g. "tmux 3.3a" or "tmux 3.2"
    const match = raw.match(/tmux\s+(\d+)\.(\d+)/)
    if (!match) {
      return { name: 'tmux', status: 'warn', detail: `${raw} (could not parse version)` }
    }
    const major = parseInt(match[1] ?? '0', 10)
    const minor = parseInt(match[2] ?? '0', 10)
    const version = `${major}.${minor}`
    if (major < 3) {
      return { name: 'tmux', status: 'warn', detail: `${raw} — need >=3.0` }
    }
    return { name: 'tmux', status: 'ok', detail: raw }
  } catch {
    return { name: 'tmux', status: 'fail', detail: 'not on PATH (brew install tmux)' }
  }
}
```

Note: `execSync` is kept here (not execFileSync) because `tmux -V` has no user-supplied
input — it is not an injection risk. The audit item B15 fixed the Node version check.
The tmux check was always safe since there is no interpolation.

Files: `src/launcher/doctor.ts` only.

---

## G17 — Light terminal / NO_COLOR mode

### Affected areas

- `Banner.tsx`: uses chalk to build ANSI gradient strings. In NO_COLOR mode the
  chalk calls should be skipped and the art rendered as plain bold text.
- All `<Text color="...">` nodes in screens: these are Ink's own color support and
  use Ink's color-stripping when NO_COLOR is set. Ink 7 respects NO_COLOR natively.
  No changes needed for screen Text nodes.

### src/utils/theme.ts (new file)

```typescript
// Reads NO_COLOR and TERM env to determine if colors are supported.
// Invariant: value computed once at import time, safe to cache.

export const COLOR_ENABLED = !process.env.NO_COLOR && process.env.TERM !== 'dumb'
```

### Banner.tsx change

```typescript
import { COLOR_ENABLED } from '../utils/theme.js'

export function Banner({ ... }) {
  if (compact) { ... }  // unchanged

  if (!COLOR_ENABLED) {
    return (
      <Box flexDirection="column">
        <Text bold>REEVES AGENTS</Text>
      </Box>
    )
  }

  // existing chalk gradient path
  const coloredLines = gradientChars(art, stops).map(line =>
    line.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
  )
  return (
    <Box flexDirection="column">
      {coloredLines.map((line, i) => <Text key={i}>{line}</Text>)}
    </Box>
  )
}
```

Files: `src/utils/theme.ts` (new), `src/components/Banner.tsx`.

---

## Doctor: tmux binding check + execSync cleanup

### Binding check

After `setup-tmux` shipped, doctor should verify the user has run it. Add a new check:

```typescript
function checkTmuxBinding(): CheckResult {
  const conf = join(homedir(), '.tmux.conf')
  try {
    const content = readFileSync(conf, 'utf-8')
    const bound = content.includes('# reevesagents')
    return {
      name: 'tmux binding',
      status: bound ? 'ok' : 'warn',
      detail: bound
        ? 'Prefix+A session picker active'
        : 'not configured — run: reevesagents setup-tmux',
    }
  } catch {
    return {
      name: 'tmux binding',
      status: 'warn',
      detail: 'no ~/.tmux.conf found — run: reevesagents setup-tmux',
    }
  }
}
```

Add to `runDoctor()` checks array. Add `readFileSync` to the fs import.

### execSync cleanup in findOrphans

`findOrphans()` uses `execSync('tmux list-windows -t reevesagents -F "#{window_name}"', ...)`.
This is safe (no user input), but inconsistent with the rest of the codebase. Replace with:

```typescript
const output = execFileSync(
  'tmux', ['list-windows', '-t', TMUX_SESSION, '-F', '#{window_name}'],
  { encoding: 'utf8' }
)
```

Import `execFileSync` alongside `execSync`. After this change, `execSync` is only
used in `checkTmux()` for `tmux -V`, which is intentional (no user input, noted in
spec). Remove the `execSync` import once `findOrphans` is migrated.

Files: `src/launcher/doctor.ts` only.

---

## Execution order within Sprint 3

1. G13 — Spawn progress (trivial, one file)
2. G18 — Name field + validation (one file, small)
3. G9 — Orchestrate attach commands (one file, small)
4. G5 — Home 1-pane last session (one file, one block)
5. G14 — Doctor tmux version parse + binding check + execSync cleanup (one file)
6. G15 — Error boundary (two files)
7. F7 — Goodbye messages (two files)
8. G17 — NO_COLOR mode (two files)

---

## Files touched in Sprint 3

| File | Items |
|---|---|
| `src/screens/Spawn.tsx` | G13, G18 |
| `src/screens/Orchestrate.tsx` | G9 |
| `src/screens/Home.tsx` | G5 |
| `src/launcher/doctor.ts` | G14, binding check, execSync cleanup |
| `src/components/ErrorBoundary.tsx` | G15 (new) |
| `src/router.tsx` | G15 |
| `src/brand/goodbye.ts` | F7 (new) |
| `src/hooks/useScreenNav.ts` | F7 |
| `src/utils/theme.ts` | G17 (new) |
| `src/components/Banner.tsx` | G17 |