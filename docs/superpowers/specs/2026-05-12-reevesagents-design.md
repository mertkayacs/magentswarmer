# reevesagents — Unified Design Document

> Single source of truth. Supersedes `specs/v3-ux-sprint.md`, `specs/v3-sprint2.md`,
> `specs/v3-sprint3.md`, and `specs/v3-audit-2026-05-12.md`.
> Written 2026-05-12 after collaborative design and research session.

---

## 1. Product definition

### What it is

A local TUI spawn manager and session portal for AI coding agents. Three responsibilities:

1. **Configure and launch** — give agents (claude, gemini, codex) the right parameters
   before they start: provider, auth method, task, model, effort, permissions, working
   directory, optional tag.
2. **Watch them** — live status (active / stale), peek at terminal output, project-grouped
   session list, auto-refresh.
3. **Jump in** — attach to any session when you need to intervene or take over.

### What it is not

- Not a notification service. Open the TUI when you want to check.
- Not a message relay. Mid-session message injection via `tmux send-keys` is technically
  incompatible with Ink-based CLIs (raw TTY requirement + stdin disconnected during tool
  execution). If you need to talk to an agent mid-task, attach.
- Not a proxy, not a daemon, not a subscription reseller. Runs entirely on the user's
  machine with the user's own credentials. Spawns official CLI binaries.

### Legal status

Fully permitted under Anthropic/Google/OpenAI ToS. The 2026 enforcement actions targeted
OAuth harnesses routing credentials through backend servers to serve other users. A local
TUI that spawns official CLIs with the owner's own credentials is explicitly allowed.

---

## 2. Technical constraints (research-verified 2026-05-12)

| Feature | Status | Detail |
|---|---|---|
| Diagonal gradient in Ink | ✅ Feasible | Per-char `<Text color={rgb}>`. chalk truecolor works in iTerm2, macOS Terminal, VS Code, tmux (needs `set -as terminal-overrides ",xterm*:Tc"` in `.tmux.conf`) |
| Peek panel via tmux | ✅ Feasible | `capture-pane -p` (no `-e`) returns clean plain text. `execFileSync` every 5s is safe (<10ms, won't block 30fps Ink loop). 15–20 lines stable. |
| 3-pane Ink layout | ✅ Feasible | `flexDirection="row"` + fixed-width sidebars + `flexGrow={1}` center. `useWindowSize` for responsive. Works at 140+ cols. |
| Autocomplete picker | ✅ Feasible | Renders at bottom of content zone, just above command bar. Ink has no z-index — not a true overlay. This is the correct UX pattern. |
| Remote control URL | ⚠️ Use pipe-pane | `tmux pipe-pane -o "cat >> /tmp/<id>.rc.log"` immediately after spawn, then poll file for URL regex. More reliable than timed peek (immune to scroll position, startup variance). |
| Mid-session messages | ❌ Not feasible | Ink requires raw TTY; `tmux send-keys` injects buffered text — incompatible at the architectural level. Stdin disconnected during Claude Code tool execution. Feature request #27441 open, no ETA. |
| Push notifications | ❌ Out of scope | Would require a background daemon. Contradicts on-demand model. |

---

## 3. Visual design system

### Layout standard — 3 zones, all screens

```
┌─ ZONE 1: header (fixed, 1 line) ────────────────────────────┐
│  REEVES AGENTS   /screen-name · context          status info │
├─ ZONE 2: content (flexGrow=1) ───────────────────────────────┤
│  [autocomplete picker — only when cmdMode + cmdValue typed]  │
│                                                              │
│  main content, scrollable                                    │
│                                                              │
├─ ZONE 3: command bar (fixed, 1 line) ────────────────────────┤
│  / type a command, ? for help                                │
└──────────────────────────────────────────────────────────────┘
```

Zone 1 and Zone 3 never scroll away. Zone 2 expands to fill available height.

### Pane breakpoints (usePanes already exists)

| Width | Panes | Layout |
|---|---|---|
| < 90 cols | 1 | single column, no sidebars |
| 90–139 cols | 2 | main content + right context panel (width 40) |
| ≥ 140 cols | 3 | NavSidebar (width 20) + main content + right panel (width 40) |

### Color tokens

| Token | Hex | Use |
|---|---|---|
| primary-blue | `#5a96e0` | command bar `/`, focused cursors, section header accents |
| light-blue | `#7eb8f5` | session IDs, cc provider text |
| pale-blue | `#bae6fd` | gradient endpoint |
| gradient-start | `#3b6ead` | REEVES AGENTS title start |
| active-green | `#4ade80` | ● active status, ✓ success |
| stale-yellow | `#facc15` | ● stale status, gemini provider |
| section-blue | `#4a6fa5` | `── SECTION ──` headers |
| secondary | `#8b949e` | secondary text, labels |
| dim | `#6e7681` | timestamps, less important values |
| structural | `#1e2d3e` | divider lines |
| bg | `#0d1117` | terminal background |
| surface | `#161b22` | raised surfaces (header, cmd bar) |

### Brand title

```
REEVES AGENTS
```
CSS-equivalent: `linear-gradient(to right, #3b6ead, #7eb8f5, #bae6fd)`.
In Ink: per-character chalk.rgb() via the extended `gradientChars()` function.
Bold, letter-spacing ~0.09em equivalent (extra space between chars).

### Section header pattern

```
── SESSIONS ──────────────────────────────────
```
Color: `#4a6fa5`, `letter-spacing: .14em`. Full-width dashes fill to terminal width.

### Session row pattern

```
  ab2x  cc   feature-auth            12m  ● active
```

- Left border: 2px solid, provider color
- Background: `rgba(providerRGB, 0.06)` tint
- ID: `#7eb8f5` bold
- Provider: colored text (cc=`#7eb8f5`, gemini=`#facc15`, codex=`#4ade80`)
- Name/tag: `#c9d1d9`
- Age: `#6e7681`
- Status: active=`#4ade80` bold, stale=`#facc15` bold

### Provider dots

Active/configured:
```
●cc   ●gem   ○codex (→ /settings)
```
Unconfigured providers shown dimmed (`#21262d` dot, gray text) with `(→ /settings)` hint.
In selector fields, left/right arrows skip over unconfigured options and show the hint.

---

## 4. Feature backlog (prioritized, merged)

Items tagged [DONE] are already shipped. All others are open.

### P0 — Already fixed (audit pass, 2026-05-12)

| ID | Item | Status |
|---|---|---|
| B1 | Shell injection in spawn.ts | DONE |
| B2 | start_prompt fire-and-forget timing | DONE |
| B3 | Banner 600-element Ink perf | DONE |
| B4 | CommandBar.tsx dead code | DONE |
| B6 | Store never updated on spawn/orchestrate | DONE |
| B15 | Doctor uses execSync for node version | DONE |
| F12 | `reevesagents attach <id>` CLI subcommand | DONE |
| — | `reevesagents switch` + Prefix+A tmux popup | DONE |

### P1 — Foundation (everything builds on these)

1. **Autocomplete command bar** — `useScreenNav`: add `DEDUPED_ROUTES`, `completions`, `selectedIdx`, Tab/↑↓ cycling, `/quit` alias, `/top` + `/history` routes. Picker renders at bottom of content zone above command bar, visible when `cmdMode && cmdValue.length > 0`. Max 5 rows. Enter navigates.
2. **Pane-responsive layouts on all screens** — wire `usePanes()` everywhere. 1-pane: full width. 2-pane: main + right context panel (40 cols). 3-pane: NavSidebar + main + right panel.
3. **3-zone layout standard** — all screens migrate to fixed header / flexGrow content / fixed command bar.
4. **Banner diagonal gradient** — extend `gradientChars(text, stops, direction)` with `direction: 'diagonal'` using `t = (x/(W-1) + y/(H-1)) / 2`. Render each line as single chalk-colored string (not per-character Ink nodes, for perf).

### P2 — Core daily-driver screens

5. **Home screen redesign** — Option B visuals. Header: gradient title + provider dots (configured glow, unconfigured dim) + session count. Content: `── SESSIONS ──` grouped by `working_dir`, `── PRESETS ──` (if any), `── SHORTCUTS ──`. Wide: right panel shows RECENT sessions.
6. **Spawn form redesign** — `working_dir` as first-class field (defaults to `process.cwd()`). Auth field stays (per-spawn control, legally fine). Unconfigured providers shown dimmed with hint. Remote control toggle. Wide: right panel shows per-field help. Pre-fill from `loadState().last_spawn`. `[ LAUNCH ]` button blue when focused.
7. **Orchestrate form redesign** — Shared config section (provider, auth, goal, effort, permissions, output_dir). Workers section with numbered rows, focused worker gets blue left border + cursor. `+ add worker [tab]`. Wide: right panel shows selected worker bindings. Pre-fill from `loadState().last_orchestrate`. `[ FAN OUT × N ]` button.
8. **Sessions screen redesign** — Sessions grouped by `working_dir`. Peek panel (5s refresh via `setInterval`, plain text, 15 lines). `a` key to attach (switch-client if in tmux, else show hint 4s). `k` to kill. `providerColor()` and `formatAge()` throughout. Auto-refresh 5s.
9. **F5 — Form state persistence** — `Spawn.tsx` and `Orchestrate.tsx` initialize from `loadState().last_spawn` / `loadState().last_orchestrate` instead of `loadConfig()`.
10. **B8 — uniqueWindowName()** — before `tmux new-window`, list existing windows, suffix `-2`/`-3` etc. until free. Prevents silent conflict failures.
11. **G10 — Provider color badges** — replace plain `<Text>{s.provider}</Text>` in Sessions.tsx and Home.tsx with `<Text color={providerColor(s.provider)}>`. Replace inline `age()` with `formatAge()`.

### P3 — New screens

12. **Welcome splash** — 5-second auto-advancing splash. Full-width diagonal-gradient ASCII art (REEVES on one line, AGENTS below). Subtle tagline. Auto-advances to Home; any keypress skips. First-run gate: if no providers configured, route to Settings instead.
13. **History screen** (`/history`) — shows sessions where `ended_at` is set. Columns: ID, provider, name/tag, working_dir, duration (`ended_at - created_at`), ended_at. Sort by ended_at desc. `d` deletes selected entry, `D` wipes all with confirmation. 2-pane: right shows full session JSON.
14. **/top live monitor** — auto-refresh 5s. Columns: ID, provider, name/tag, age, last\_seen, status. `↑↓` select row, `a` attach, `k` kill, `r` force refresh. 2-pane: right shows peek panel of selected session. 3-pane: NavSidebar + list + peek.

### P4 — Power features

15. **NavSidebar component** — `src/components/NavSidebar.tsx`. 3-pane only, width 20. Shows route list with highlighted current screen. Pressing a letter navigates (same as command bar shortcuts). Dim description text per route.
16. **Preset management UI** — In Orchestrate success: `[tab] save as preset` → inline name field → `addPreset()`. In Home: `── PRESETS ──` section lists saved presets. Number key or Enter runs preset using `loadState().last_orchestrate.shared`. `d` to delete preset with confirmation.
17. **Remote control URL surfacing** — In `spawn()`: if `remote_control: true`, immediately run `tmux pipe-pane -o "cat >> /tmp/reeves-<id>.rc.log"`. After 3s, start polling log file every 2s for URL regex `https://claude\.ai/code/session/[A-Za-z0-9_-]+`. Store URL on session record once found (up to 30s timeout). Spawn success view shows URL with `[c] copy` shortcut. Sessions peek panel shows URL if present.
18. **Settings screen redesign** — Per-provider sections (cc / gemini / codex): auth method, API key env var, base_url (visible only when `auth=custom`), default model, default effort, default permissions. Global section: tmux session name (default `reevesagents`), peek refresh interval (default 5s). 2-pane: right shows current raw values.
19. **Spawn success view** — After spawn: session details (id, provider, name, tag, working_dir). `── ATTACH ──` block: tmux attach command + switch-client fallback. Optional `── REMOTE CONTROL ──` block if RC enabled (shows URL or "waiting..."). Action shortcuts: `a` attach now, `c` copy URL (if present), `l` sessions, `esc` back.
20. **F11 — CLI attach hint** — one line in `cli.ts` after `console.log(JSON.stringify(session, null, 2))`: `console.log(\`# attach: tmux attach -t ${session.tmux_session}:${session.tmux_window}\`)`.

### P5 — Type and infrastructure changes

21. **`Session.working_dir: string | null`** — set in `spawn()` from `SpawnRequest.working_dir`. Default `process.cwd()`. Enables project grouping in all list screens.
22. **`Session.ended_at: string | null`** — set by the refresh sweep when `tmux has-session` reports the window is gone. Stamp time of detection. Enables history duration calculation.
23. **`SpawnRequest.working_dir?: string`** — pass through from form to spawn().
24. **`SpawnRequest.remote_control?: boolean`** — triggers pipe-pane setup.
25. **`SpawnFormState.working_dir: string`** — persisted in last_spawn.
26. **`ScreenName` union** — add `'Top'` and `'History'`.
27. **SLASH_ROUTES** — add `/top`, `/history`.

### P6 — Polish (low urgency)

28. **G13 — Spawn progress indicator** — `spawning` state in Spawn.tsx, show `spawning...` while `spawn()` runs.
29. **G18 — Spawn name field + validation** — add `name` field (index 7), validate no spaces/colons/dots, max 30 chars before submit.
30. **G5 — Home last session detail** — show most recent session ID + provider + name below the session count.
31. **G9 — Orchestrate success attach commands** — show tmux attach command per worker in success view.
32. **G15 — Error boundary** — `<ErrorBoundary>` in Router, shows clean error + `r` to restart.
33. **G17 — NO_COLOR / light terminal fallback** — check `chalk.level`, fall back to bold-text-only if `chalk.level < 2`.
34. **G14 — Doctor tmux version parse** — parse version string, warn if below 3.0.
35. **G7 — Goodbye message** — 30-language farewell on exit. Intercept before `process.exit()`.

---

## 5. Screen specifications

### 5.1 Welcome splash

- Renders full-width diagonal-gradient ASCII art for REEVES / AGENTS
- Tagline below: dim gray, centered
- Auto-advances after 5 seconds via `setTimeout(() => push('Home'), 5000)`
- Any keypress cancels timer and advances immediately
- First-run check: if `detectAvailable()` returns zero configured providers, advance to `'Settings'` instead with a hint "no providers configured — set one up to get started"
- On subsequent visits to Welcome (e.g. pressing `h` from Help): skip splash entirely, go directly to Home

### 5.2 Home

**Header:** `REEVES AGENTS` gradient title | provider dots (cc ●, gemini ●, codex ○ dim) | session count | version

**Content zones:**
- `── SESSIONS ──` with project group headers (`~/dev/project-name`) and session rows beneath each
- If no sessions: dim `no sessions running  s spawn  o orchestrate`
- `── PRESETS ──` (only if `loadState().presets.length > 0`) — numbered list, number key or Enter runs, `d` deletes
- `── SHORTCUTS ──` — compact key map row

**Right panel (2+ panes):** `── RECENT ──` — last 5 sessions from `loadState().recent_sessions`, dimmed if ended

**Key bindings:** `s` → Spawn, `o` → Orchestrate, `l` → Sessions, `t` → Top, `d` → Doctor, `h` → Help, `p` → focus Presets, `?` → Help

### 5.3 Spawn form

**Fields (Tab/↑↓ to navigate):**

| # | Field | Type | Notes |
|---|---|---|---|
| 0 | working dir | text | defaults to `process.cwd()`, first-class |
| 1 | provider | selector | cc / gemini / codex. Unconfigured: dimmed + `(→ /settings)`. ← → cycles, skips unconfigured |
| 2 | auth | selector | subscription / api-key / custom. Updates when provider changes |
| 3 | task | text (multiline) | required |
| 4 | effort | selector | — / low / medium / high |
| 5 | permissions | selector | ask / skip |
| 6 | model | text | optional, placeholder "default" |
| 7 | name | text | optional, validated: no spaces/colons/dots, max 30 |
| 8 | tag | text | optional |
| 9 | remote ctrl | toggle | [ off ] / [ on ] |
| 10 | submit | button | `[ LAUNCH ]`, blue when focused |

**Right panel (2+ panes):** per-field contextual help + `(from last spawn)` pre-fill indicator when applicable

**Validation:** task required, name chars validated before submit, error shown inline in red

### 5.4 Spawn success

```
── SESSION ──────────────────────────────
  id          ab2x
  provider    ●cc
  name        cc-feature-auth-1736712341
  working dir ~/dev/reevesagents
  tag         feature-auth

── ATTACH ───────────────────────────────
  tmux attach -t reevesagents:cc-feature-auth-1736712341
  # or: tmux switch-client -t reevesagents:cc-feature-auth-1736712341

── REMOTE CONTROL ───────────────────────   (only if enabled)
  waiting...  /  https://claude.ai/code/session/xK9m...  [c] copy

  a attach now   c copy URL   l sessions   esc back
```

### 5.5 Orchestrate form

**Sections:**
1. `── SHARED CONFIG ──` — provider, auth, goal (multiline text, required), effort, permissions, output_dir
2. `── WORKERS · N ──` — numbered rows. Focused row: blue left border + `›` cursor. Enter edits. Tab adds new worker. `d` deletes focused. Minimum 1 worker required.
3. `[ FAN OUT × N ]` submit button, blue when focused

**Right panel (2+ panes):** focused worker's task context + key bindings reference

**Pre-fill:** from `loadState().last_orchestrate` on mount

### 5.6 Orchestrate success

- Worker rows: ID, provider, name, task excerpt, `● active` status
- `[tab] save as preset` → inline "SAVE AS PRESET" bordered panel, name field pre-filled from tag, Enter saves, Esc skips
- Actions: `t` → /top, `l` → Sessions, `esc` back

### 5.7 Sessions

**Header:** `REEVES AGENTS  /sessions · N active`

**Content:** session rows grouped by `working_dir`. Each group: `── ~/path ──` header then rows. Rows: ID, provider, name/tag, age, status.

**Selected row extras (below selected):** peek panel (15 lines, plain text, refreshes every `settings.peekInterval` seconds). If `rc_url` present: shows URL + `[c] copy`.

**Key bindings:** `↑↓` select, `a` attach (switch-client if in tmux, else hint 4s), `k` kill with confirmation, `r` force refresh, `h` → History

**Auto-refresh:** `setInterval(refresh, 5000)` on mount. Refresh also checks `tmux has-session` per session, stamps `ended_at` on dead ones.

**Right panel (2+ panes):** wider peek panel (20 lines)

### 5.8 History

**Header:** `REEVES AGENTS  /history`

**Content:** dead sessions (ended_at set), sorted by ended_at desc. Grouped by `working_dir`. Columns: ID, provider, name/tag, duration, ended_at.

**Key bindings:** `↑↓` select, `d` delete selected, `D` wipe all (confirmation: "wipe all history? y/n"), `esc` back

**Right panel:** full session JSON (id, provider, task excerpt, working_dir, created_at, ended_at, duration)

### 5.9 /top live monitor

**Header:** `REEVES AGENTS  /top · auto-refresh 5s · N sessions`

**Content:** flat session table (no grouping). Columns: ID, provider, name/tag, working\_dir (truncated), age, last\_seen, status.

**Auto-refresh:** `setInterval(refresh, 5000)` on mount.

**Key bindings:** `↑↓` select, `a` attach, `k` kill, `r` force refresh now

**Right panel (2+ panes):** peek panel for selected session (15 lines, refreshes with main interval)

### 5.10 Switch modal (reevesagents switch)

Floating popup via `tmux display-popup -w 90 -h 20`. Shows session list (ID, provider, name, age, status). Arrow keys navigate, Enter calls `switch-client`, `k` kills, `esc` cancels. Registered as `Prefix+A` via `reevesagents setup-tmux`.

### 5.11 Settings

**Per-provider sections (cc / gemini / codex):**
- auth: subscription / api-key / custom
- key_env: text field (visible when auth = api-key or custom)
- base_url: text field (visible when auth = custom only)
- default_model: text (optional)
- default_effort: selector
- default_permissions: selector

**Global section:**
- tmux session name: text (default `reevesagents`)
- peek refresh interval: selector (3s / 5s / 10s)

**Right panel (2+ panes):** raw config values for the section currently in focus

### 5.12 Doctor

Existing checks. 2-pane: right panel shows fix suggestion for highlighted check (from `DOCTOR_FIXES` map). tmux version check updated to parse version number, warn if < 3.0.

### 5.13 Help

Existing key reference. 2-pane: right panel shows extended description for highlighted binding.

---

## 6. Infrastructure changes summary

### src/state/types.ts

```typescript
// Add to Session:
working_dir: string | null
ended_at: string | null
rc_url: string | null

// Add to SpawnRequest:
working_dir?: string
remote_control?: boolean

// Add to SpawnFormState:
working_dir: string

// Extend ScreenName union:
| 'Top'
| 'History'
```

### src/hooks/useScreenNav.ts

- Add `ROUTE_DESCRIPTIONS` map
- Add `DEDUPED_ROUTES: { primary, alias, screen, description }[]`
- Add `/top` → `'Top'`, `/history` → `'History'`, `/quit` alias → exit
- Add `selectedIdx` state (reset on cmdValue change)
- Tab / ↑ / ↓ update `selectedIdx` when `cmdMode && completions.length > 0`
- Export `completions: DeduplicatedRoute[]` and `selectedIdx`

### src/brand/banner.ts

- Extend `gradientChars(text, stops, direction)` with `direction: 'diagonal'`
- Diagonal: `t = (x / (W-1) + y / (H-1)) / 2`
- Render output as per-line chalk strings (not per-char Ink nodes — keeps element count at ~12)

### src/launcher/spawn.ts

- Accept `working_dir`, `remote_control` from SpawnRequest
- Set `session.working_dir = req.working_dir ?? process.cwd()`
- Add `uniqueWindowName(base)` before `new-window`
- If `remote_control`: immediately call `tmux pipe-pane -o "cat >> /tmp/reeves-<id>.rc.log"`, start polling loop with 2s interval, max 30s, for URL regex
- Call `setLastSpawn(...)` and `addRecentSession(id)` at end

### src/launcher/orchestrate.ts

- Accept `working_dir` in orchestrate config
- Call `setLastOrchestrate(...)` at end

### src/components/NavSidebar.tsx (new)

- Width 20, `flexDirection="column"`
- Route list with current screen highlighted in blue
- Single-char navigation keys shown dim

### All screens

- Autocomplete picker rendered at bottom of Zone 2, above command bar: `<Box flexDirection="column">` containing picker rows, only visible when `cmdMode && cmdValue.length > 0`
- `usePanes()` wired, layout branches on 1 / 2 / 3 return value
- Import `providerColor`, `formatAge` from `src/utils/display.ts`

---

## 7. Dead session detection

The Sessions, Top, and History screens all share the same refresh function pattern:

```typescript
async function refresh() {
  const all = listAll()
  for (const session of all) {
    if (!session.ended_at) {
      try {
        execFileSync('tmux', ['has-session', '-t',
          `${session.tmux_session}:${session.tmux_window}`],
          { stdio: 'ignore' })
      } catch {
        // window gone — stamp ended_at
        updateSession(session.id, { ended_at: new Date().toISOString() })
      }
    }
  }
  setSessions(listAll())
}
```

`updateSession(id, patch)` is a new function in `registry.ts` that merges a partial update
into the existing session JSON file. Lives in `src/state/registry.ts`.

Sessions with `ended_at` set do not appear in Sessions or Top screens. They appear only
in History screen.

---

## 8. What is already shipped

| Feature | Location |
|---|---|
| `reevesagents attach <id>` | `src/cli.ts` |
| `reevesagents switch` (Ink picker) | `src/screens/Switch.tsx` |
| `reevesagents setup-tmux` (Prefix+A) | `src/cli.ts` |
| `providerColor()`, `formatAge()` | `src/utils/display.ts` |
| `addPreset()`, `removePreset()` | `src/state/store.ts` |
| `peek(sessionId, lines)` | `src/launcher/orchestrator.ts` |
| `isStale(session)` | `src/state/registry.ts` |
| `usePanes()` | `src/hooks/usePanes.ts` |
| `detectAvailable()` | `src/launcher/providers.ts` |
