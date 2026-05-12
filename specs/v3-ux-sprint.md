> **Superseded.** See `docs/superpowers/specs/2026-05-12-reevesagents-design.md` for the current unified design.

---

# reevesagents v3 — UX sprint spec

Design spec for the sprint covering CC-like feel, pane-responsive layouts, and
autocomplete command bar. Written 2026-05-12 after first-run audit.

---

## Goals

1. The app should feel as polished as Claude Code's TUI: command palette, autocomplete,
   responsive layout, consistent key bindings throughout.
2. Every screen must make use of available terminal width — 1/2/3 pane breakpoints.
3. The bottom command bar must autocomplete as the user types.
4. Sprint 1 bug fixes from v3-audit-2026-05-12.md must land in the same pass.

---

## 1. Autocomplete command bar

### Current state

Every screen renders a static input box:

```
╭──────────────────────────────────────╮
│ / type a command, ? for help         │
╰──────────────────────────────────────╯
```

During cmdMode, the user types blindly and presses Enter. No feedback until the route
resolves or fails.

### Target behavior

While typing after `/`, render a compact picker above the input that filters SLASH_ROUTES
by prefix on either the full name or the short alias:

```
  ○ /sessions  l   — view all running sessions
  ● /settings  cfg — configure providers          ← highlighted
╭──────────────────────────────────────╮
│ / s█                                 │
╰──────────────────────────────────────╯
```

Rules:
- Show at most 5 rows.
- Filter: `key.startsWith('/' + cmdValue)`, matching on primary keys. Deduplicate: one
  row per unique ScreenName. Primary key is the longer form; alias shown next to it.
- Highlighted row (selectedIdx) starts at 0. Tab / ↓ moves down, ↑ moves up, cycling.
- Enter navigates to highlighted row's ScreenName (or first match if list is empty).
- If cmdValue is empty, show no picker (avoid overwhelming the screen on `/` keypress).
- Backspace removing the last `/` char exits cmdMode and hides picker.
- Escape hides picker and exits cmdMode.

Route table (canonical form, alias, description):

| route         | alias | description                        |
|---------------|-------|------------------------------------|
| /home         | /h    | go to home screen                  |
| /spawn        | /s    | spawn a single agent               |
| /orchestrate  | /o    | fan out multiple agents            |
| /sessions     | /l    | view all running sessions          |
| /settings     | /cfg  | configure providers                |
| /doctor       | /d    | run health checks                  |
| /help         | —     | keyboard reference                 |
| /quit         | /q    | exit                               |

### Implementation notes

`useScreenNav.ts` is the single source of truth. Changes needed:
- Add `ROUTE_DESCRIPTIONS` map alongside `SLASH_ROUTES`.
- Add `DEDUPED_ROUTES`: array of `{ primary, alias, screen, description }` derived
  once at module level, ordered by primary name.
- Add `selectedIdx` state in `useScreenNav`, reset to 0 whenever `cmdValue` changes.
- Tab / ↑ / ↓ update `selectedIdx` when `cmdMode && completions.length > 0`.
- Return `completions: DeduplicatedRoute[]` and `selectedIdx` from the hook.
- Each screen: render the picker as a `<Box flexDirection="column">` immediately above
  the existing command bar box. Picker is only visible when `cmdMode && cmdValue.length > 0`.

The picker must be visible across ALL screens that use `useScreenNav`. Screens that
currently hard-code the command bar box should not need large changes — only the
rendering of the picker above the box is new.

---

## 2. Pane-responsive layouts

`usePanes()` already returns 1, 2, or 3. Breakpoints: < 90 = 1, 90-139 = 2, >= 140 = 3.

### Layout skeleton

**1 pane (< 90 cols):** single column. Header → content → picker (if open) → command
bar → status bar. No sidebars. Full width.

**2 panes (90-139 cols):** `<Box flexDirection="row">` at the top level of each screen.
- Left: `<Box flexGrow={1}>` main content.
- Right: `<Box width={40} flexShrink={0} marginLeft={2}>` contextual panel.

**3 panes (>= 140 cols):** same as 2 panes but with a left nav sidebar prepended.
- Nav sidebar: `<Box width={18} flexShrink={0} marginRight={2} flexDirection="column">`.
  Lists every screen with shortcut, current screen highlighted in `#5a96e0` bold.
- Center: same as 2-pane left.
- Right: same as 2-pane right.

Nav sidebar example rendering:

```
  home    h
> spawn   s
  orchest o
  session l
  setting cfg
  doctor  d
  help    ?
```

Extract to `src/components/NavSidebar.tsx`. Props: `current: ScreenName`. Reads
`DEDUPED_ROUTES` from `useScreenNav`. Only rendered when `panes === 3`.

### Per-screen right panels

**Home (2+ panes):** right = last 5 recent sessions from `loadState().recent_sessions`.
Show each as: `id  provider  tag/name`. "press l to see all" at bottom.
Home already has a partial 2-pane SESSIONS column — replace it with recent_sessions
from state rather than a live registry read.

**Spawn (2+ panes):** right = field-level contextual help for the currently focused
field index. Use a `FIELD_HELP` constant in Spawn.tsx:

```typescript
const FIELD_HELP: Record<number, { title: string; body: string }> = {
  0: { title: 'provider', body: 'cc = Claude Code\ncodex = OpenAI Codex\ngemini = Google Gemini CLI' },
  1: { title: 'auth', body: 'subscription = max plan, no key\napi-key = key from env\ncustom = custom base URL + key' },
  2: { title: 'task', body: 'The start prompt sent to the agent after launch. Be specific.' },
  3: { title: 'effort', body: 'Token budget: low ~4k, medium ~16k, high ~32k.' },
  4: { title: 'permissions', body: 'skip = --dangerously-skip-permissions\nask = interactive approvals' },
  5: { title: 'model', body: 'Leave blank for provider default.\nExamples: claude-opus-4-7, gpt-4o' },
  6: { title: 'tag', body: 'Optional label for grouping related sessions.\nExamples: feature-auth, bugfix-#42' },
  7: { title: '[spawn]', body: 'Press enter to launch. A tmux window\nnamed after the tag (or provider-id)\nwill open.' },
}
```

Render right panel as a bordered box with title + body text.

**Orchestrate (2+ panes):** right = compact list of entered worker names and first
20 chars of their prompts. Helps the user see their fan-out plan at a glance while
filling in fields. "N workers" header.

**Sessions (2+ panes):** already implemented. Keep. In 3-pane mode, use the extra
width to show the peek output wider.

**Settings (2+ panes):** right = current raw config values for the provider selected
in the left panel. Show as a list of `key  value` pairs from the loaded config.

**Doctor (2+ panes):** right = fix suggestion text for the check currently highlighted.
Add a `DOCTOR_FIXES` map in doctor-related screen file:

```typescript
const DOCTOR_FIXES: Record<string, string> = {
  tmux: 'brew install tmux',
  providers: 'Install missing CLIs:\n  brew install claude / codex / gemini',
  'state dir': 'Will be created automatically on first spawn.',
}
```

**Help (2+ panes):** right = full keybinding reference. The existing Help screen can
move its key reference table to the right panel and use left for a longer intro.

---

## 3. Sprint 1 bug fixes (from v3-audit-2026-05-12.md)

These must land in the same sprint as the UX work.

### F5 — Form state persistence

Spawn.tsx and Orchestrate.tsx must initialize from `loadState()` instead of `loadConfig()`.

Spawn.tsx change:
```typescript
// Replace:
const cfg = loadConfig()
const [provider, setProvider] = useState<Provider>('cc')
const [auth, setAuth] = useState<Auth>(cfg.providers.cc.auth)
// ...

// With:
const ls = loadState().last_spawn
const [provider, setProvider] = useState<Provider>(ls.provider)
const [auth, setAuth] = useState<Auth>(ls.auth)
const [task, setTask] = useState(ls.prompt)
const [effort, setEffort] = useState(ls.effort)
const [permissions, setPermissions] = useState(ls.permissions)
const [model, setModel] = useState(ls.model ?? '')
const [tag, setTag] = useState(ls.tag ?? '')
```

Orchestrate.tsx: same pattern using `loadState().last_orchestrate` for goal, tag,
shared fields, and the first worker entry.

### F6 — Sessions auto-refresh

In Sessions.tsx, add after the existing `useEffect(() => { refresh() }, [refresh])`:
```typescript
useEffect(() => {
  const id = setInterval(refresh, 5000)
  return () => clearInterval(id)
}, [refresh])
```

### F9 — Attach from TUI

**CLI-level attach is already shipped.** `reevesagents switch` (src/screens/Switch.tsx)
is a standalone Ink session picker that calls `tmux switch-client` inside tmux or prints
the manual attach command otherwise. `reevesagents attach [id]` does the same from the
command line. Both are registered in cli.ts.

Remaining work for this item: wire the `a` key inside the Sessions screen so users
can attach without leaving the TUI to a shell.

In Sessions.tsx, add `a` key binding in `useInput`:
```typescript
if (input === 'a' && selected) {
  if (process.env.TMUX) {
    try {
      execFileSync('tmux', ['switch-client', '-t', `${selected.tmux_session}:${selected.tmux_window}`], { stdio: 'ignore' })
    } catch { /* window gone */ }
  } else {
    setAttachHint(`tmux attach -t ${selected.tmux_session}:${selected.tmux_window}`)
    setTimeout(() => setAttachHint(null), 4000)
  }
  return
}
```

Add `const [attachHint, setAttachHint] = useState<string | null>(null)` to the component.
Render `attachHint` in the status area between the list and the command bar when non-null.
Update hint text in key hint row: `  a attach`.

### B8 — Window name conflict detection

In `spawn.ts`, before `execFileSync('tmux', ['new-window', ...])`:
```typescript
function uniqueWindowName(base: string): string {
  let candidate = base
  let suffix = 2
  while (true) {
    try {
      execFileSync('tmux', ['list-windows', '-t', TMUX_SESSION, '-F', '#{window_name}'],
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] })
        .split('\n')
        // ... check if candidate is in that list
    } catch { break }
    candidate = `${base}-${suffix++}`
  }
  return candidate
}
```

Full implementation: `execFileSync` list-windows, split by newline into a Set, loop
until candidate is not in the Set. Cap at suffix 99 to prevent infinite loop.

---

## 4. Provider color badges (G10)

**`src/utils/display.ts` is already created.** It contains:

```typescript
export function providerColor(p: Provider): string { ... }
export function formatAge(isoDate: string): string { ... }
```

`formatAge` was added at implementation time (not in original spec) and is already used
in `src/screens/Switch.tsx`. The spec only called for `providerColor` but both helpers
belong in this file.

Remaining work: replace plain `<Text>{s.provider}</Text>` in Sessions.tsx and Home.tsx
with `<Text color={providerColor(s.provider)}>{s.provider}</Text>`.
Also replace the inline `age()` helper in Sessions.tsx with `formatAge` from display.ts.

---

## 5. Files to create or modify

| File | Action |
|---|---|
| `src/hooks/useScreenNav.ts` | add ROUTE_DESCRIPTIONS, DEDUPED_ROUTES, completions, selectedIdx |
| `src/components/NavSidebar.tsx` | new — 3-pane nav sidebar |
| `src/utils/display.ts` | done — providerColor() + formatAge(); used in Switch.tsx |
| `src/screens/Home.tsx` | 3-pane layout, recent sessions from state |
| `src/screens/Spawn.tsx` | 2/3-pane layout, field help right panel, F5 |
| `src/screens/Orchestrate.tsx` | 2/3-pane layout, worker preview right panel, F5 |
| `src/screens/Sessions.tsx` | F6 auto-refresh, F9 attach, 3-pane wider peek |
| `src/screens/Settings.tsx` | 2/3-pane layout, config values right panel |
| `src/screens/Doctor.tsx` | 2/3-pane layout, fix hints right panel |
| `src/screens/Help.tsx` | 2/3-pane layout, reference table right panel |
| `src/launcher/spawn.ts` | B8 unique window name |
| All screens | render autocomplete picker above command bar |