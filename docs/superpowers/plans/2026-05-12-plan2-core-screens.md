# Plan 2 — Core Screen Redesigns

> **For agentic workers:** Use `superpowers:subagent-driven-development` to execute task by task.

**Goal:** Complete the P1 foundation (3-zone layout + `usePanes` on all screens), wire `working_dir` and `uniqueWindowName` into `spawn.ts`, and deliver the P2 screen redesigns: Home, Sessions, Spawn, and Orchestrate.

**Stack:** TypeScript + React 19 + Ink 7 + Node.js 20+. All layout via `Box`/`Text` Ink primitives. No DOM, no CSS, no HTML. ESM throughout (`.js` extensions on all imports).

**Design reference:** `docs/superpowers/specs/2026-05-12-reevesagents-design.md`

---

## File map

| File | Action |
|---|---|
| `src/launcher/spawn.ts` | Modify — `uniqueWindowName()`, set `working_dir` from req |
| `src/screens/Orchestrate.tsx` | Modify — 3-zone layout, `usePanes`, pre-fill from `loadState()` |
| `src/screens/Settings.tsx` | Modify — 3-zone layout, `usePanes` |
| `src/screens/Doctor.tsx` | Modify — 3-zone layout, `usePanes` |
| `src/screens/Help.tsx` | Modify — 3-zone layout, `usePanes` |
| `src/screens/Top.tsx` | Modify — 3-zone layout header |
| `src/screens/History.tsx` | Modify — 3-zone layout header |
| `src/screens/Home.tsx` | Modify — full redesign |
| `src/screens/Sessions.tsx` | Modify — full redesign |
| `src/screens/Spawn.tsx` | Modify — full redesign |

---

## Shared patterns (read before implementing any task)

### 3-zone layout standard

Every screen must use this outer structure:

```tsx
<Box flexDirection="column" paddingX={1}>
  {/* Zone 1: header — never scrolls */}
  <Box marginBottom={1}>
    <Text color="#5a96e0" bold>REEVES AGENTS</Text>
    <Text color="#4a6fa5">  /screen-name · context</Text>
  </Box>

  {/* Zone 2: content — fills available height */}
  <Box flexGrow={1} flexDirection="column">
    {/* main content here */}
    {/* CommandPicker always at bottom of Zone 2, just above Zone 3 */}
    <CommandPicker completions={completions} selectedIdx={selectedIdx} />
  </Box>

  {/* Zone 3: command bar — never scrolls */}
  <Box flexDirection="column">
    {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
    <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
      <Text color="gray">/ </Text>
      <Text>{cmdMode ? cmdValue : ''}</Text>
      {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
    </Box>
  </Box>
</Box>
```

`StatusBar` is removed from all screens — it's redundant once the 3-zone header exists.

### 2-pane split (inside Zone 2)

When `panes >= 2`, split Zone 2 horizontally:

```tsx
<Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
  <Box flexDirection="column" flexGrow={1}>
    {/* main content */}
  </Box>
  {panes >= 2 && (
    <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
      {/* right panel */}
    </Box>
  )}
</Box>
```

### Section header pattern

```tsx
<Text color="#4a6fa5">── SECTION NAME ─────────────────────</Text>
```

Use `'─'.repeat(N)` to fill. When terminal width is available via `useWindowSize()`, make it dynamic: `'─'.repeat(Math.max(0, columns - sectionNameLen - 5))`.

### Provider color dots

```tsx
import { providerColor } from '../utils/display.js'

// In render:
{(['cc', 'codex', 'gemini'] as Provider[]).map(p => (
  <Text key={p} color={providers[p] ? providerColor(p) : '#30363d'}>
    {providers[p] ? '●' : '○'}{p}{'  '}
  </Text>
))}
```

### Inline gradient title

To render "REEVES AGENTS" with the blue gradient as a single line (for screen headers):

```typescript
import chalk from 'chalk'
import { gradientChars, GRADIENT_STOPS } from '../brand/banner.js'

// Compute once, outside render (or useMemo):
const titleStr = gradientChars('REEVES AGENTS', GRADIENT_STOPS, 'horizontal')[0]
  ?.map(({ char, color }) => chalk.bold(chalk.hex(color)(char)))
  .join('') ?? 'REEVES AGENTS'

// In JSX:
<Text>{titleStr}</Text>
```

---

## Task 1: spawn.ts — uniqueWindowName + working_dir

**Files:** `src/launcher/spawn.ts`

### Step 1: Add `uniqueWindowName` helper before `spawn()`

Insert this function after the `buildStartScript` function, before `export function spawn`:

```typescript
function uniqueWindowName(base: string, tmuxSession: string): string {
  let existing: string[] = []
  try {
    const out = execFileSync(
      'tmux', ['list-windows', '-t', tmuxSession, '-F', '#{window_name}'],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )
    existing = out.trim().split('\n').filter(Boolean)
  } catch {
    // session may not exist yet — no conflict possible
    return base
  }
  const names = new Set(existing)
  if (!names.has(base)) return base
  for (let i = 2; i <= 99; i++) {
    const candidate = `${base}-${i}`
    if (!names.has(candidate)) return candidate
  }
  return `${base}-${Date.now()}`
}
```

### Step 2: Use `uniqueWindowName` in `spawn()`

Find the line:
```typescript
  execFileSync('tmux', ['new-window', '-d', '-t', TMUX_SESSION, '-n', name, '-c', workdir], {
```

Replace with:
```typescript
  const windowName = uniqueWindowName(name, TMUX_SESSION)
  execFileSync('tmux', ['new-window', '-d', '-t', TMUX_SESSION, '-n', windowName, '-c', workdir], {
```

Then update all subsequent references to `name` that refer to the tmux window name:

Replace the send-keys line:
```typescript
  execFileSync('tmux', ['send-keys', '-t', `${TMUX_SESSION}:${name}`, `bash ${shellQuote(scriptPath)}`, 'Enter'], {
```
with:
```typescript
  execFileSync('tmux', ['send-keys', '-t', `${TMUX_SESSION}:${windowName}`, `bash ${shellQuote(scriptPath)}`, 'Enter'], {
```

Replace the paste-buffer target in the `setTimeout`:
```typescript
        const target = `${TMUX_SESSION}:${name}`
```
with:
```typescript
        const target = `${TMUX_SESSION}:${windowName}`
```

### Step 3: Set `working_dir` from request

In the `session` object construction, find:
```typescript
    working_dir: null,
```
Replace with:
```typescript
    working_dir: req.working_dir ?? process.cwd(),
```

Also update the `tmux_window` field to use `windowName`:
```typescript
    tmux_session: TMUX_SESSION,
    tmux_window: windowName,
```
(Replace `tmux_window: name` with `tmux_window: windowName`.)

### Step 4: Pass `working_dir` to `setLastSpawn`

In the `setLastSpawn(...)` call at the end, add:
```typescript
    working_dir: req.working_dir ?? process.cwd(),
```

### Step 5: Typecheck and build

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -10
pnpm build 2>&1 | tail -5
```

Expected: 0 errors, successful build.

### Step 6: Commit

```bash
git add src/launcher/spawn.ts
git commit -m "set working_dir in spawn, add uniqueWindowName to prevent conflicts"
```

---

## Task 2: 3-zone layout migration — Orchestrate, Settings, Doctor, Help, Top, History

**Files:** `src/screens/Orchestrate.tsx`, `src/screens/Settings.tsx`, `src/screens/Doctor.tsx`, `src/screens/Help.tsx`, `src/screens/Top.tsx`, `src/screens/History.tsx`

Apply the 3-zone layout standard to each screen without changing content logic.

### 2a: Orchestrate.tsx

Add `usePanes` import and usage. Restructure layout into 3 zones. Add pre-fill from `loadState()`.

**Imports to add:**
```typescript
import { loadState } from '../state/store.js'
import { usePanes } from '../hooks/usePanes.js'
```

**Add `usePanes` call** after `useRouter`:
```typescript
  const panes = usePanes()
```

**Pre-fill from state** — replace the initial state values:

Replace:
```typescript
  const cfg = loadConfig()
  const [goal, setGoal] = useState('')
  const [tag, setTag] = useState('')
  const [provider, setProvider] = useState<Provider>('cc')
  const [auth, setAuth] = useState<Auth>(cfg.providers.cc.auth)
  const [effort, setEffort] = useState<Effort | null>(cfg.providers.cc.default_effort)
  const [permissions, setPermissions] = useState<Permissions>(cfg.providers.cc.default_permissions)
  const [workers, setWorkers] = useState<WorkerEntry[]>([
    { name: 'agent-1', prompt: '' },
    { name: 'agent-2', prompt: '' },
  ])
```
With:
```typescript
  const savedState = loadState()
  const lo = savedState.last_orchestrate
  const [goal, setGoal] = useState(lo.goal)
  const [tag, setTag] = useState(lo.tag)
  const [provider, setProvider] = useState<Provider>(lo.shared.provider)
  const [auth, setAuth] = useState<Auth>(lo.shared.auth)
  const [effort, setEffort] = useState<Effort | null>(lo.shared.effort)
  const [permissions, setPermissions] = useState<Permissions>(lo.shared.permissions)
  const [workers, setWorkers] = useState<WorkerEntry[]>(
    lo.workers.length > 0 ? lo.workers : [{ name: 'agent-1', prompt: '' }, { name: 'agent-2', prompt: '' }]
  )
```

Remove `loadConfig` import (no longer used).

**Restructure the form view return** to 3-zone layout. Replace the form return with:

```tsx
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /orchestrate</Text>
        <Text color="gray" dimColor>  tab/↑↓ nav  ← → select  a add worker  x remove last</Text>
      </Box>

      {/* Zone 2 */}
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
            <Text color="#4a6fa5">── WORKERS ({workers.length}) ─────────────────</Text>
            <Text color="gray" dimColor>  a add  x remove last</Text>
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
              {marker(submitIdx)} [ FAN OUT × {workers.length} ]
            </Text>
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── WORKER {Math.max(0, focusIdx - headerCount() < 0 ? 0 : Math.floor((focusIdx - headerCount()) / 2) + 1)} ──</Text>
            {focusIdx >= headerCount() && focusIdx < submitIdx ? (
              <Box flexDirection="column">
                <Text color="gray" dimColor>worker {Math.floor((focusIdx - headerCount()) / 2) + 1} of {workers.length}</Text>
                <Text color="gray" dimColor>name + prompt define this agent's task</Text>
              </Box>
            ) : (
              <Text color="gray" dimColor>focus a worker field to see context</Text>
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
```

Also update the result view with 3-zone layout:

```tsx
  if (result) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Box marginBottom={1}>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /orchestrate</Text>
        </Box>
        <Box flexGrow={1} flexDirection="column">
          <Text color="green" bold>fanned out {result.length} session{result.length !== 1 ? 's' : ''}</Text>
          <Box marginTop={1} flexDirection="column">
            {result.map(s => (
              <Box key={s.id}>
                <Text color="#7eb8f5">{s.id}</Text>
                <Text color="gray" dimColor>  {s.name}  </Text>
                <Text color="gray">{s.tmux_session}:{s.tmux_window}</Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text color="gray" dimColor>l sessions  t top  esc back</Text>
          </Box>
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>
        <Box flexDirection="column">
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

### 2b: Settings.tsx

Add `usePanes` import and call. Apply 3-zone layout.

**Add imports:**
```typescript
import { usePanes } from '../hooks/usePanes.js'
```

**Add after `useRouter`:**
```typescript
  const panes = usePanes()
```

**Replace return:**

```tsx
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /settings</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── CC (claude) ───────────────────────</Text>
            {selectRow(0, 'auth', AUTHS, ccAuth)}
            {textRow(1, 'key env', ccKeyEnv, 'ANTHROPIC_API_KEY')}
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── CODEX ─────────────────────────────</Text>
            {selectRow(2, 'auth', AUTHS, codexAuth)}
            {textRow(3, 'key env', codexKeyEnv, 'OPENAI_API_KEY')}
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── GEMINI ────────────────────────────</Text>
            {selectRow(4, 'auth', AUTHS, geminiAuth)}
            {textRow(5, 'key env', geminiKeyEnv, 'GEMINI_API_KEY')}
          </Box>

          <Box>
            <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
              {focusIdx === TOTAL_FIELDS - 1 ? '>' : ' '} [ save ]
            </Text>
            {saved && <Text color="green">  saved</Text>}
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── CURRENT VALUES ────────────────────</Text>
            <Text color="gray" dimColor>cc</Text>
            <Text color="gray">  auth  {ccAuth}</Text>
            <Text color="gray">  key   {ccKeyEnv || '(unset)'}</Text>
            <Text color="gray" dimColor>codex</Text>
            <Text color="gray">  auth  {codexAuth}</Text>
            <Text color="gray">  key   {codexKeyEnv || '(unset)'}</Text>
            <Text color="gray" dimColor>gemini</Text>
            <Text color="gray">  auth  {geminiAuth}</Text>
            <Text color="gray">  key   {geminiKeyEnv || '(unset)'}</Text>
          </Box>
        )}
      </Box>

      {/* Zone 3 */}
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>tab to navigate, enter to edit/save</Text>}
        </Box>
      </Box>
    </Box>
  )
```

Remove the `<StatusBar>` import and usage.

### 2c: Doctor.tsx

Add `usePanes` import and call. Apply 3-zone layout.

**Add import:**
```typescript
import { usePanes } from '../hooks/usePanes.js'
```

**Add after `useRouter`:**
```typescript
  const panes = usePanes()
```

**Replace return:**

```tsx
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /doctor</Text>
        <Text color="gray" dimColor>  p prune orphans  r re-run</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {!result && <Text color="gray" dimColor>running checks...</Text>}
          {result && (
            <Box flexDirection="column" marginBottom={1}>
              {result.checks.map(check => (
                <Box key={check.name}>
                  <Text color={statusColor(check.status)}>{statusIcon(check.status)}</Text>
                  <Text> {check.name.padEnd(14)}</Text>
                  <Text color="gray">{check.detail}</Text>
                </Box>
              ))}
              {result.orphans.length > 0 && !pruned && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="yellow">{result.orphans.length} orphan session{result.orphans.length !== 1 ? 's' : ''}</Text>
                  {result.orphans.map((s: Session) => (
                    <Text key={s.id} color="gray" dimColor>  {s.id}  {s.name}</Text>
                  ))}
                  <Text color="gray" dimColor>p to prune</Text>
                </Box>
              )}
              {pruned && <Box marginTop={1}><Text color="green">orphans pruned</Text></Box>}
              {result.orphans.length === 0 && !pruned && (
                <Box marginTop={1}>
                  <Text color={allOk ? 'green' : 'yellow'}>
                    {allOk ? 'all checks passed' : 'some checks need attention'}
                  </Text>
                </Box>
              )}
            </Box>
          )}
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && result && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── FIX HINTS ─────────────────────────</Text>
            <Text color="gray" dimColor">node  needs node 20+</Text>
            <Text color="gray" dimColor">tmux  brew install tmux</Text>
            <Text color="gray" dimColor">providers  install claude/codex/gemini CLI</Text>
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
```

Remove `<StatusBar>` import and usage.

### 2d: Help.tsx

Add `usePanes` import and call. Apply 3-zone layout.

**Add import:**
```typescript
import { usePanes } from '../hooks/usePanes.js'
import { DEDUPED_ROUTES } from '../hooks/useScreenNav.js'
```

Remove the `SLASH_ROUTES` import — use `DEDUPED_ROUTES` instead (cleaner display).

**Add after `useRouter`:**
```typescript
  const panes = usePanes()
```

**Replace return:**

```tsx
  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /help</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── COMMANDS ──────────────────────────</Text>
            {DEDUPED_ROUTES.map(r => (
              <Box key={r.primary}>
                <Text color="#7eb8f5">{r.primary.padEnd(14)}</Text>
                {r.alias ? <Text color="#4a6fa5">{r.alias.padEnd(6)}</Text> : <Text>{'      '}</Text>}
                <Text color="gray" dimColor>{r.description}</Text>
              </Box>
            ))}
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── KEYBOARD ──────────────────────────</Text>
            <Box><Text color="#7eb8f5">{'esc'.padEnd(14)}</Text><Text color="gray">go back</Text></Box>
            <Box><Text color="#7eb8f5">{'?'.padEnd(14)}</Text><Text color="gray">this screen</Text></Box>
            <Box><Text color="#7eb8f5">{'/ + cmd'.padEnd(14)}</Text><Text color="gray">navigate by command</Text></Box>
          </Box>

          <Box flexDirection="column" marginBottom={1}>
            <Text color="#4a6fa5">── HOME SHORTCUTS ────────────────────</Text>
            <Box><Text color="#7eb8f5">{'s'.padEnd(14)}</Text><Text color="gray">spawn</Text></Box>
            <Box><Text color="#7eb8f5">{'o'.padEnd(14)}</Text><Text color="gray">orchestrate</Text></Box>
            <Box><Text color="#7eb8f5">{'l'.padEnd(14)}</Text><Text color="gray">sessions</Text></Box>
            <Box><Text color="#7eb8f5">{'t'.padEnd(14)}</Text><Text color="gray">top monitor</Text></Box>
            <Box><Text color="#7eb8f5">{'d'.padEnd(14)}</Text><Text color="gray">doctor</Text></Box>
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── SESSIONS SHORTCUTS ────────────────</Text>
            <Box><Text color="#7eb8f5">{'↑↓'.padEnd(14)}</Text><Text color="gray">select</Text></Box>
            <Box><Text color="#7eb8f5">{'enter'.padEnd(14)}</Text><Text color="gray">peek output</Text></Box>
            <Box><Text color="#7eb8f5">{'a'.padEnd(14)}</Text><Text color="gray">attach</Text></Box>
            <Box><Text color="#7eb8f5">{'k'.padEnd(14)}</Text><Text color="gray">kill session</Text></Box>
            <Box><Text color="#7eb8f5">{'r'.padEnd(14)}</Text><Text color="gray">refresh</Text></Box>
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
```

Remove `<StatusBar>` import and usage. Remove `SLASH_ROUTES` import.

### 2e: Top.tsx and History.tsx

Replace placeholders with proper 3-zone headers.

**Top.tsx — replace entire file:**

```typescript
// Live session monitor. Auto-refreshes every 5s. Arrow keys select, a attaches,
// k kills, r forces refresh. Full implementation in Plan 3.
// Inputs: session registry. Outputs: tabular session list + peek panel (wide).
// Invariant: refresh interval always cleared on unmount.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function Top() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /top · live session monitor</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <Text color="#6e7681" dimColor>full implementation in plan 3</Text>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      </Box>
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

**History.tsx — replace entire file:**

```typescript
// Session history. Shows ended sessions with duration. d to delete, D to wipe all.
// Full implementation in Plan 3.
// Inputs: session registry (ended_at set). Outputs: history list.
// Invariant: only shows sessions where ended_at is non-null.

import React from 'react'
import { Box, Text } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'

export function History() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /history · session history</Text>
      </Box>
      <Box flexGrow={1} flexDirection="column">
        <Text color="#6e7681" dimColor>full implementation in plan 3</Text>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
      </Box>
      <Box flexDirection="column">
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="#6e7681" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

### Step: Typecheck + test + commit

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -10
pnpm test 2>&1 | tail -5
git add src/screens/Orchestrate.tsx src/screens/Settings.tsx src/screens/Doctor.tsx \
  src/screens/Help.tsx src/screens/Top.tsx src/screens/History.tsx
git commit -m "apply 3-zone layout and usePanes to Orchestrate, Settings, Doctor, Help, Top, History"
```

---

## Task 3: Home screen redesign

**Files:** `src/screens/Home.tsx`

Full replacement. The ASCII banner moves to Welcome; Home gets a compact one-line gradient header.

**Complete new Home.tsx:**

```typescript
// Main hub: gradient header, provider dots, sessions grouped by working_dir, shortcuts.
// Inputs: registry sessions, detectAvailable, loadState. Outputs: dashboard Box.
// Invariant: session list and providers read on mount only; press r to refresh manually.

import React, { useState, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import chalk from 'chalk'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { detectAvailable } from '../launcher/providers.js'
import { listAll as listSessions, read as readSession } from '../state/registry.js'
import { loadState } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import { gradientChars, GRADIENT_STOPS } from '../brand/banner.js'
import type { Provider, Session } from '../state/types.js'

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

export function Home() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [providers, setProviders] = useState<Record<Provider, boolean>>({ cc: false, codex: false, gemini: false })

  useEffect(() => {
    setSessions(listSessions().filter(s => s.ended_at === null))
    setProviders(detectAvailable())
  }, [])

  const titleStr = useMemo(() => {
    const chars = gradientChars('REEVES AGENTS', GRADIENT_STOPS, 'horizontal')[0] ?? []
    return chars.map(({ char, color }) => chalk.bold(chalk.hex(color)(char))).join('')
  }, [])

  const groups = groupByDir(sessions)

  const state = loadState()
  const recentIds = state.recent_sessions.slice(0, 5)
  const recentSessions = recentIds
    .map(id => { try { return readSession(id) } catch { return null } })
    .filter((s): s is Session => s !== null)

  useInput((input) => {
    if (cmdMode) return
    if (input === 's') { push('Spawn'); return }
    if (input === 'o') { push('Orchestrate'); return }
    if (input === 'l') { push('Sessions'); return }
    if (input === 't') { push('Top'); return }
    if (input === 'd') { push('Doctor'); return }
    if (input === 'h') { push('Help'); return }
    if (input === 'r') {
      setSessions(listSessions().filter(s => s.ended_at === null))
      setProviders(detectAvailable())
    }
  }, { isActive: !cmdMode })

  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text>{titleStr}</Text>
        <Text color="gray" dimColor>  </Text>
        {(['cc', 'codex', 'gemini'] as Provider[]).map(p => (
          <Text key={p} color={providers[p] ? providerColor(p) : '#30363d'}>
            {providers[p] ? '●' : '○'}{p}{'  '}
          </Text>
        ))}
        <Text color="gray" dimColor>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {/* Sessions section */}
          <Text color="#4a6fa5">{'── SESSIONS ' + '─'.repeat(dashLen)}</Text>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>  no sessions running  s spawn  o orchestrate</Text>
          ) : (
            groups.map(([dir, groupSessions]) => (
              <Box key={dir} flexDirection="column" marginBottom={0}>
                <Text color="#6e7681" dimColor>  {dir}</Text>
                {groupSessions.map(s => (
                  <Box key={s.id}>
                    <Text color="gray" dimColor>    </Text>
                    <Text color="#7eb8f5">{s.id}</Text>
                    <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                    <Text color="gray" dimColor>  {(s.tag ?? s.name).slice(0, 24)}</Text>
                  </Box>
                ))}
              </Box>
            ))
          )}

          {/* Presets section */}
          {state.presets.length > 0 && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="#4a6fa5">{'── PRESETS ' + '─'.repeat(Math.max(0, dashLen + 1))}</Text>
              {state.presets.map((p, i) => (
                <Box key={p.name}>
                  <Text color="#7eb8f5">  {i + 1}</Text>
                  <Text color="gray" dimColor>  {p.name.padEnd(20)}</Text>
                  <Text color="gray" dimColor>{p.workers.length} workers</Text>
                </Box>
              ))}
            </Box>
          )}

          {/* Shortcuts */}
          <Box marginTop={1}>
            <Text color="#4a6fa5">{'── SHORTCUTS ' + '─'.repeat(Math.max(0, dashLen - 1))}</Text>
          </Box>
          <Box>
            <Text color="#7eb8f5">s</Text><Text color="gray"> spawn  </Text>
            <Text color="#7eb8f5">o</Text><Text color="gray"> orchestrate  </Text>
            <Text color="#7eb8f5">l</Text><Text color="gray"> sessions  </Text>
            <Text color="#7eb8f5">t</Text><Text color="gray"> top  </Text>
            <Text color="#7eb8f5">d</Text><Text color="gray"> doctor  </Text>
            <Text color="#7eb8f5">?</Text><Text color="gray"> help</Text>
          </Box>

          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>

        {panes >= 2 && (
          <Box flexDirection="column" width={40} marginLeft={2} borderStyle="round" borderColor="#1e2d3e" paddingLeft={1} paddingRight={1}>
            <Text color="#4a6fa5">── RECENT ────────────────────────────</Text>
            {recentSessions.length === 0 ? (
              <Text color="gray" dimColor>no recent sessions</Text>
            ) : (
              recentSessions.map(s => (
                <Box key={s.id}>
                  <Text color={s.ended_at ? '#30363d' : '#7eb8f5'}>{s.id}</Text>
                  <Text color={s.ended_at ? '#30363d' : providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                  <Text color={s.ended_at ? '#30363d' : 'gray'} dimColor={!!s.ended_at}>
                    {'  '}{(s.tag ?? s.name).slice(0, 18)}
                  </Text>
                </Box>
              ))
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
          {!cmdMode && <Text color="gray" dimColor>type a command, ? for help</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

### Step: Typecheck + test + commit

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -10
pnpm test 2>&1 | tail -5
git add src/screens/Home.tsx
git commit -m "redesign Home: gradient header, provider dots, sessions by working_dir, recent panel"
```

---

## Task 4: Sessions screen redesign

**Files:** `src/screens/Sessions.tsx`

Full redesign: 3-zone layout, sessions grouped by `working_dir`, dead session detection with auto-refresh every 5s, `a` to attach, `providerColor`/`formatAge`, filter out dead sessions.

**Complete new Sessions.tsx:**

```typescript
// Active session list grouped by working_dir. Auto-refreshes every 5s with dead session detection.
// Arrow keys select, enter peeks, a attaches, k kills, r forces refresh.
// Inputs: registry (all sessions), tmux (has-session check, capture-pane for peek).
// Invariant: only sessions with ended_at === null shown; refresh interval cleared on unmount.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { listAll as listSessions, updateSession } from '../state/registry.js'
import { providerColor, formatAge } from '../utils/display.js'
import { peek } from '../launcher/peek.js'
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

function flatIndex(groups: Array<[string, Session[]]>, session: Session): number {
  let i = 0
  for (const [, groupSessions] of groups) {
    for (const s of groupSessions) {
      if (s.id === session.id) return i
      i++
    }
  }
  return 0
}

function sessionAtFlatIndex(groups: Array<[string, Session[]]>, idx: number): Session | null {
  let i = 0
  for (const [, groupSessions] of groups) {
    for (const s of groupSessions) {
      if (i === idx) return s
      i++
    }
  }
  return null
}

export function Sessions() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { columns } = useWindowSize()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx: cmdPickerIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [peekContent, setPeekContent] = useState<string | null>(null)
  const [attachHint, setAttachHint] = useState('')

  const refresh = useCallback(() => {
    const all = listSessions()
    for (const s of all) {
      if (!s.ended_at) {
        try {
          execFileSync('tmux', ['has-session', '-t', `${s.tmux_session}:${s.tmux_window}`], { stdio: 'ignore' })
        } catch {
          updateSession(s.id, { ended_at: new Date().toISOString() })
        }
      }
    }
    const alive = listSessions().filter(s => s.ended_at === null)
    setSessions(alive)
    setSelectedIdx(i => Math.min(i, Math.max(0, alive.length - 1)))
    setPeekContent(null)
  }, [])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 5000)
    return () => clearInterval(interval)
  }, [refresh])

  const groups = groupByDir(sessions)
  const totalSessions = sessions.length
  const selected = sessionAtFlatIndex(groups, selectedIdx)

  useInput((input, key) => {
    if (cmdMode) return

    if (key.upArrow) {
      setSelectedIdx(i => Math.max(0, i - 1))
      setPeekContent(null)
      return
    }
    if (key.downArrow) {
      setSelectedIdx(i => Math.min(totalSessions - 1, i + 1))
      setPeekContent(null)
      return
    }
    if (key.return && selected) {
      setPeekContent(peek(selected.id, 15))
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
        setAttachHint(`tmux attach -t ${selected.tmux_session}  (then: select-window -t ${target})`)
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

  const dashLen = Math.max(0, (columns ?? 80) - 14)

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Zone 1 */}
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>REEVES AGENTS</Text>
        <Text color="#4a6fa5">  /sessions</Text>
        <Text color="gray" dimColor>  {sessions.length} active  ↑↓ select  enter peek  a attach  k kill  r refresh</Text>
      </Box>

      {/* Zone 2 */}
      <Box flexGrow={1} flexDirection={panes >= 2 && peekContent !== null ? 'row' : 'column'}>
        <Box flexDirection="column" flexGrow={1}>
          {sessions.length === 0 ? (
            <Text color="gray" dimColor>no active sessions — s to spawn one</Text>
          ) : (
            groups.map(([dir, groupSessions]) => (
              <Box key={dir} flexDirection="column" marginBottom={0}>
                <Text color="#4a6fa5">{'── ' + dir + ' ' + '─'.repeat(Math.max(0, dashLen - dir.length - 1))}</Text>
                {groupSessions.map(s => {
                  const flatIdx = flatIndex(groups, s)
                  const isSelected = flatIdx === selectedIdx
                  return (
                    <Box key={s.id} paddingLeft={isSelected ? 0 : 2}>
                      {isSelected && <Text color="#5a96e0" bold>{'> '}</Text>}
                      <Text color={isSelected ? '#7eb8f5' : 'gray'} bold={isSelected}>{s.id}</Text>
                      <Text color={providerColor(s.provider)}>  {s.provider.padEnd(6)}</Text>
                      <Text color={isSelected ? 'white' : 'gray'}>  {(s.tag ?? s.name).slice(0, 22).padEnd(22)}</Text>
                      <Text color="#6e7681" dimColor>  {formatAge(s.created_at)}</Text>
                    </Box>
                  )
                })}
              </Box>
            ))
          )}

          {attachHint !== '' && (
            <Box marginTop={1}>
              <Text color="yellow">{attachHint}</Text>
            </Box>
          )}

          <CommandPicker completions={completions} selectedIdx={cmdPickerIdx} />
        </Box>

        {peekContent !== null && (
          <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="gray"
            paddingLeft={1}
            paddingRight={1}
            marginLeft={panes >= 2 ? 2 : 0}
            marginTop={panes < 2 ? 1 : 0}
            flexGrow={panes >= 2 ? 1 : 0}
          >
            <Text color="gray" dimColor>{selected?.name ?? ''}  (last 15 lines)</Text>
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
          {!cmdMode && <Text color="gray" dimColor>type a command</Text>}
        </Box>
      </Box>
    </Box>
  )
}
```

### Step: Typecheck + test + commit

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -10
pnpm test 2>&1 | tail -5
git add src/screens/Sessions.tsx
git commit -m "redesign Sessions: grouped by working_dir, dead session detection, attach key, 5s refresh"
```

---

## Task 5: Spawn form redesign

**Files:** `src/screens/Spawn.tsx`

Add `working_dir` as field 0, pre-fill from `loadState().last_spawn`, add right panel contextual help, apply 3-zone layout.

**Field index changes:**
- 0 = working_dir (new, text)
- 1 = provider (was 0)
- 2 = auth (was 1)
- 3 = task (was 2)
- 4 = effort (was 3)
- 5 = permissions (was 4)
- 6 = model (was 5)
- 7 = tag (was 6)
- 8 = submit (was 7)

`TOTAL_FIELDS = 9`, `TEXT_FIELDS = [0, 3, 6, 7]`

**Complete new Spawn.tsx:**

```typescript
// Spawn a single agent session. Form with working_dir/provider/auth/task/effort/permissions/model/tag.
// Inputs: form state (pre-filled from loadState().last_spawn). Outputs: Session on submit.
// Invariant: useScreenNav disabled while a text field is being edited.

import React, { useState, useMemo } from 'react'
import { Box, Text, useInput, useWindowSize } from 'ink'
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

// Field indices
const TOTAL_FIELDS = 9
const TEXT_FIELDS = [0, 3, 6, 7] // working_dir, task, model, tag

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
  const { columns } = useWindowSize()
  const [focusIdx, setFocusIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [result, setResult] = useState<Session | null>(null)
  const [error, setError] = useState('')

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
            <Text color={value === opt ? providerColor(opt as Provider) || '#7eb8f5' : 'gray'} bold={value === opt}>{labelFn(opt)}</Text>
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
        </Box>
        <Box flexGrow={1} flexDirection="column">
          <Text color="#4a6fa5">── SESSION ─────────────────────────────</Text>
          <Box><Text color="gray" dimColor>  id          </Text><Text color="#7eb8f5">{result.id}</Text></Box>
          <Box><Text color="gray" dimColor>  provider    </Text><Text color={providerColor(result.provider)}>●{result.provider}</Text></Box>
          <Box><Text color="gray" dimColor>  name        </Text><Text>{result.name}</Text></Box>
          {result.working_dir && <Box><Text color="gray" dimColor>  working dir </Text><Text color="gray">{result.working_dir.replace(homedir(), '~')}</Text></Box>}
          {result.tag && <Box><Text color="gray" dimColor>  tag         </Text><Text>{result.tag}</Text></Box>}
          <Box marginTop={1}>
            <Text color="#4a6fa5">── ATTACH ──────────────────────────────</Text>
          </Box>
          <Text color="gray" dimColor>  tmux attach -t {result.tmux_session}</Text>
          <Text color="gray" dimColor>  tmux switch-client -t {result.tmux_session}:{result.tmux_window}</Text>
          <Box marginTop={1}>
            <Text color="gray" dimColor>a attach now  l sessions  esc back</Text>
          </Box>
          <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        </Box>
        <Box flexDirection="column">
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
```

Note: The `homedir()` call in the result view needs the import at the top:
```typescript
import { homedir } from 'node:os'
```

Also, for `selectRow` with provider, the color logic needs a guard since `providerColor` expects a `Provider` type but options include strings. Replace the color expression in `selectRow`:
```typescript
<Text color={value === opt ? (opt === 'cc' || opt === 'codex' || opt === 'gemini' ? providerColor(opt as Provider) : '#7eb8f5') : 'gray'} bold={value === opt}>
```

### Step: Typecheck + test + commit

```bash
pnpm typecheck 2>&1 | grep "error TS" | head -10
pnpm test 2>&1 | tail -5
git add src/screens/Spawn.tsx
git commit -m "redesign Spawn: working_dir field, pre-fill from last state, right panel help, 3-zone layout"
```

---

## Final: full test suite + build

```bash
pnpm test 2>&1 | tail -10
pnpm typecheck 2>&1 | grep "error TS" | wc -l
pnpm build 2>&1 | tail -5
```

Expected: all tests pass, 0 TypeScript errors, successful build.

---

## Self-review checklist

| Spec requirement | Task |
|---|---|
| working_dir set in spawn() from req | Task 1 |
| uniqueWindowName prevents conflicts | Task 1 |
| 3-zone layout on all screens | Tasks 2–5 |
| usePanes() on all screens | Tasks 2–5 |
| Sessions grouped by working_dir | Tasks 3, 4 |
| Dead session detection (ended_at stamp) | Task 4 |
| `a` attach key in Sessions | Task 4 |
| 5s auto-refresh with clearInterval on unmount | Task 4 |
| providerColor + formatAge in Sessions | Task 4 |
| Home gradient header + provider dots | Task 3 |
| Home RECENT right panel | Task 3 |
| Spawn working_dir field (field 0) | Task 5 |
| Spawn pre-fill from loadState().last_spawn | Task 5 |
| Spawn right panel contextual help | Task 5 |
| Orchestrate pre-fill from loadState() | Task 2a |
| CommandPicker in Zone 2, not Zone 3 | All tasks |
| StatusBar removed | Tasks 2–5 |

**Not in Plan 2 (Plan 3/4):**
- Welcome splash animation + auto-advance
- Top full implementation
- History full implementation
- NavSidebar
- Remote control URL
- Settings full redesign (base_url, default_model, global section)
- Spawn success: attach key + copy URL shortcut
