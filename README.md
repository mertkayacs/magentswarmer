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

`subscription` uses the CLI's native OAuth login. `api-key` passes a key from your environment or directly. `custom` sets a base URL and key for self-hosted or proxy endpoints.

---

## Programmatic API

```ts
import { spawn, orchestrate, fanOut } from 'reevesagents'

// Spawn one session
const session = await spawn({
  provider: 'cc',
  auth: 'subscription',
  permissions: 'skip',
  prompt: 'build a REST API',
})

// Fan out N identical workers
const sessions = await fanOut({
  count: 3,
  provider: 'cc',
  auth: 'subscription',
  permissions: 'skip',
  prompt: 'fix the tests',
})

// Full orchestration with named workers
const result = await orchestrate(
  'build a TODO app',
  'todo-v1',
  { provider: 'cc', auth: 'subscription', permissions: 'skip', effort: 'high' },
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
