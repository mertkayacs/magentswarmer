# reevesagents

Spawn and orchestrate AI coding CLIs — Claude Code, Codex, Gemini — from one terminal.

> Work like a raccoon.

---

## What it does

**Spawner mode:** launch one or more AI CLIs with the right auth, model, and permissions in isolated tmux windows. No juggling flags.

**Orchestrator mode:** give a goal, watch reevesagents fan out parallel workers across providers, each in its own window, then collect results.

Both modes run through an Ink TUI or straight from the command line.

---

## Requirements

- Node.js 20.19+
- tmux
- At least one of: `claude`, `codex`, `gemini` installed and on your PATH

---

## Install

```sh
npm install -g reevesagents
```

Or run without installing:

```sh
npx reevesagents
```

---

## Quick start

```sh
# Open the TUI
reevesagents

# Spawn a Claude Code session directly
reevesagents spawn --provider cc --permissions skip --prompt "build a REST API"

# List active sessions
reevesagents sessions

# Peek at what a session last said
reevesagents peek <session-id>

# Kill a session
reevesagents kill <session-id>

# Run a health check
reevesagents doctor
```

---

## Working with sessions

Every spawned session runs as a named tmux window inside the `reevesagents` tmux session. The registry tracks each session's ID, provider, name, and tmux target.

**List sessions:**
```sh
reevesagents sessions          # table view
reevesagents sessions --json   # JSON for scripting
```

**Attach by session ID:**
```sh
reevesagents attach <id>       # exact or prefix match, switches tmux client
reevesagents attach            # no ID: opens tmux window picker for reevesagents session
```

**From inside tmux — see everything:**

Press `Ctrl+b s` to open tmux's built-in session tree. Shows all sessions and windows. Arrow keys to navigate, Enter to switch, `q` to cancel.

**Detach and return:**

`Ctrl+b d` — detaches and drops you back. The session keeps running.

**Peek without attaching:**
```sh
reevesagents peek <id>         # last 20 lines of the session's pane output
```

**Power user: fzf popup picker**

Add this to `~/.tmux.conf` to bind `Prefix+A` to a reevesagents session picker from anywhere in tmux:

```sh
bind-key A display-popup -w 90 -h 20 -E \
  "reevesagents sessions 2>/dev/null \
   | fzf --header 'select a session (enter to attach, esc to cancel)' \
   | awk '{print \$1}' \
   | xargs -I ID reevesagents attach ID"
```

Requires [fzf](https://github.com/junegunn/fzf) (`brew install fzf`) and tmux 3.2+.

After editing `~/.tmux.conf`, reload with:
```sh
tmux source-file ~/.tmux.conf
```

**Remote control (mobile):**

Inside any session, type `/remote-control`. A URL appears — open it on your phone to drive the session from claude.ai.

---

## TUI navigation

Inside the TUI, type `/` to open command mode:

| Command | Screen |
|---|---|
| `/spawn` | Spawn a new session |
| `/orchestrate` | Fan-out orchestration wizard |
| `/sessions` | Browse active sessions |
| `/settings` | Edit provider config |
| `/doctor` | System health checks |
| `/help` | Key reference |

Arrow keys navigate lists. `Tab` / `Shift+Tab` moves between fields on forms. `Esc` goes back.

---

## TUI screens

<!-- VHS tapes go here -->

---

## Providers

| Provider | Binary | Auth modes |
|---|---|---|
| Claude Code | `claude` | `subscription`, `api-key`, `custom` |
| Codex | `codex` | `subscription`, `api-key`, `custom` |
| Gemini | `gemini` | `subscription`, `api-key`, `custom` |
| OpenCode | `opencode` | `subscription`, `api-key`, `custom` |
| Aider | `aider` | `subscription`, `api-key`, `custom` |
| Hermes | `hermes` | `subscription`, `api-key`, `custom` |

`subscription` uses the CLI's native OAuth login. `api-key` passes a key from your environment or directly. `custom` sets a base URL and key for self-hosted or proxy endpoints.

---

## Programmatic API

```ts
import { spawn, orchestrate, fanOut } from 'reevesagents'

// Spawn one session
const session = spawn({
  provider: 'cc',
  auth: 'subscription',
  permissions: 'skip',
  start_prompt: 'build a REST API',
})

// Fan out N identical workers
const sessions = fanOut(
  3,
  { provider: 'cc', auth: 'subscription', permissions: 'skip', model: null, effort: 'high' },
  'fix the tests',
  'sprint-1',
)

// Full orchestration with named workers
const result = orchestrate(
  'build a TODO app',
  'todo-v1',
  { provider: 'cc', auth: 'subscription', permissions: 'skip', model: null, effort: 'high' },
  [
    { name: 'backend', prompt: 'REST API with auth' },
    { name: 'frontend', prompt: 'React UI' },
  ],
)
```

---

## Configuration

Run `reevesagents settings` or use the `/settings` TUI screen. Config is stored at `~/.config/reevesagents/config.json` by default. Override with `REEVES_CONFIG` env var.

---

## Session registry

Active sessions are tracked in `~/.local/share/reevesagents/sessions/` (one JSON file per session). Override with `REEVES_REGISTRY`. Run `reevesagents doctor` to find and prune orphaned entries.

---

## Contributing

```sh
git clone https://github.com/mertkayacs/reevesagents
cd reevesagents
npm install
npm run build
npm test
```

---

## License

Apache 2.0
