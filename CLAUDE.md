# reevesagents — dev notes for Claude Code

Node.js 20+ / TypeScript / React 19 / Ink 7 CLI tool.

---

## Commands

```sh
pnpm build          # tsup → dist/cli.js + dist/index.js (ESM + DTS)
pnpm dev            # tsup --watch
pnpm test           # vitest run (44 tests)
pnpm test:watch     # vitest in watch mode
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint src test
```

---

## Project layout

```
src/
  state/
    types.ts        # all shared types: Session, Config, AppState, SpawnConfig, ...
    registry.ts     # per-session JSON files in REEVES_REGISTRY dir
    config.ts       # provider + UI config in REEVES_CONFIG file
    store.ts        # app state + presets + history in REEVES_STATE file
  launcher/
    providers.ts    # buildCommand, buildEnv, detectAvailable
    orchestrator.ts # spawn, orchestrate, fanOut, peek
    doctor.ts       # runDoctor, pruneOrphans
  screens/
    Welcome.tsx     # first-run detection + provider status
    Home.tsx        # dashboard: sessions + provider badges
    Sessions.tsx    # session browser with peek panel
    Spawn.tsx       # 8-field spawn form
    Orchestrate.tsx # multi-worker orchestration form
    Settings.tsx    # provider config editor
    Doctor.tsx      # system checks + orphan pruner
    Help.tsx        # key reference
  components/
    Banner.tsx
    StatusBar.tsx
    CommandBar.tsx
    ProviderBadge.tsx
    SessionRow.tsx
  hooks/
    useScreenNav.ts # slash-command routing + ESC stack + command mode
    usePanes.ts     # terminal width → 1/2/3 pane tiers
  router.tsx        # screen stack, SLASH_ROUTES dispatch
  cli.ts            # Commander entry; falls through to TUI for unknown args
  index.ts          # public API re-exports
test/
  config.test.ts
  registry.test.ts
  store.test.ts
  providers.test.ts
  doctor.test.ts
```

---

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `REEVES_CONFIG` | `~/.config/reevesagents/config.json` | Config file path |
| `REEVES_REGISTRY` | `~/.local/share/reevesagents/sessions` | Session registry dir |
| `REEVES_STATE` | `~/.local/share/reevesagents/state.json` | App state file |

Tests set these to temp dirs and clean up after each run.

---

## Key invariants

- All output is ESM. No CommonJS. `"type": "module"` in package.json.
- `tsconfig.json` has `"types": ["node"]` and `"ignoreDeprecations": "6.0"` (tsup adds baseUrl internally, TS 6 deprecates it).
- `noUncheckedIndexedAccess` is `false`. Object indexing returns `T`, not `T | undefined`.
- Union type casts in mergeDefaults functions must use exact union types (`as Auth`, `as Provider`, etc.), not `as string`.
- `useScreenNav(push, pop, disabled?)` — pass `disabled=true` while a text field is focused to prevent command-mode conflicts.
- Each screen handles its own useInput with `{ isActive: !cmdMode }` or `{ isActive: fieldFocused }` guards.
- Destructive operations (`rm`, `DROP`, `force-push`) require `ALLOW_DESTRUCTIVE=1` prefix per hook policy.

---

## tsup config

`tsup.config.ts` builds two entry points: `src/cli.ts` (binary) and `src/index.ts` (library). Both ESM, both with `.d.ts`. The `cli.ts` output gets `#!/usr/bin/env node` prepended via the `banner` option.

---

## Adding a new screen

1. Create `src/screens/MyScreen.tsx` — export default React component using Ink primitives.
2. Add route to `SLASH_ROUTES` in `src/hooks/useScreenNav.ts`.
3. Register in `src/router.tsx` screen map.
4. Export from `src/index.ts` if needed in the public API.

---

## Test isolation

Tests use dynamic `import()` inside each `it()` block and isolate state via env vars set in `beforeEach`. This avoids module caching across tests when env vars change.

Pattern:
```ts
beforeEach(() => { process.env.REEVES_CONFIG = join(tmpDir, 'config.json') })
afterEach(() => { delete process.env.REEVES_CONFIG; rmSync(tmpDir, ...) })
it('...', async () => {
  const { loadConfig } = await import('../src/state/config.js')
  ...
})
```
