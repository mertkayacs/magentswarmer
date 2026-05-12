# reevesagents — Product Overview

A local TUI spawn manager and session portal for AI coding agents (Claude Code, Gemini CLI, OpenAI Codex). Three jobs: configure and launch agents, watch them run, jump in when needed. Runs entirely on the user's machine with their own credentials.

---

## Usage

### TUI (interactive)

```bash
reevesagents          # open the TUI
```

Navigate with `/command` or shortcut keys. ESC goes back.

### CLI (scriptable)

```bash
reevesagents spawn --provider cc --task "refactor auth module" --tag feature-auth
reevesagents orchestrate --goal "write tests" --workers 3
reevesagents attach <session-id>
reevesagents switch              # Ink picker for running sessions
reevesagents doctor              # health checks
reevesagents setup-tmux          # registers Prefix+A popup binding
```

### tmux shortcuts

- `Prefix+A` — floating session switcher from any tmux context
- `tmux attach -t reevesagents:<window>` — direct attach

### Distribution

- `npm install -g reevesagents` (primary)
- `brew tap mertkaya/reevesagents && brew install reevesagents` (secondary, after npm publish)

---

## Screens

| Screen | Route | Purpose |
|---|---|---|
| Welcome | (startup) | Gradient splash, 5s auto-advance, first-run detection |
| Home | `/home` | Dashboard: sessions by project, presets, shortcuts |
| Spawn | `/spawn` | Single-agent form (10 fields, pre-fills from last run) |
| Orchestrate | `/orchestrate` | Multi-agent fan-out, named workers, save as preset |
| Sessions | `/sessions` | Active sessions grouped by project, peek panel, attach |
| Top | `/top` | Live flat monitor, 5s refresh, status dots, peek |
| History | `/history` | Ended sessions, duration, delete/wipe |
| Settings | `/settings` | Per-provider config, global tmux/peek settings |
| Doctor | `/doctor` | Health checks, orphan pruner |
| Help | `/help` | Key reference |
| Switch | (CLI) | Floating tmux popup: select → switch-client |

---

## Features by screen

### Welcome
- Diagonal-gradient ASCII art (REEVES / AGENTS), tagline "spawn · watch · jump"
- Auto-advance to Home after 5s, any key skips
- First-run: no providers on PATH → routes to Settings
- Repeat visits: skip splash, go directly to Home

### Home
- Gradient title + provider dots (configured: colored, unconfigured: dim + "(→ /settings)")
- Sessions grouped by working directory under `── SESSIONS ──`
- Presets section (if any) with number-key run and `d` delete
- Right panel (wide): last 5 sessions from history
- Keys: `s` spawn, `o` orchestrate, `l` sessions, `t` top, `d` doctor, `?` help, `r` refresh

### Spawn form
- 10 fields: working dir, provider, auth, task (required), effort, permissions, model, name, tag, remote ctrl toggle
- Pre-fills from last spawn
- Unconfigured providers shown dimmed with skip hint
- Right panel (wide): per-field contextual help
- `[ LAUNCH ]` button highlighted blue when focused
- Validation: name must be alphanumeric + dash/underscore, max 30 chars

### Spawn success
- Session details block (id, provider, name, working dir, tag)
- ATTACH block: tmux attach + switch-client commands
- REMOTE CONTROL block (if enabled): URL or "waiting..." with spinner
- Keys: `a` attach now, `c` copy URL, `l` sessions, ESC back

### Orchestrate form
- SHARED CONFIG section: provider, auth, goal, effort, permissions
- WORKERS section: numbered rows, Tab adds worker, `d` removes, focused row gets blue border
- Pre-fills from last orchestrate
- Right panel (wide): focused worker context
- `[ FAN OUT × N ]` button

### Orchestrate success
- Worker rows with status
- `[Tab]` save as preset: inline name field, Enter saves
- Attach command per worker shown in dim gray
- Keys: `t` top, `l` sessions, ESC back

### Sessions
- Grouped by working directory
- Auto-refresh every 5s (dead session detection: tmux has-session → stamp ended_at)
- Peek panel on Enter (15 lines, plain text)
- Keys: `↑↓` select, `a` attach, `k` kill, `r` refresh, `h` history
- Right panel (wide): wider peek (20 lines)
- Shows rc_url if present with `[c]` copy

### Top
- Flat table: ID, provider dot, name, working dir, age, status (● green/yellow)
- Auto-refresh 5s with same dead session detection
- Right panel (wide): peek panel for selected session
- Keys: `↑↓` select, `a` attach, `k` kill, `r` force refresh

### History
- Shows sessions with ended_at set, sorted newest first
- Grouped by working directory
- Columns: ID, provider, name, duration, end timestamp
- Keys: `d` delete selected, `D` wipe all (requires `y` confirm), `r` refresh

### Settings
- Per-provider (cc / gemini / codex): auth, key env var, base_url (custom only), default model, effort, permissions
- Global: tmux session name, peek refresh interval
- Right panel (wide): raw current values

### Doctor
- Checks: node version, tmux (parses version, warns < 3.0), provider CLIs on PATH
- Shows fix hints per check in right panel (wide)
- Prunes orphaned registry entries (sessions with no tmux window)

---

## Visual design

**Layout (all screens):**
```
Zone 1: header (fixed, 1 line) — REEVES AGENTS · /screen  context
Zone 2: content (flexGrow) — main content + autocomplete picker at bottom
Zone 3: command bar (fixed, 1 line) — / type a command
```

**Pane breakpoints:**
- `< 90 cols` — 1 pane, full width
- `90–139 cols` — 2 panes, right context panel (width 40)
- `≥ 140 cols` — 3 panes, NavSidebar (width 20) + content + right panel

**Colors:**
- Primary blue `#5a96e0` — command bar, focused cursors
- Light blue `#7eb8f5` — session IDs, cc provider
- Gradient start `#3b6ead` → end `#bae6fd` — title art
- Active green `#4ade80` — status, codex provider
- Stale yellow `#facc15` — stale sessions, gemini provider
- Section blue `#4a6fa5` — `── SECTION ──` headers
- Dim `#6e7681` — timestamps, secondary labels

**Brand title:** diagonal-gradient ASCII art via chalk truecolor per-character. Renders as ~12 Ink Text elements (not per-char nodes).

**Autocomplete picker:** appears above command bar when `/` mode is active and user has typed at least one character. Max 5 rows, Tab/↑↓ to cycle, Enter to navigate.

---

## Infrastructure

- **Session registry:** one JSON file per session in `~/.local/share/reevesagents/sessions/`
- **Config:** `~/.config/reevesagents/config.json` — per-provider auth + defaults
- **State:** `~/.local/share/reevesagents/state.json` — last form values, presets, history
- **Dead session detection:** `tmux has-session` per session on each refresh; stamps `ended_at` when window gone
- **Peek:** `tmux capture-pane -p` (plain text, no ANSI), called via execFileSync
- **Remote control URL:** `tmux pipe-pane -o "cat >> /tmp/reeves-<id>.rc.log"` then polling for URL regex
- **Window name conflicts:** `uniqueWindowName()` checks existing windows before `new-window`
- **No shell injection:** all tmux commands via `execFileSync('tmux', [...args])`

---

## Implementation plans

| Plan | Covers | Status |
|---|---|---|
| Plan 1 | Types, autocomplete, CommandPicker, banner diagonal, Top/History placeholders | ✅ Done |
| Plan 2 | spawn.ts infra, 3-zone layout, Home/Sessions/Spawn/Orchestrate redesigns | 🔲 Next |
| Plan 3 | Welcome splash, History full, Top full | 🔲 After Plan 2 |
| Plan 4 | NavSidebar, Presets UI, RC URL, Settings full, Spawn success, CLI hint | 🔲 After Plan 3 |
| Plan 5 | Polish: progress indicator, name validation, error boundary, NO_COLOR, goodbye | 🔲 After Plan 4 |
