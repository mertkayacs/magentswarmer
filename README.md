# reevesagents

Compose and run AI CLI trees from one terminal UI. Reevesagents starts each agent in tmux, keeps a registry of the tree, lets agents message each other through MCP, and can link any agent window into your current tmux session.

## What it does

- **TUI**: session tree, live peek panel, single-agent spawn form, compose-then-launch trees, presets, settings, and doctor checks.
- **MCP server**: focused orchestration tools for spawning, inspecting, messaging, waiting, killing, and generating tmux jump commands.
- **tmux-native**: every agent runs in its own tmux session. Press `Enter` in the tree to link the selected agent as `ra:<nickname>` in your current tmux session.

## Requirements

- macOS, Linux, or Windows via WSL. Native Windows is not supported because reevesagents depends on tmux and POSIX shell behavior.
- Node.js 20.19+
- tmux
- At least one supported CLI: `claude`, `codex`, `gemini`, or `hermes`

## Install

```sh
git clone https://github.com/mertkayacs/reevesagents.git
cd reevesagents
pnpm install
pnpm build
pnpm link --global
```

## Quick start

```sh
reevesagents
```

First run: open `/settings` and run `[ DETECT + REGISTER CLIs ]` to add the reevesagents MCP server to installed CLI configs.

Then run:

```sh
reevesagents doctor
```

`doctor` checks tmux, writable state, installed providers, and provider CLI flag compatibility. This catches common machine-to-machine drift, such as older Gemini or Hermes versions that do not support the skip/trust flags reevesagents uses only when `permissions` is set to `skip`.

Optional tmux popup binding:

```sh
reevesagents setup-tmux
```

## TUI navigation

| Key | Action |
|-----|--------|
| `s` | spawn one agent |
| `o` | compose and launch an agent tree |
| `d` | doctor checks |
| `?` | help |
| `r` | send remote-control signal to selected Claude Code session |
| `k` | kill selected session |
| `Enter` | link or attach selected session |
| `/` + text | command search |
| `Esc` | go back |

## CLI commands

```sh
reevesagents sessions          # list sessions
reevesagents peek <id>         # show live output
reevesagents attach [id]       # print or switch to tmux session
reevesagents kill <id>         # end a session
reevesagents info <id>         # session detail
reevesagents doctor            # health check
reevesagents setup             # register MCP configs
reevesagents setup-tmux        # add tmux key binding
reevesagents mcp               # start MCP server over stdio
```

## MCP tools

`spawn`, `list`, `tree`, `peek`, `send_message`, `check_messages`, `update_task`, `wait`, `kill`, `jump_command`

Registering writes provider-specific MCP config entries:

- Claude Code: `~/.claude/settings.json`
- Codex CLI: `~/.codex/config.toml`
- Gemini CLI: `~/.gemini/settings.json`
- Hermes: `~/.hermes/config.yaml`

## Supported providers

| Key | CLI | Notes |
|-----|-----|-------|
| `cc` | Claude Code | RC via `/remote-control`; supports `--bare` auth mode and `--effort` |
| `codex` | OpenAI Codex | RC at launch via `--enable remote_control` |
| `gemini` | Gemini CLI | Skip permissions maps to `--yolo --skip-trust` |
| `hermes` | Hermes | Launches with `hermes chat`; skip permissions maps to `--yolo` |

## Development

```sh
pnpm install
pnpm dev
pnpm test
pnpm typecheck
pnpm build
```

## License

Apache 2.0
