# Changelog

All notable changes to reevesagents are documented here.

---

## [3.0.0] — 2026-05-12

Full rewrite from Python/Textual to Node.js 20+ / TypeScript / React 19 / Ink 7.

### What changed

- **Runtime:** Python → Node.js 20.19+. Distributed via npm, installed with `npm install -g reevesagents`.
- **TUI framework:** Textual → Ink 7. Terminal UI built with React components.
- **Language:** Python → TypeScript 6 with strict mode, ESM-only output.
- **Build:** tsup produces `dist/cli.js` (binary) and `dist/index.js` (programmatic API), both ESM with full `.d.ts` types.
- **Test suite:** pytest → vitest. 44 unit tests across state, config, registry, providers, and doctor modules.

### New screens

`Welcome`, `Home`, `Spawn`, `Orchestrate`, `Sessions`, `Settings`, `Doctor`, `Help`

### New CLI subcommands

`spawn`, `sessions`, `peek`, `kill`, `doctor`, `config`

### Programmatic API

`spawn`, `orchestrate`, `fanOut`, `peek`, `runDoctor`, `pruneOrphans`, `detectAvailable`, `buildCommand`, `buildEnv` plus full re-exports of all state functions and types.

### Architecture

- `src/state/` — registry (per-session JSON files), config (provider settings), store (app state + presets)
- `src/launcher/` — providers (command + env builders, detection), orchestrator (spawn, orchestrate, fanOut, peek)
- `src/screens/` — one React/Ink component per screen
- `src/components/` — shared: Banner, StatusBar, CommandBar, ProviderBadge, SessionRow
- `src/hooks/` — useScreenNav (routing + command mode), usePanes (terminal width tiers)
- `src/router.tsx` — screen stack, slash-command dispatch
- `src/cli.ts` — Commander entry point; falls through to TUI when no known subcommand
- `src/index.ts` — public programmatic API

---

## [2.x] — archived

The Python/Textual implementation lives in git history. v2 was a Click CLI with a Textual TUI layer added on top. It ran on Python 3.12+ and was distributed via PyPI.

Tag `v2-final` marks the last Python commit before this rewrite began.

---

## [1.x] — archived

Initial CLI release. Python, Click only, no TUI. Core spawner and orchestrator logic established here.
