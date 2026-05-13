# reevesagents — Master Checklist

Single source of truth for what is done, in progress, and still needed.
Updated: 2026-05-13.

Legend: ✅ done · ⬜ open · 🔧 in progress

---

## 1. Documents

| Document | Status |
|---|---|
| `docs/superpowers/specs/2026-05-12-reevesagents-design.md` | ✅ Complete |
| `docs/superpowers/plans/2026-05-12-plan1-foundation.md` | ✅ Written and executed |
| `docs/superpowers/plans/2026-05-12-plan2-core-screens.md` | ✅ Written and executed |
| `docs/superpowers/plans/2026-05-12-plan3-new-screens.md` | ✅ Written and executed |
| `docs/superpowers/plans/2026-05-12-plan4-power-features.md` | ✅ Written and executed |
| `docs/superpowers/plans/2026-05-12-plan5-polish.md` | ✅ Written and executed |
| Distribution strategy | ✅ Decided: npm primary, Homebrew tap secondary |

---

## 2. Provider CLI compatibility

Verified against installed versions: claude 2.1.126, codex 0.128.0, gemini 0.40.1.

| Provider | Binary | Permissions bypass | Model flag | Effort flag | API key env |
|---|---|---|---|---|---|
| cc | `claude` | `--dangerously-skip-permissions` ✅ | `--model` ✅ | `--effort` ✅ | `ANTHROPIC_API_KEY` ✅ |
| codex | `codex` | `--dangerously-bypass-approvals-and-sandbox` ✅ | `--model` ✅ | `-c model_reasoning_effort="..."` ✅ | `OPENAI_API_KEY` ✅ |
| gemini | `gemini` | `--yolo` ✅ | `--model` ✅ | not supported ✅ | `GEMINI_API_KEY` / `GOOGLE_API_KEY` (both unset on subscription) ✅ |

---

## 3. Feature completion

### Foundation

- ✅ Screen stack router (push/pop/replace)
- ✅ Autocomplete command bar (DEDUPED_ROUTES, completions, Tab/↑↓)
- ✅ 3-zone layout (fixed header / flexGrow content / fixed command bar) on all screens
- ✅ Pane-responsive layouts on all screens (1/2/3 panes via usePanes)
- ✅ Banner diagonal gradient (gradientChars, chalk hex per-char)

### Provider infrastructure

- ✅ buildCommand() for cc/codex/gemini with correct flags
- ✅ buildEnv() — subscription unsets API keys, api-key keeps env, custom sets base_url + key
- ✅ detectAvailable() — which exec path
- ✅ uniqueWindowName() — dedup tmux window names
- ✅ Shell injection prevention (shellQuote, execFileSync throughout)

### Spawn

- ✅ Working dir field (field 0, defaults to cwd)
- ✅ Provider/auth/task/effort/permissions/model/tag/name fields (10 total)
- ✅ Name field validation (alphanumeric/dash/underscore, max 30)
- ✅ Pre-fill from loadState().last_spawn
- ✅ Spawn progress spinner (80ms braille animation)
- ✅ Result view: session details, attach instructions, RC URL spinner
- ✅ a/c/l/esc keyboard handlers in result view
- ✅ remote_control toggle field in spawn form (field 9, cc-only gated)

### Sessions

- ✅ Grouped by working_dir with section headers
- ✅ Auto-refresh every 5s with dead session detection
- ✅ ↑↓ select, enter peek, a attach, k kill, r refresh
- ✅ providerColor + formatAge on all rows
- ✅ rc_url display in peek panel + c to copy (OSC 52)

### Orchestrate

- ✅ Goal/tag/provider/auth/effort/perms/workers form
- ✅ Pre-fill from loadState().last_orchestrate
- ✅ Tab to save as preset panel in success view
- ✅ tmux switch-client command per worker in result

### Home

- ✅ Gradient title (chalk per-char)
- ✅ Provider dots with color
- ✅ Sessions grouped by working_dir
- ✅ Presets section (1-9 run, D delete)
- ✅ Shortcuts row
- ✅ Recent right panel (2+ panes)
- ✅ Last spawned session in header (id · provider · name)
- ✅ NavSidebar (3-pane)
- ✅ NavSidebar on all other screens (wired via ScreenLayout)

### Welcome

- ✅ Diagonal gradient ASCII art (REEVES + AGENTS)
- ✅ Auto-advance to Home after 5s
- ✅ Any keypress cancels timer
- ✅ First-run gate: no providers → Settings
- ✅ Repeat visits: skip splash

### History

- ✅ Filter ended sessions, sort by ended_at desc, group by working_dir
- ✅ Duration column (formatDuration)
- ✅ d delete, D wipe-all with confirmation
- ✅ Right panel: full session JSON

### Top

- ✅ Flat table, 5s auto-refresh, dead session detection
- ✅ isStale() status dot
- ✅ Peek right panel (15 lines)

### Settings

- ✅ Per-provider sections (cc/codex/gemini) with auth/key_env/base_url/model/effort/perms
- ✅ Global section (tmux_session_name, peek_interval_seconds)
- ✅ 2-pane layout with current values

### Doctor

- ✅ Node, tmux (version parse + warn < 3.0), claude, codex, gemini checks
- ✅ Orphan detection and prune
- ✅ Contextual fix hints per check in right panel (↑↓ to select check)

### Help

- ✅ COMMANDS from DEDUPED_ROUTES
- ✅ KEYBOARD section
- ✅ HOME SHORTCUTS section
- ✅ Right panel session shortcuts

### NavSidebar

- ✅ Component (width 20, route list, current screen highlighted blue)
- ✅ Wired into all screens (Home, Sessions, Spawn, Orchestrate, Settings, History, Top, Doctor, Help)

### Error handling

- ✅ ErrorBoundary class component
- ✅ process.on('uncaughtException') in cli.ts

### Polish

- ✅ NO_COLOR / chalk.level fallback in banner + CommandPicker
- ✅ Doctor tmux version parse (warn < 3.0)
- ✅ 30 rotating goodbye messages on exit
- ✅ CLI attach hint after spawn JSON output

---

## 4. CLI commands

| Command | Status |
|---|---|
| `reevesagents` (TUI) | ✅ |
| `reevesagents spawn ...` | ✅ |
| `reevesagents orchestrate ...` | ✅ |
| `reevesagents attach <id>` | ✅ |
| `reevesagents switch` | ✅ |
| `reevesagents setup-tmux` | ✅ |
| `reevesagents doctor` | ✅ |

---

## 5. Distribution

- ⬜ npm publish (`npm publish`)
- ⬜ Homebrew personal tap — after npm publish
- ⬜ homebrew-core — after adoption

---

## 6. Open items

| # | Item | Priority |
|---|---|---|
| 1 | npm publish + Homebrew tap | P2 |
