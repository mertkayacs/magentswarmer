# reevesagents — Master Checklist

Single source of truth for what is done, in progress, and still needed.
Updated: 2026-05-12.

Legend: ✅ done · ⬜ open · 🔲 plan written, not executed · 📝 plan not yet written

---

## 1. Documents

| Document | Status |
|---|---|
| `docs/superpowers/specs/2026-05-12-reevesagents-design.md` | ✅ Complete, single source of truth |
| `docs/superpowers/plans/2026-05-12-plan1-foundation.md` | ✅ Written and fully executed |
| `docs/superpowers/plans/2026-05-12-plan2-core-screens.md` | 🔲 Written, not yet executed |
| Plan 3 — New Screens | 🔲 Written, not yet executed |
| Plan 4 — Power Features | 🔲 Written, not yet executed |
| Plan 5 — Polish | 🔲 Written, not yet executed |
| Distribution strategy | ✅ Decided: npm primary, Homebrew tap secondary |

---

## 2. Feature backlog

### P0 — Audit fixes (all done)

- ✅ B1 Shell injection in spawn.ts
- ✅ B2 start_prompt fire-and-forget timing
- ✅ B3 Banner 600-element Ink perf
- ✅ B4 CommandBar.tsx dead code removed
- ✅ B6 Store never updated on spawn/orchestrate
- ✅ B15 Doctor node version via subprocess
- ✅ F12 `reevesagents attach <id>` CLI subcommand
- ✅ `reevesagents switch` + Prefix+A tmux popup binding

### P1 — Foundation

- ✅ Autocomplete command bar (DEDUPED_ROUTES, completions, selectedIdx, Tab/↑↓)
- ✅ Banner diagonal gradient (direction param in gradientChars)
- 🔲 Pane-responsive layouts on all screens (Plan 2)
- 🔲 3-zone layout standard (fixed header / flexGrow content / fixed command bar) on all screens (Plan 2)

### P2 — Core screens

- 🔲 Home screen redesign (Plan 2 Task 3)
- 🔲 Spawn form redesign (Plan 2 Task 5)
- 🔲 Orchestrate form redesign (Plan 2 Task 2a)
- 🔲 Sessions screen redesign (Plan 2 Task 4)
- 🔲 F5 Form state persistence (pre-fill from loadState().last_spawn / last_orchestrate) (Plan 2)
- 🔲 B8 uniqueWindowName() in spawn.ts (Plan 2 Task 1)
- 🔲 G10 Provider color badges in Sessions + Home (Plan 2)

### P3 — New screens

- 📝 Welcome splash (5s auto-advance, diagonal gradient art, first-run gate)
- 📝 History screen — full implementation (filter ended_at, sort, duration, delete)
- 📝 /top live monitor — full implementation (flat table, auto-refresh, peek panel)

### P4 — Power features

- 📝 NavSidebar component (3-pane only, width 20, route list, current screen highlighted)
- 📝 Preset management UI (save after orchestrate, run from Home, delete)
- 📝 Remote control URL surfacing (pipe-pane, poll log, show in spawn success + sessions peek)
- 📝 Settings screen redesign (base_url, default_model, default_effort, global section)
- 📝 Spawn success view (session details block, ATTACH block, RC block, a/c/l/esc)
- 📝 F11 CLI attach hint (comment line after JSON output in cli.ts)

### P5 — Infrastructure (types + spawn.ts)

- ✅ Session.working_dir, ended_at, rc_url
- ✅ SpawnRequest.working_dir, remote_control
- ✅ SpawnFormState.working_dir
- ✅ ScreenName: 'Top', 'History'
- ✅ SLASH_ROUTES: /top, /history, /quit
- ✅ updateSession() in registry.ts
- ✅ providerColor(), formatAge() in utils/display.ts
- ✅ peek() in launcher/peek.ts
- 🔲 uniqueWindowName() helper (Plan 2 Task 1)
- 🔲 working_dir set from SpawnRequest in spawn() (Plan 2 Task 1)
- 📝 RC URL pipe-pane polling in spawn() (Plan 4)

### P6 — Polish

- 📝 G13 Spawn progress indicator ("spawning..." state)
- 📝 G18 Spawn name field validation (no spaces/colons/dots, max 30 chars)
- 📝 G5 Home last session detail (ID + provider + name below count)
- 📝 G9 Orchestrate success: attach commands per worker
- 📝 G15 Error boundary in Router (clean error + r to restart)
- 📝 G17 NO_COLOR / light terminal fallback (chalk.level < 2)
- 📝 G14 Doctor tmux version parse (warn if < 3.0)
- 📝 G7 Goodbye message (30-language farewell on exit)

---

## 3. Screen completion

### Welcome splash
- 📝 Full-width diagonal gradient ASCII art (REEVES / AGENTS)
- 📝 Tagline, dim gray, centered
- 📝 Auto-advance to Home after 5s
- 📝 Any keypress cancels timer and advances immediately
- 📝 First-run gate: no configured providers → Settings with hint
- 📝 Repeat visits: skip splash, go directly to Home

### Home
- 🔲 Gradient title line (chalk per-char from gradientChars)
- 🔲 Provider dots (configured = colored glow, unconfigured = dim ○ + "(→ /settings)")
- 🔲 Session count in header
- 🔲 SESSIONS section grouped by working_dir
- 🔲 Empty state: "no sessions running  s spawn  o orchestrate"
- 🔲 PRESETS section (only if presets exist — numbered, Enter/number runs, d deletes)
- 🔲 SHORTCUTS section compact key row
- 🔲 Right panel (2+ panes): RECENT — last 5 sessions, dimmed if ended
- 🔲 Key bindings: s/o/l/t/d/h/?/r

### Spawn form
- 🔲 working_dir field (index 0, defaults to process.cwd())
- 🔲 provider selector (dimmed if unconfigured, ← → skips over them)
- 🔲 auth selector
- 🔲 task text (required)
- 🔲 effort selector
- 🔲 permissions selector
- 🔲 model text (optional, placeholder "default")
- 📝 name text (validated: no spaces/colons/dots, max 30)
- 🔲 tag text (optional)
- 📝 remote ctrl toggle ([ off ] / [ on ])
- 🔲 LAUNCH button (blue when focused)
- 🔲 Pre-fill from loadState().last_spawn
- 🔲 Right panel (2+ panes): per-field contextual help + "from last spawn" indicator

### Spawn success
- 📝 SESSION block: id, provider, name, working_dir, tag
- 📝 ATTACH block: tmux attach + switch-client commands
- 📝 REMOTE CONTROL block (only if enabled): URL or "waiting..."
- 📝 Actions: a attach now, c copy URL, l sessions, esc back

### Orchestrate form
- 🔲 SHARED CONFIG section (provider, auth, goal, effort, permissions, output_dir)
- 🔲 WORKERS section — numbered rows, focused = blue border + cursor
- 🔲 Tab adds new worker
- 🔲 d deletes focused worker
- 🔲 FAN OUT × N button
- 🔲 Right panel (2+ panes): focused worker context + key bindings
- 🔲 Pre-fill from loadState().last_orchestrate

### Orchestrate success
- 🔲 Worker rows: ID, provider, name, task excerpt, ● active
- 📝 [tab] save as preset → inline name field → addPreset() → confirmation
- 🔲 Actions: t top, l sessions, esc back
- 📝 Attach command per worker (G9)

### Sessions
- 🔲 Grouped by working_dir with SECTION headers
- 🔲 Auto-refresh every 5s (setInterval, clearInterval on unmount)
- 🔲 Dead session detection: tmux has-session → stamp ended_at, remove from list
- 🔲 ↑↓ select row
- 🔲 Enter: peek panel (15 lines plain text)
- 🔲 a: attach (switch-client if $TMUX set, else show hint 4s)
- 🔲 k: kill window
- 🔲 r: force refresh
- 🔲 providerColor() and formatAge() on all rows
- 🔲 Right panel (2+ panes): wider peek (20 lines)
- 📝 rc_url shown in peek if present + [c] copy

### History
- 📝 Filter: only sessions where ended_at != null
- 📝 Sort: ended_at descending
- 📝 Group by working_dir
- 📝 Columns: ID, provider, name/tag, duration, ended_at
- 📝 d: delete selected entry (registry file delete)
- 📝 D: wipe all with confirmation prompt ("wipe all history? y/n")
- 📝 Right panel (2+ panes): full session JSON

### /top live monitor
- 📝 Auto-refresh every 5s
- 📝 Flat session table (no grouping)
- 📝 Columns: ID, provider, name/tag, working_dir (truncated), age, last_seen, status
- 📝 ↑↓ select, a attach, k kill, r force refresh
- 📝 Right panel (2+ panes): peek of selected session (15 lines)
- 📝 3-pane: NavSidebar + list + peek

### Switch modal
- ✅ Floating popup via `tmux display-popup -w 90 -h 20`
- ✅ Session list: ID, provider, name, age, status
- ✅ ↑↓ navigate, Enter switch-client, k kill, esc cancel
- ✅ Prefix+A binding via `reevesagents setup-tmux`

### Settings
- 🔲 Per-provider sections: cc / gemini / codex
- 🔲 auth field per provider
- 🔲 key_env text field per provider
- 📝 base_url text (visible only when auth = custom)
- 📝 default_model text per provider
- 📝 default_effort selector per provider
- 📝 default_permissions selector per provider
- 📝 Global section: tmux session name (default "reevesagents")
- 📝 Global section: peek refresh interval (3s / 5s / 10s)
- 📝 Right panel (2+ panes): raw config values for focused section

### Doctor
- ✅ Existing checks run on mount
- 🔲 Right panel (2+ panes): fix hints per check
- 📝 tmux version parsed, warn if < 3.0

### Help
- 🔲 COMMANDS section from DEDUPED_ROUTES
- 🔲 KEYBOARD section (esc / ? / / + cmd)
- 🔲 HOME SHORTCUTS section
- 🔲 Right panel (2+ panes): extended description per highlighted binding

---

## 4. NavSidebar (3-pane only)

- 📝 `src/components/NavSidebar.tsx` — new file
- 📝 Width 20, flexDirection="column"
- 📝 Route list from DEDUPED_ROUTES, current screen highlighted blue
- 📝 Single-char shortcuts shown dim beside each route
- 📝 Wired into all screens via usePanes (only rendered when panes === 3)

---

## 5. CLI commands

| Command | Status |
|---|---|
| `reevesagents` (TUI) | ✅ Working |
| `reevesagents spawn ...` | ✅ Working |
| `reevesagents orchestrate ...` | ✅ Working |
| `reevesagents attach <id>` | ✅ Working |
| `reevesagents switch` | ✅ Working (Ink picker) |
| `reevesagents setup-tmux` | ✅ Working (Prefix+A) |
| `reevesagents doctor` | ✅ Working |
| `reevesagents spawn` (attach hint after JSON) | 📝 F11, 1 line change |

---

## 6. Distribution

- ⬜ npm package published to npmjs.com (`npm publish`)
- ⬜ Homebrew personal tap (`brew tap mertkaya/reevesagents`) — after npm publish
- ⬜ homebrew-core submission — after meaningful user adoption

---

## 7. Execution order

| Plan | Covers | Status |
|---|---|---|
| Plan 1 — Foundation | Types, updateSession, diagonal gradient, autocomplete, CommandPicker, Top/History placeholders | ✅ Done |
| Plan 2 — Core Screens | spawn.ts infra, 3-zone layout, Home, Sessions, Spawn, Orchestrate redesigns | 🔲 Written, run this next |
| Plan 3 — New Screens | Welcome splash, History full, /top full | 🔲 Written, run after Plan 2 |
| Plan 4 — Power Features | NavSidebar, Presets, RC URL, Settings full, Spawn success | 🔲 Written, run after Plan 3 |
| Plan 5 — Polish | G-series items, error boundary, NO_COLOR, goodbye message | 🔲 Written, run after Plan 4 |
