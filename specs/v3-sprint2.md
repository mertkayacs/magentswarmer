> **Superseded.** See `docs/superpowers/specs/2026-05-12-reevesagents-design.md` for the current unified design.

---

# reevesagents v3 — Sprint 2 spec

Sprint 2 items from v3-audit-2026-05-12.md: F1 (/top screen), F12 (attach CLI),
F4 (preset UI), F11 (CLI attach hint). Sprint 1 must be complete and on master before
starting this sprint.

---

## F11 — CLI spawn attach hint (do this first, trivial)

`reevesagents spawn ...` prints a JSON blob. After the JSON block, print one comment
line with the attach command so the user does not have to parse JSON.

```typescript
// in cli.ts, spawn action, after console.log(JSON.stringify(session, null, 2))
console.log(`# attach: tmux attach -t ${session.tmux_session}:${session.tmux_window}`)
```

That is the entire change. One line. Files: `src/cli.ts`.

---

## F1 — /top live monitor screen

### Purpose

A dedicated screen that shows all running sessions at a glance, auto-refreshes every
5 seconds, and supports attach and kill inline. Replaces the need to go to Sessions
and press `r` repeatedly while monitoring a fan-out.

### Columns (one row per session)

```
ID    PROVIDER  NAME/TAG                  AGE    LAST SEEN    STATUS
────────────────────────────────────────────────────────────────────
ab2x  cc        feature-auth              12m    10s ago      active
cd9y  codex     bugfix-race               3m     4m ago       stale
ef1z  gemini    spike-rag                 1h     2s ago       active
```

Column specs:
- **ID**: 4-char session ID, color `#7eb8f5`
- **PROVIDER**: colored badge using `providerColor()` from Sprint 1
- **NAME/TAG**: `session.tag ?? session.name`, max 28 chars, truncated
- **AGE**: time since `created_at`, formatted as `Xs`, `Xm`, `Xh`, `Xd`
- **LAST SEEN**: time since `last_seen_at`, same format + " ago"
- **STATUS**: `active` (green) if last_seen delta < 300s, `stale` (yellow) otherwise.
  Uses `isStale(session)` from registry.ts which has `thresholdS=300` default.

### Keyboard bindings

- `↑` / `↓`: move selected row
- `Enter` or `a`: attach (same logic as Sessions F9 — switch-client if in tmux,
  else show hint for 4s)
- `k`: kill selected session and its tmux window (same pattern as Sessions.tsx)
- `r`: force refresh immediately
- Auto-refresh: `setInterval(refresh, 5000)` on mount, cleared on unmount

### Layout (panes-aware)

1 pane: header row + session rows + command bar.
2+ panes: same but right panel shows full JSON details of the selected session
(pretty-printed, scrollable with up/down when right panel is focused — add `Tab`
to toggle focus between list and detail pane).
3 panes: NavSidebar (from Sprint 1) + list + detail.

### New files and changes

| File | Action |
|---|---|
| `src/screens/Top.tsx` | new |
| `src/state/types.ts` | add `'Top'` to `ScreenName` union |
| `src/hooks/useScreenNav.ts` | add `/top` → `'Top'` to `SLASH_ROUTES` and `DEDUPED_ROUTES` |
| `src/router.tsx` | import `Top`, add `case 'Top': return <Top />` in `renderScreen` |

### Top.tsx structure

```typescript
// Live session monitor. Auto-refreshes every 5s. Arrow keys select, a attaches,
// k kills, r forces refresh.
// Inputs: registry (reads all sessions). Outputs: tabular session list.
// Invariant: refresh interval always cleared on unmount.

export function Top() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop)
  const [sessions, setSessions] = useState<Session[]>([])
  const [rowIdx, setRowIdx] = useState(0)
  const [attachHint, setAttachHint] = useState<string | null>(null)
  const [killing, setKilling] = useState(false)

  const refresh = useCallback(() => {
    const s = listAll()
    setSessions(s)
    setRowIdx(i => Math.min(i, Math.max(0, s.length - 1)))
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const id = setInterval(refresh, 5000)
    return () => clearInterval(id)
  }, [refresh])

  // ... useInput for ↑↓ ark, render table rows ...
}
```

---

## F12 — `reevesagents attach <id>` CLI subcommand — SHIPPED

Already implemented in `src/cli.ts`. Implementation matches the spec below exactly:
exact match first, then prefix match, switch-client if inside tmux, print manual
command otherwise. No further work needed.

---

## reevesagents switch + setup-tmux — SHIPPED

### reevesagents switch

Interactive Ink session picker (`src/screens/Switch.tsx`). Arrow keys navigate, Enter
calls `tmux switch-client -t <session>:<window>` if inside tmux, or prints the manual
attach command as a status line otherwise. Exits cleanly via `onExit` prop.

Registered in `cli.ts` as `reevesagents switch`. Also invoked by the `setup-tmux`
binding (see below) so it runs inside a `display-popup` over whatever window is active.

### reevesagents setup-tmux

Writes a single block to `~/.tmux.conf` (guarded by `# reevesagents` marker):

```
bind-key A display-popup -w 90 -h 20 -E "reevesagents switch"
```

If already inside tmux, reloads the config automatically. Prefix+A then opens the
picker as a floating overlay from anywhere in tmux.

Registered in `cli.ts` as `reevesagents setup-tmux`.

### Design rationale (option 3 — tmux-native)

Rejected: `display-popup` only (fails outside tmux). Rejected: OS terminal spawning
(10+ emulators, no cross-platform npm package exists, fragile).

Chosen: `switch-client` inside tmux, manual command outside. Since tmux is already
required to run agents, the contract is: run the TUI inside tmux. When you switch to
an agent window, the TUI stays alive in its own tmux window. `Prefix+p`/`n` or
`Prefix+[number]` navigates back.

---

### Original F12 spec (for reference)

### Behavior

1. Look up `<id>` in the session registry (exact match first, then prefix match for
   convenience — a user can type `reevesagents attach ab` if only one session starts
   with `ab`).
2. If no match: print error and exit 1.
3. If multiple prefix matches: print all matches and exit 1 (ambiguous).
4. If `process.env.TMUX` is set (already inside a tmux session):
   run `execFileSync('tmux', ['switch-client', '-t', `${tmux_session}:${tmux_window}`])`.
5. If not in tmux but the reevesagents tmux session exists:
   run `execFileSync('tmux', ['attach-session', '-t', tmux_session, ';',
   'select-window', '-t', `${tmux_session}:${tmux_window}`])`.
   Note: this actually requires two separate tmux calls since `;` is a tmux command
   separator, not a shell one. Call attach-session then select-window.
   Actually more correctly: tmux attach-session blocks. Use a different approach:
   Print the attach command and a note that they can also use `tmux switch-client`
   if inside an existing session. This is safer than trying to auto-attach.
6. Fallback for any failure: print the manual command:
   ```
   tmux attach -t reevesagents:<window>
   # or if already in tmux:
   tmux switch-client -t reevesagents:<window>
   ```

### Implementation

Add in `src/cli.ts` after the `kill` command:

```typescript
program
  .command('attach <id>')
  .description('attach to a running session by ID (or ID prefix)')
  .action((id) => {
    const sessions = listSessions()
    // exact match first
    let session = sessions.find(s => s.id === id)
    if (!session) {
      const matches = sessions.filter(s => s.id.startsWith(id))
      if (matches.length === 0) {
        console.error(`session ${id} not found`)
        process.exit(1)
      }
      if (matches.length > 1) {
        console.error(`ambiguous prefix — matches: ${matches.map(s => s.id).join(', ')}`)
        process.exit(1)
      }
      session = matches[0]
    }
    const target = `${session.tmux_session}:${session.tmux_window}`
    if (process.env.TMUX) {
      try {
        execFileSync('tmux', ['switch-client', '-t', target], { stdio: 'ignore' })
        return
      } catch { /* fall through to print */ }
    }
    console.log(`tmux attach -t ${session.tmux_session}`)
    console.log(`# then: tmux select-window -t ${target}`)
    console.log(`# or if already in tmux: tmux switch-client -t ${target}`)
  })
```

Files: `src/cli.ts` only. No new files.

---

## F4 — Preset management UI

### What a preset is

Presets are saved orchestrate configurations: goal, shared provider settings, and the
worker list. They live in `state.presets` (see `src/state/store.ts` — `addPreset`,
`removePreset`, `loadState` are already implemented and tested). There are no spawn
presets — last_spawn already handles the single-session use case.

### User flows

**Saving a preset** (in Orchestrate screen):
After a successful fan-out, the existing success view shows session IDs. Add a row:
```
  [save as preset]
```
When focused (Tab to reach, Enter to activate), prompt for a preset name (inline text
field, pre-filled with the `tag` value). Press Enter to save via `addPreset(name, goal,
workers)`. Show confirmation: "preset '<name>' saved". Esc skips saving.

**Running a preset** (in Home screen):
Add a `PRESETS` section below the SHORTCUTS block. Load presets from `loadState()`.
If no presets: show a dim "no presets saved" line.
If presets exist: list them as `  1  <name>` (numbered). Press the number key or
navigate with arrows and Enter to launch. Launching a preset calls `orchestrate()`
directly with the preset's goal, a generated tag (`${name}-${Date.now().toString(36)}`),
the stored `shared` config (using `loadState().last_orchestrate.shared` as the provider
settings since presets don't store provider info — they only store goal + workers), and
the preset workers.

Wait, looking at the Preset type:
```typescript
export interface Preset {
  name: string
  goal: string
  workers: WorkerEntry[]
}
```

It only stores name, goal, workers — not the shared provider settings. When running a
preset, use `loadState().last_orchestrate.shared` as the provider/auth/model/perms/effort.
This is intentional: shared settings are per-session, not per-preset.

Show a confirmation after launching: "launching <N> workers for '<preset name>'..." then
navigate to Sessions screen.

**Removing a preset** (in Home screen):
While the preset list is focused, press `d` (with a confirmation prompt) to call
`removePreset(name)`.

### File changes

| File | Action |
|---|---|
| `src/screens/Orchestrate.tsx` | add save-as-preset flow in success state |
| `src/screens/Home.tsx` | add PRESETS section, key handlers for run and delete |

No new files. `addPreset` and `removePreset` in store.ts need no changes.

### Home.tsx preset section sketch

```typescript
// in Home(), add to state:
const [presets, setPresets] = useState<Preset[]>([])
const [presetMode, setPresetMode] = useState(false)
const [presetIdx, setPresetIdx] = useState(0)

useEffect(() => {
  setSessions(listSessions())
  setProviders(detectAvailable())
  setPresets(loadState().presets)
}, [])

// in useInput:
if (input === 'p' && !cmdMode && presets.length > 0) {
  setPresetMode(true)
  setPresetIdx(0)
  return
}
if (presetMode) {
  if (key.escape) { setPresetMode(false); return }
  if (key.upArrow) { setPresetIdx(i => Math.max(0, i - 1)); return }
  if (key.downArrow) { setPresetIdx(i => Math.min(presets.length - 1, i + 1)); return }
  if (key.return) {
    const preset = presets[presetIdx]
    if (preset) {
      const shared = loadState().last_orchestrate.shared
      const tag = `${preset.name}-${Date.now().toString(36)}`
      orchestrate(preset.goal, tag, shared, preset.workers)
      push('Sessions')
    }
    return
  }
}
```

Render presets in the PRESETS section. When `presetMode`, highlight `presetIdx` row
in blue. Show `p` shortcut in the SHORTCUTS block (only when presets exist).

---

## RC1 — Remote control URL surfacing (bonus sprint 2 item)

### What

When spawning an agent, optionally send `/remote-control` after startup so the user
gets a mobile-accessible URL without manual steps. Surface the URL in the spawn
success view and Sessions screen.

### Why

Current flow: spawn → tmux attach → type /remote-control → copy URL.
Target flow: tick "remote control" in spawn form → URL appears in success view.

### SpawnRequest change

Add optional field to `SpawnFormState` and `SpawnRequest`:
```typescript
remote_control?: boolean
```

### spawn.ts change

After the `start_prompt` setTimeout block, add a second delayed send-keys:
```typescript
if (req.remote_control) {
  const rcTarget = `${TMUX_SESSION}:${name}`
  setTimeout(() => {
    try {
      execFileSync('tmux', ['send-keys', '-t', rcTarget, '/remote-control', 'Enter'],
        { stdio: 'ignore' })
    } catch { /* window may be gone */ }
  }, INITIAL_PROMPT_DELAY_MS + 3000)  // extra 3s after start_prompt
}
```

### URL extraction (best-effort)

After another 6s, peek the pane and extract the URL:
```typescript
setTimeout(() => {
  const output = peek(sessionId, 30)
  const match = output.match(/https:\/\/claude\.ai\/code\/session_\S+/)
  if (match) {
    // store URL on the Session object or print to a side-channel file
    // for now: write to ~/.reeves/sessions/<id>.rc-url
  }
}, INITIAL_PROMPT_DELAY_MS + 9000)
```

Surface in Spawn success view and Sessions screen as a `<Text color="#5a96e0">{url}</Text>` row.

### Sessions.tsx addition

When a session has a `.rc-url` sidecar file, show it in the peek panel and in the
2-pane detail view. `c` key copies it to clipboard via `pbcopy` (macOS) or `xclip`.

Files: `src/state/types.ts`, `src/launcher/spawn.ts`, `src/screens/Spawn.tsx`,
`src/screens/Sessions.tsx`.