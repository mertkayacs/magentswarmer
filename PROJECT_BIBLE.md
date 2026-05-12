# reevesagents — Project Bible (v1.0)

**Internal dev spec. Private working document. Source of truth for everything.**

If something else in the repo (README, story, runbook, code, persona files) contradicts this file, this file wins and the other gets fixed. New requirements land here first, then propagate.

This file is for the people building reevesagents — Mert and any agent helping. Not for end users. End users read README + docs/.

---

## 1. Mission

Make it dramatically easier to get value out of multiple AI coding CLIs (Claude Code, Codex, Gemini) running on the same machine — both for one-off single-CLI work and for coordinated multi-agent projects.

We do not reimplement the providers. We bring them together with personas, skills, a shared coordination protocol, and a small TUI tool.

**Tagline:** Work like a raccoon.

---

## 2. Three names — keep them straight

| Name | Meaning | Notes |
|---|---|---|
| **reevesagents** | The product, the CLI binary, the project, the GitHub repo | All lowercase, plural, one word. The thing people install. |
| **Reeves** | The mascot — a pixel "R" logo with blue gradient | Capitalized, singular. The brand mark. The raccoon spirit, abstracted. |
| **a reevesagent** | One spawned orchestrator instance — a CC/Codex/Gemini session running with our orchestrator persona | Lowercase, singular when one. Plural "reevesagents" is ambiguous (could be the product or multiple instances) — use context. |

Anywhere the wrong term appears in the codebase, fix it.

---

## 3. The two co-main modes (READ THIS — most important section)

reevesagents has **two distinct modes of operation, and they are CO-MAIN — equally important.** They share infrastructure but serve different needs. A user picks the mode based on what they're doing. Neither is a side feature, neither is secondary. The product without spawner mode is half the product. Treat both as flagship.

### Mode A: Spawner (offline, co-main use case)

> **Just spawn one or more CLIs with the right auth. Use them as you normally would.**

This is one of the two flagship features. Not a gateway, not an introduction — a full first-class use case. You don't need to know anything about orchestration, PLAN.md, worktrees, phases, or any multi-agent machinery. You want to fire up `claude` (or `codex`, or `gemini`) with the right setup, possibly with a persona, possibly with API key vs subscription, and start working.

**The spawner answers: "I want to run a CLI. Set it up for me."**

Spawner mode runs **completely offline** in the sense that no AI is running on our side — we don't talk to any model, we don't proxy anything, we don't poll the spawned CLI. We just configure shells, launch tmux windows, and exit. The user's spawned CLIs do their own work after that.

Example flow inside the TUI:
```
> /spawn
  How many sessions? [1-4] » 1
  Session 1
    Provider: cc / codex / gemini » cc
    Auth: subscription / api-key » subscription
    Use a persona? y/N » N
    Name (optional): » my-debug-session
  ✓ Spawning...
  Attach: tmux attach -t reevesagents:my-debug-session
  Saya harap proyek Anda berhasil  (Indonesian)
```

Done. You're now running `claude` in tmux with subscription auth. Use it however you want. No PLAN.md required, no git repo required, no other reevesagents concepts in your face.

**This is what most users will use most of the time.** It's reevesagents as a CLI launcher with smart auth handling.

Variations:
- Spawn 4 different CLIs at once (1 cc + 1 codex + 1 gemini + 1 cc with different auth)
- Spawn with an existing persona (`linus` for backend work, `berners` for frontend)
- Mix auth modes per spawn (subscription on one, API key on another)

The persona is OPTIONAL in spawner mode. You can spawn raw `claude` with no persona file pointed at it, and you're just running stock CC.

### Mode B: Orchestrator (the complex case)

> **Plan a multi-task project, spawn multiple coordinated workers, monitor them, merge their work.**

This is the full reevesagents experience. You spawn a "reevesagent" (an AI orchestrator). You have a conversation with it. It writes PLAN.md. You approve it. It spawns multiple worker CLIs, each on its own git branch in its own worktree, each in its own tmux window. You watch them work in parallel. When done, you merge.

Example flow:
```
> /orchestrate
  ✓ Reevesagent spawned in tmux
  Talk to it: tmux attach -t reevesagents:reeves
```

Then inside the reevesagent's tmux window:
```
You: Build me a TODO API. Auth, schema, web UI, tests.
Reeves: I'll plan four parallel tasks: linus on auth, codd on schema,
        berners on web, turing on tests. PLAN.md is at...
You: [edit PLAN.md] approved: true
Reeves: Running reeves start. Worktrees created. Darwin reading codebase...
Reeves: Phase 1 spawning: linus, codd, berners, turing all RUNNING.
... time passes ...
Reeves: All DONE. Want me to combine?
You: Yes.
Reeves: Merged 4 branches. Done.
```

This is reevesagents as a multi-agent orchestrator. The full machinery: PLAN.md, phases, capability adaptation, STUCK protocol, resume mode, worktree isolation, file-ownership soft contract.

### How they relate

Both modes share:
- The TUI (one app, both modes accessible via slash commands)
- Persona files in `~/.reeves/agents/`
- Skills in `~/.reeves/skills/`
- Capability detection (provider availability + auth options)
- tmux session management
- The 30-language goodbye

But they differ:
- Spawner needs no git repo, no PLAN.md, no project state
- Orchestrator requires `.reeves/config.json`, `PLAN.md`, worktrees, etc.
- Spawner exits after spawning. Orchestrator stays running and the user iterates with the reevesagent.

### Where each mode shines

**Use spawner when:**
- You just want to fire up `claude` with an existing persona
- You want to run codex on api-key while CC stays on subscription
- You want a quick parallel-window setup without coordination
- You don't have or don't want a project yet

**Use orchestrator when:**
- You're building something with multiple components
- You want parallel work without worktree conflicts
- You want a single AI to coordinate the whole effort
- You want autodetection of stuck/crashed agents and recovery

**Most users will start with spawner, graduate to orchestrator** for bigger projects. We design for both.

---

## 4. Architecture — three pieces

The whole product reduces to three components:

```
~/.reeves/
├── agents/                    ← (1) Persona files (per agent)
│   ├── reeves/
│   │   ├── CLAUDE.md          ← orchestrator persona for cc
│   │   ├── AGENTS.md          ← orchestrator persona for codex
│   │   └── GEMINI.md          ← orchestrator persona for gemini
│   ├── darwin/...             ← context analyst (Phase 0)
│   ├── linus/...              ← backend specialist
│   ├── berners/...
│   └── ...                    ← 11 default + any user-added
│
└── skills/                    ← (2) Skills (per slash command)
    ├── doctor.md
    ├── spawn.md
    ├── status.md
    ├── top.md
    ├── plan.md
    ├── agents.md
    ├── logs.md
    ├── attach.md
    ├── restart.md
    ├── combine.md
    ├── init.md
    └── help.md

/usr/local/bin/reevesagents     ← (3) The CLI tool (Python TUI app)
```

That's it.

1. **Persona files** teach a CC/Codex/Gemini session what role it plays. They're markdown. They're read by the spawned session at startup.
2. **Skills** are markdown files describing each slash command. The orchestrator reevesagent reads them on demand to know how to do common tasks (check status, spawn workers, etc.).
3. **The CLI tool** is the only Python in the system. It's a Textual TUI app. It manages tmux sessions, git worktrees, capability detection, and the slash command surface.

No daemon. No server. No database. State lives in:
- `~/.reeves/` — global, per-machine (personas + skills)
- `<project>/.reeves/config.json` — per-project metadata
- `<project>/PLAN.md` — orchestrator mode only
- `<project>/worktrees/<task>/STATUS.md` — orchestrator mode only
- tmux session — active processes

If reevesagents crashes, you lose nothing. State is on disk.

---

## 5. File system layout

### Global (one per machine)
```
~/.reeves/
  agents/<name>/{CLAUDE,AGENTS,GEMINI}.md
  skills/<command>.md
  saved/<setup-name>.json     ← saved orchestrator setups for reuse
```

### Per project (orchestrator mode)
```
<project-root>/
  .git/                        ← required for worktrees
  .reeves/
    config.json                ← project name, worktrees_dir, phases status
    log.jsonl                  ← append-only event log (for "Recent activity" pane)
  PLAN.md                      ← human-approved task plan
  worktrees/
    20260506-darwin-context/
      CLAUDE.md (or AGENTS/GEMINI)
      SPEC.md
      ROADMAP.md
      CHECKLIST.md
      STATUS.md                ← frontmatter + log; agents update this
      CONTEXT.md               ← Darwin writes this
      src/                     ← agent's actual work
    20260506-linus-auth/
      ...
```

### Per project (spawner mode)
```
(none — spawner is stateless, only tmux session names)
```

### tmux sessions
- Per project: `reevesagents-<project-name>` (orchestrator mode)
- For spawner without project: `reevesagents` (or user-specified name)
- Each agent gets a window inside the session

---

## 6. How a user uses it

### First time
```
$ pip install reevesagents
$ reevesagents
```
Drops into TUI. First-time check fails (no `~/.reeves/` yet). Banner shows install hint. User runs `/init`. Walks through provider auth selection, persona install, etc.

### Subsequent
```
$ reevesagents
```
Drops into TUI. Banner shows tri-pane (R + tagline + recent activity + tips). User types `/` to see commands or just types `/spawn`, `/orchestrate`, etc.

### Power-user / scripts
```
$ reevesagents -c doctor
$ reevesagents -c spawn:cc:subscription:linus
```
Hidden script-mode backdoor. Same logic, no TUI, no interactive prompts. For CI, scripting, debugging.

---

## 7. Slash command reference (full detail)

Every command has a slash form for use inside the TUI. Each is also accessible via `reevesagents -c <name>` for scripts.

### `/init`
Install personas + skills to `~/.reeves/`. Walks through:
- Detect installed CLIs (claude, codex, gemini)
- For each: ask auth mode (subscription / api-key / skip)
- Permission mode for orchestrator: supervised / autonomous
- Agent selection: all / core / just reeves / custom
Run once per machine. Re-run with `--force` to update.

### `/doctor`
Show diagnostics:
- Tools: tmux, git versions
- CLIs: claude/codex/gemini install status + version
- Capabilities matrix: per provider, sub: yes/no, api: yes/no
- Agents installed: count and list
Two-pane banner. Read-only.

### `/spawn`
The simple-mode spawner. Walks user through:
- How many sessions (1-4)
- Per session: provider, auth, optional persona pick (existing only), optional name
- Spawns each in tmux
- Prints attach commands
- Random goodbye line in one of 30 languages
- Exits TUI back to terminal
**No git repo required. No PLAN.md required.**

### `/orchestrate`
The full-mode orchestrator. Walks user through:
- Project path (default: cwd)
- Provider for the reevesagent (cc/codex/gemini)
- Auth mode for the reevesagent
- If `.reeves/config.json` doesn't exist, init the project
- Spawn reevesagent in tmux with full orchestrator persona + capability matrix + roster + resume hint
- Print attach commands
**Requires git repo. Reads/writes PLAN.md via the reevesagent.**

### `/status`
Live dashboard of all worktrees in current project:
- Per task: agent, task, phase, state (PENDING/RUNNING/STUCK/DONE/CRASHED), provider, last updated
- For STUCK/CRASHED rows: last log line
- `--watch` mode: refresh every 10s, no flicker
**Project mode only.**

### `/top`
htop-style live monitor:
- Fullscreen Textual screen
- Per agent: progress bar (step N/M), elapsed time, color-coded state, provider+model
- Refresh every 1s
- Key bindings: `q` quit, `r` restart, `l` logs, `a` attach, `/` filter
**Project mode only. No API spend.**

### `/logs <agent>`
Print last N STATUS.md log entries for an agent. Default N=20.

### `/attach <agent>`
Drop into the agent's tmux window. Detach with Ctrl-b d.

### `/restart <agent>`
Kill the agent's tmux window. Re-run start to respawn.

### `/combine`
Merge every DONE worktree branch into current branch with --no-ff. Aborts on conflict, leaves repo clean. Always user-confirmed in TUI.
**Project mode only.**

### `/plan {new,add,check,show}`
Author/edit/validate PLAN.md without an AI:
- `new` — write starter PLAN.md (interactive or minimal)
- `add` — append a task row (with provider/auth validation)
- `check` — validate PLAN.md against capabilities (no spawn)
- `show` — print current PLAN.md

### `/agents {list,add,remove,presets}`
Manage personas in `~/.reeves/agents/`. CRUD for custom agents.

### `/commands`
Full reference page inside the TUI. Shows every slash command with description and example.

### `/help`
Quick help. One-line per command.

### `/back`
Go to previous TUI screen (Textual handles navigation stack).

### `/quit`
Exit the TUI.

---

## 8. CLI vs reevesagent capability split (mission-critical)

| Operation | TUI alone | Reevesagent chat |
|---|---|---|
| Spawn CLI session | ✓ /spawn | ✓ via shell tool |
| Pick provider, auth, name | ✓ | ✓ |
| Use existing installed persona | ✓ | ✓ |
| **Create a new persona / character** | ✗ | ✓ |
| Plan a multi-task project | basic (`/plan add` rows) | rich (conversational) |
| Watch agents (`/top`) | ✓ | ✓ |
| Combine done worktrees | ✓ | ✓ |
| Restart stuck agent | ✓ | ✓ |
| Edit PLAN.md | basic | full (writes from scratch) |

**Why CLI cannot create personas:** Persona authorship requires conversation — figuring out role, voice, constraints, tool limits. That's an LLM strength. A CLI form would force the user to pre-decide everything in flag form, which leads to bland personas. We force persona creation through chat to keep them lovable.

---

## 9. PLAN.md schema (orchestrator mode)

```markdown
---
project: myapp
approved: false
---

# Plan: myapp

## Phases

### Phase 0 — context (automatic)
| task    | agent  | provider | auth         | permissions |
|---------|--------|----------|--------------|-------------|
| context | darwin | gemini   | subscription | autonomous  |

### Phase 1 — parallel
| task         | agent   | provider | auth         | permissions | worktree              |
|--------------|---------|----------|--------------|-------------|-----------------------|
| auth-backend | linus   | cc       | subscription | autonomous  | feature/auth-backend  |
| auth-secrets | shannon | cc       | subscription | supervised  | feature/auth-secrets  |

## File ownership
- src/api/ → linus
- src/auth/secrets/ → shannon

## Done when
- All tests pass
- Auth flow works end-to-end
```

Columns:
- `task` — slug used as window/branch name
- `agent` — persona name, must exist in `~/.reeves/agents/`
- `provider` — cc / codex / gemini
- `auth` — subscription / api-key
- `permissions` — autonomous (default) or supervised
- `worktree` — branch name (optional, defaults to `feature/<task>`)

Approval gate: `approved: false` → `approved: true` is the only way to spawn. No CLI flag, no menu — file edit only. Forces user to read the plan.

---

## 10. Capability adaptive

The TUI detects what's actually usable on the user's machine:

```python
caps = {
  "cc":     {"subscription": True,  "api_key": True},   # claude installed + ANTHROPIC_API_KEY set
  "codex":  {"subscription": True,  "api_key": False},  # codex installed, no OPENAI_API_KEY
  "gemini": {"subscription": False, "api_key": True},   # gemini missing, but GOOGLE_API_KEY set (won't help, sub=no)
}
```

Surfaced in three places:
1. `/doctor` shows the matrix
2. The reevesagent's initial prompt includes the matrix (so it plans within capabilities)
3. `/start` (called by reevesagent or via /plan) validates every (provider, auth) combo before any worktree is created — exits cleanly with per-task list of unusable combos

If only one provider is available, reevesagent plans all tasks on that provider; parallelism still works on a single subscription pool.

---

## 11. Visual identity

### Logo: pixel R with blue gradient

Default 7-row hero:
```
████████      ← row 1: brightest
██    ██
██    ██
████████
██   ██
██    ██
██     ██     ← row 7: deepest
```

8-stop gradient (top → bottom):
| Row | Hex | Notes |
|---|---|---|
| 1 | `#dbeeff` | Ice mist |
| 2 | `#b8dbff` | Sky |
| 3 | `#8cc1ff` | Pale azure |
| 4 | `#5aa1ff` | Sky-medium |
| 5 | `#2c7eee` | Azure |
| 6 | `#1a5fc4` | Mid-blue |
| 7 | `#0a4391` | Royal |
| 8 | `#062a66` | Deep navy |

Variants:
- 7-row hero — used in tri-pane main banner
- 5-row standard — used in two-pane and one-pane banners
- 4x slim — inline / footer / button labels

### Tagline
`Work like a raccoon` — directly under R in the banner. Always lowercase except first letter.

### Banner layouts

**Tri-pane** (bare `reevesagents` launch):
- Left third: R + tagline + version
- Right top: recent activity (from `.reeves/log.jsonl`)
- Right bottom: what's new (curated tips per release)

**Two-pane** (`/doctor`):
- Left: R + tagline
- Right: capability matrix + agent list

**One-pane** (`/spawn`, `/init`):
- Small R + command name top-left
- Interactive flow content below

**No banner** (action commands `/status`, `/top`, `/combine`, `/logs`, `/attach`, `/restart`):
- Pure content, no visual chrome
- Banner would be noise

### Color palette (Rich library names)

- **Accent:** soft blue gradient (above)
- **Warning:** `yellow` (amber tone)
- **Error:** `red` (muted, not bright)
- **Success:** `green` (muted, not lime)
- **Dim text:** `dim` modifier
- **Bold key elements:** `bold` modifier

Strict rule: no other colors. No purples, oranges, magentas. Discipline reads as professional.

### Polish targets
- No flicker on Live updates (Rich.Live updates only changed cells)
- Aligned columns (use Rich Table not manual padding)
- Consistent voice (errors start with the actual problem, not "Error:" or "Sorry,")
- No stuck spinners — every long op has elapsed time
- Banner appears only on entry screens (`reevesagents`, `/doctor`) — other commands skip it
- Exit codes meaningful: 0 success, 1 user error, 2 system error, 3 partial (some merged, some conflict)

---

## 12. The 30-language goodbye

After `/spawn` exits the TUI, print a random language-of-success line. Format: `<sentence in language> (LanguageName)`.

Latin-script only. German uses umlauts (ö, ä, ü) which work in modern terminals. Languages with non-Latin scripts (Cyrillic, Arabic, Han, Greek, Hindi, etc.) are excluded — we'd lose them in some terminals.

The 30 (with native speaker review pending on starred ones):
1. I hope you succeed in your project (English)
2. Projenizde umarım başarılı olursunuz (Turkish)
3. Ich hoffe, Sie haben Erfolg mit Ihrem Projekt (German)
4. J'espère que votre projet réussira (French)
5. Espero que tengas éxito en tu proyecto (Spanish)
6. Spero che il tuo progetto abbia successo (Italian)
7. Espero que seu projeto seja bem-sucedido (Portuguese)
8. Ik hoop dat je project een succes wordt (Dutch)
9. Jag hoppas att ditt projekt blir framgångsrikt (Swedish)
10. Jeg håper prosjektet ditt blir vellykket (Norwegian)
11. Jeg håber, dit projekt bliver en succes (Danish)
12. Toivon, että projektisi onnistuu (Finnish)
13. Mam nadzieję, że twój projekt się powiedzie (Polish)
14. Doufám, že váš projekt uspěje (Czech)
15. Dúfam, že váš projekt uspeje (Slovak)
16. Sper că proiectul tău va avea succes (Romanian)
17. Nadam se da će tvoj projekt uspjeti (Croatian)
18. Upam, da bo vaš projekt uspešen (Slovenian)
19. Remélem, hogy a projekted sikeres lesz (Hungarian)
20. Loodan, et su projekt õnnestub (Estonian)
21. Tikiuosi, kad tavo projektas pavyks (Lithuanian)
22. Ceru, ka jūsu projekts izdosies (Latvian)
23. Espero que el teu projecte tingui èxit (Catalan)
24. Saya harap proyek Anda berhasil (Indonesian)
25. Tôi hy vọng dự án của bạn thành công (Vietnamese)
26. Natumai mradi wako utafanikiwa (Swahili)
27. Sana magtagumpay ang iyong proyekto (Filipino)
28. Gobeithio y bydd eich prosiect yn llwyddiannus (Welsh) ⭐
29. Mi esperas, ke via projekto sukcesos (Esperanto)
30. Shpresoj që projekti juaj të ketë sukses (Albanian)

⭐ = needs verification by native speaker before v1.0 ship.

Random pick on each `/spawn` exit. We never repeat the same one twice in a row (track in session memory).

---

## 13. Hard rules — never violate

1. **No AI-generated signatures anywhere.** Source files, markdown, commits, tags, PR bodies. Strip them on sight. Mert's repos must read as his own.
2. **No `~/jarvis/` or personal references** in any shipped file.
3. **`/combine` is never automatic.** Always user-confirmed.
4. **Worker spawn requires PLAN.md `approved: true`.** No shortcut, no flag bypass.
5. **Reevesagent persona scoped to 5 commands** (`start`, `status`, `logs`, `restart`, `combine`) + read-only `cat`. Never edits code, never runs git directly, never spawns outside the PLAN.md → approval loop.
6. **Force-push needs explicit user confirmation.** No exception, no automation.
7. **Personas only created by reevesagent chat.** TUI never auto-generates a persona.
8. **No daemons or background scrapers.** On-demand only.
9. **Subscription auth always `unset <PROVIDER>_API_KEY`** before launching CLI. Forces OAuth path.
10. **No reading `.env`, `~/.ssh/`, `~/.aws/`, secrets/, or printing API key values.**
11. **No automatic polling.** Status / log / capability reads happen on user demand, never on a background timer. The ONLY screen that auto-refreshes is `/top` (the live monitor) — and it polls files only, never an API. Every other screen reads once when entered and re-reads only on user action (`/back`, `/refresh`, key press). No idle CPU.
12. **Spawner mode is co-main with orchestrator.** Both get equal docs, equal polish, equal testing. The "Just /spawn and go" path is a v1.0 ship blocker, not a nice-to-have.

---

## 14. What ships in v1.0

### Code
- Textual TUI app with main screen, slash command input, autocomplete with thumbnails, screen navigation stack
- All 14 slash commands implemented as Textual screens
- `banner.py` module: pixel R + 8-stop gradient + tri/two/one-pane layouts
- `goodbye.py` module: 30-language picker
- Skills system: fresh small set, one MD per slash command
- Persona-driven slash routing (works on cc/codex/gemini equally)
- Capability detection (already done, plumbed to TUI)
- PLAN.md `permissions` column (already done)
- Resume mode + STUCK protocol + roster injection (already done)
- Per-project tmux session names
- `reevesagents -c <command>` script-mode backdoor
- `pyproject.toml` at v1.0.0

### Docs
- README — public-facing, marketing, polished
- docs/story.md — narrative walkthrough
- docs/user-guide.md — reference per command
- docs/checklist.md — first-time user verification
- docs/live-test-runbook.md — pre-ship verification
- docs/DECISIONS.md — every design choice with rationale
- docs/technical-design.md — module-by-module reference
- docs/md-formats/ — exact specs for STATUS, PLAN, CONTEXT files

### Tests
- 76+ unit tests (existing)
- Snapshot tests per Textual screen
- Live-test runbook executed and signed off

---

## 15. What's NOT in v1.0 (deferred)

| Item | Why deferred |
|---|---|
| Cross-project status (`/status --all`) | Needs global registry; nice-to-have, not core |
| Persona editing inside TUI | Files are 1 line away; chat creates them; in-TUI editor is overkill |
| Daemon for proactive STUCK alerts | Architectural complexity, can use polling for v1 |
| Plugin/extension system | Adds surface area; defer until we know what plugins need |
| Multi-monitor / split-window TUI | Textual supports it but YAGNI |
| Web UI / mobile | Out of scope — this is a terminal tool |
| Support for non-Latin language goodbyes | Terminal rendering issues; defer |

---

## 16. Build phases

Each phase is independent. Commit + push after each. Stop or redirect anytime.

| Phase | Effort | Output |
|---|---|---|
| **0. Naming + version** | <1h | Replace stale references (Reeves vs reevesagents vs reevesagent). Bump pyproject.toml to 1.0.0. Drop raccoon-mascot file refs. |
| **1. Visual foundation** | 2-3h | `banner.py` with pixel R + 8-stop gradient + 3 layouts. `goodbye.py` with 30-language picker. Color palette constants. Standalone, no Textual yet. |
| **2. Skills system** | 2-3h | Fresh skill files in `templates/skills/`, one per slash command. Persona update with slash routing instructions. `/init` installs to `~/.reeves/skills/`. |
| **3. TUI shell** | 3-4h | Textual app skeleton: `app.py`, main screen, slash input widget with autocomplete + thumbnails, screen stack, key bindings (ESC, Ctrl+C, /quit). Banner displays. |
| **4. Logic adapter** | 1-2h | Wrap existing Click logic so TUI screens consume data, not Click invocations. Same logic, two front doors. |
| **5. Slash command screens** | 4-6h | One Textual screen per command. Order: simple ones first (/doctor, /agents, /help), then complex (/spawn, /top, /plan). |
| **6. Backdoor + tests** | 2h | `reevesagents -c <cmd>` script-mode wired. Snapshot tests per screen. |
| **7. Docs refresh** | 1-2h | README, story, user-guide, checklist, runbook all rewritten for v1.0 surface. |
| **8. Live test** | 1h (user time) | Greet 6-task project, all scenarios from runbook. |

**Total: ~16-22 focused hours.** Many turns in our chat-paced workflow.

---

## 17. v1.0 ship gate

All of these must hold before tagging:

- [ ] All 14 slash commands work in the TUI
- [ ] Pixel R + gradient renders correctly across major terminals (iTerm2, Terminal.app, Alacritty, kitty)
- [ ] **Spawner path verified** — `/spawn` walks user through and successfully spawns CLI sessions in tmux, exits cleanly, no background processes left
- [ ] **Orchestrator path verified** — `/orchestrate` spawns a reevesagent that can plan + run a project end-to-end
- [ ] `/top` is the only auto-refreshing screen, polls files only (no API), no flicker
- [ ] No other screen polls anything — verified by inspecting source
- [ ] Skills installed to `~/.reeves/skills/` and personas reference them
- [ ] Capability detection adapts plans to user's machine
- [ ] Goodbye message rotates languages, never repeats consecutively
- [ ] `reevesagents -c <cmd>` backdoor works for every command
- [ ] Live test (orchestrator): greet 6-task project completes via TUI in autonomous mode
- [ ] Live test (spawner): standalone `/spawn` of all 6 (provider, auth) combos works
- [ ] All commits clean (no AI signatures anywhere)
- [ ] No personal references in any shipped file
- [ ] `pyproject.toml` version is `1.0.0`
- [ ] Tag `v1.0.0` created and pushed
- [ ] PyPI release uploaded

Hit all 14 → public release announcement.

---

## 18. Implementation notes (for ourselves)

### Textual specifics
- Use `App` subclass with `on_mount` to set up screens
- Each slash command is a `Screen` subclass
- Slash autocomplete: custom popup `Widget` with keyboard navigation (Textual doesn't have this built-in)
- Live monitor: use `Reactive` for state, `set_interval` for refresh
- Screens accessible via `self.app.push_screen("doctor")` etc.

### Persona slash routing
The persona file says (paraphrased):
> When the user's message starts with `/`, treat it as a slash command. The known commands are: doctor, spawn, status, top, plan, logs, attach, restart, combine. Read the corresponding `~/.reeves/skills/<command>.md` for guidance, then run `reevesagents -c <command>` via shell tool and display output.

Same prompt for all 3 providers. Persona-handled = portable.

### Why not platform-native CC skills
CC has a native skill system (`~/.claude/skills/`) with proper slash command registration. We could use it. But:
- Codex and Gemini don't have native equivalents
- Persona-handled is universal
- We can ALSO ship CC native skills as a polish layer without losing the universal floor

For v1, persona-handled only. CC native skills as optional 1.1 polish.

### Backdoor implementation
`reevesagents -c <cmd>` parses the command, looks up the corresponding action function, runs it without TUI. The action functions are extracted from current Click handlers — they take args and return output. TUI screens render the output in a Textual widget; backdoor prints it to stdout.

### Capability detection caveat
We can't verify OAuth login non-invasively. So "subscription = installed" is a heuristic. If the user has the CLI but isn't actually logged in, they'll see the OAuth prompt when the spawn happens. Acceptable.

---

## 19. Edge cases + failure modes

| Scenario | Current handling |
|---|---|
| User runs `reevesagents` outside any project | Spawner mode works; orchestrator commands warn about missing project |
| User skips all CLIs in `/init` | Errors with "pick at least one" |
| User runs `/orchestrate` in non-git dir | Clean error: `git init && git commit --allow-empty -m "init"` |
| PLAN.md has unusable provider/auth | Validation lists per-task issues, exits before any spawn |
| User flips `approved: true` while reevesagent is mid-conversation | Reevesagent monitors PLAN.md, runs `reeves start` itself when it sees the flip |
| Tmux session dies mid-orchestration | Resume mode kicks in on next `/orchestrate`; reevesagent reads STATUS files and reports |
| Worker writes outside its CHECKLIST.md ownership | Detected at `/combine` time (file diff per branch shown); soft contract not enforced |
| Two `reeves start` invocations from different shells | fcntl.flock on `.git/reeves-worktree.lock` serializes them |
| Darwin hangs forever | 30-min timeout in `_watch_darwin_and_spawn`; user gets clear error |
| User spawns multiple projects simultaneously | Per-project tmux session names prevent collision |

---

## 20. Movable vs locked decisions

### Easy to flip
- Specific gradient hex stops
- Slash command names (`/top` vs `/watch`, `/orchestrate` vs `/chat`)
- Tagline wording
- 30-language list (add or remove individual languages)
- R variant proportions (5-row vs 7-row)

### Locked (would require re-planning)
- Two-mode design (spawner + orchestrator)
- TUI primary, Click backdoor secondary
- Persona+skills+tool architecture
- v1.0 surface freeze on slash commands
- The Hard Rules (section 13)

---

## 21. Future ideas (post-v1.0)

For our own roadmap, not promises:
- Reevesagent voice mode (talk to it via dictation)
- Cross-machine orchestration (workers on remote hosts via SSH)
- Plugin system for custom skills
- Agent marketplace (share personas)
- Cost telemetry per task (track tokens used per agent across providers)
- Visual web dashboard (companion, not replacement, for terminal)
- Slack/Discord notifications when STUCK/CRASHED

None of this is committed. Just where our heads can go.

---

## 22. Glossary

- **Spawner mode** — Mode A. Just spawn one or more CLI sessions, no orchestration.
- **Orchestrator mode** — Mode B. Plan + spawn + monitor + merge multi-task projects.
- **Reevesagent** — A spawned orchestrator AI instance. The thing the user talks to in chat mode.
- **Worker** — A spawned CLI in orchestrator mode that does actual code work in its own worktree.
- **Persona** — A markdown file in `~/.reeves/agents/<name>/` that teaches a CLI session what role to play.
- **Skill** — A markdown file in `~/.reeves/skills/<command>.md` that documents a slash command for personas to read.
- **Phase 0** — The Darwin context-reading step before workers spawn.
- **Capability** — A (provider, auth) combo that's actually usable on the user's machine.
- **STUCK threshold** — 5 minutes of no STATUS.md update while window is alive.
- **Approval gate** — `approved: false` → `approved: true` flip in PLAN.md frontmatter. The only way to spawn workers.

---

## 23. End of bible

**This file is the contract.** If any other file in the repo (README, docs, code, persona files) contradicts this one, fix the other file.

If a new requirement shows up during a conversation:
1. Update this file first
2. Then propagate to README/docs/code

If we're unsure about a design question, refer to:
- The Hard Rules (section 13) for non-negotiables
- The Two Modes (section 3) for which path applies
- The Locked decisions (section 20) for what we already committed

When in doubt: simpler beats fancy. Spawner mode beats orchestrator mode for first-time users. CLI beats AI when they can do the same thing. Tests beat assumptions. Ship beats wait.

Work like a raccoon.
