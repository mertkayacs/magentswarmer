// CLI entry point. No args = launch TUI. Subcommands run headlessly.
// Inputs: process.argv. Outputs: TUI render or stdout JSON/text.
// Invariant: TUI path awaits until exit; subcommands exit(0) on success, exit(1) on error.

import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import { Router, type RouterProps } from './router.js'
import { Switch } from './screens/Switch.js'
import { spawn } from './launcher/spawn.js'
import { orchestrate } from './launcher/orchestrate.js'
import { peek } from './launcher/peek.js'
import { runDoctor, pruneOrphans } from './launcher/doctor.js'
import { listAll as listSessions, remove as removeSession } from './state/registry.js'
import { loadConfig } from './state/config.js'
// saveConfig is used by config-helpers; not needed directly here
import { getConfigValue, setConfigValue, CONFIG_PROVIDERS as PROVIDERS } from './state/config-helpers.js'
import { loadState, addPreset, removePreset } from './state/store.js'
import { parseWorkers } from './utils/parseWorkers.js'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pickGoodbye } from './brand/goodbye.js'
import type { Provider, Auth, Effort, Permissions, WorkerEntry, SharedFormState } from './state/types.js'

process.on('uncaughtException', (err) => {
  process.stderr.write(`[FATAL] ${err.message}\n`)
  process.exit(1)
})

let goodbyePrinted = false

function printGoodbye(): void {
  if (goodbyePrinted) return
  goodbyePrinted = true
  process.stderr.write(pickGoodbye() + '\n')
}

const program = new Command()

program
  .name('reevesagents')
  .description('spawn and orchestrate AI coding CLIs from one place')
  .version('3.0.0')

program
  .command('spawn', { isDefault: false })
  .description('spawn a single agent session headlessly')
  .requiredOption('-p, --provider <provider>', 'provider: cc, codex, gemini')
  .option('-t, --task <task>', 'start prompt for the agent')
  .option('-a, --auth <auth>', 'auth mode: subscription, api-key, custom', 'subscription')
  .option('-e, --effort <effort>', 'effort: low, medium, high (max = high)')
  .option('--perms <perms>', 'permissions: ask, skip', 'skip')
  .option('-m, --model <model>', 'model override')
  .option('--tag <tag>', 'session tag')
  .option('--working-dir <dir>', 'working directory for the agent (default: cwd)')
  .option('--remote-control', 'poll for remote control URL and store in session')
  .action((opts) => {
    const effortRaw = opts.effort === 'max' ? 'high' : opts.effort
    try {
      const session = spawn({
        provider: opts.provider as Provider,
        auth: opts.auth as Auth,
        permissions: (opts.perms ?? 'skip') as Permissions,
        effort: effortRaw ? effortRaw as Effort : undefined,
        model: opts.model,
        tag: opts.tag,
        start_prompt: opts.task,
        working_dir: opts.workingDir,
        remote_control: opts.remoteControl ?? false,
      })
      console.log(JSON.stringify(session, null, 2))
      console.log(`# attach: tmux attach -t ${session.tmux_session}:${session.tmux_window}`)
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

program
  .command('sessions')
  .description('list active sessions (use --all to include ended)')
  .option('--all', 'include ended sessions')
  .option('--json', 'output JSON array')
  .action((opts) => {
    const all = listSessions()
    const sessions = opts.all ? all : all.filter(s => s.ended_at === null)
    if (opts.json) {
      console.log(JSON.stringify(sessions, null, 2))
    } else {
      if (sessions.length === 0) {
        console.log(opts.all ? 'no sessions' : 'no active sessions')
        return
      }
      for (const s of sessions) {
        const age = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 1000)
        const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`
        const status = s.ended_at ? ' ended' : ''
        console.log(`${s.id}  ${s.provider.padEnd(6)}  ${(s.tag ?? s.name).padEnd(24)}  ${ageStr}${status}`)
      }
    }
  })

program
  .command('info <id>')
  .description('show full JSON for one session')
  .action((id) => {
    const sessions = listSessions()
    const session = sessions.find(s => s.id === id) ?? sessions.find(s => s.id.startsWith(id))
    if (!session) {
      console.error(`session ${id} not found`)
      process.exit(1)
    }
    console.log(JSON.stringify(session, null, 2))
  })

program
  .command('peek <id>')
  .description('show last N lines of a session tmux pane')
  .option('-n, --lines <n>', 'number of lines', '20')
  .option('--json', 'output JSON with lines array')
  .action((id, opts) => {
    const output = peek(id, parseInt(opts.lines, 10))
    if (!output) {
      if (opts.json) {
        console.log(JSON.stringify({ id, lines: null, error: 'session not found or no output' }, null, 2))
        process.exit(1)
      }
      console.error(`no output for session ${id} (session may be gone)`)
      process.exit(1)
    }
    if (opts.json) {
      console.log(JSON.stringify({ id, lines: output.split('\n') }, null, 2))
    } else {
      console.log(output)
    }
  })

program
  .command('attach [id]')
  .description('attach to a session by ID (or ID prefix). No ID: opens tmux window picker')
  .action((id?: string) => {
    if (!id) {
      if (!process.env.TMUX) {
        console.log(`not inside tmux — run:`)
        console.log(`  tmux attach -t reevesagents`)
        console.log(`  tmux switch-client -t reevesagents:<window-name>`)
        process.exit(0)
      }
      try {
        execFileSync('tmux', ['choose-window', '-t', 'reevesagents'], { stdio: 'inherit' })
      } catch {
        console.error(`no tmux session 'reevesagents' found — spawn a session first`)
        process.exit(1)
      }
      return
    }

    const sessions = listSessions()
    let session = sessions.find(s => s.id === id)
    if (!session) {
      const matches = sessions.filter(s => s.id.startsWith(id))
      if (matches.length === 0) {
        console.error(`session ${id} not found`)
        process.exit(1)
      }
      if (matches.length > 1) {
        console.error(`ambiguous — matches: ${matches.map(s => s.id).join(', ')}`)
        process.exit(1)
      }
      session = matches[0]!
    }

    const target = `${session.tmux_session}:${session.tmux_window}`
    if (process.env.TMUX) {
      try {
        execFileSync('tmux', ['switch-client', '-t', target], { stdio: 'ignore' })
        return
      } catch { /* fall through to print */ }
    }
    console.log(`tmux attach -t ${session.tmux_session}`)
    console.log(`# then switch to window:`)
    console.log(`tmux select-window -t ${target}`)
    console.log(`# or if already inside tmux:`)
    console.log(`tmux switch-client -t ${target}`)
  })

program
  .command('kill <id>')
  .description('kill a session and remove it from registry')
  .action((id) => {
    const sessions = listSessions()
    const session = sessions.find(s => s.id === id)
    if (!session) {
      console.error(`session ${id} not found`)
      process.exit(1)
    }
    try {
      execFileSync('tmux', ['kill-window', '-t', `${session.tmux_session}:${session.tmux_window}`], { stdio: 'ignore' })
    } catch {
      // window may already be gone
    }
    removeSession(id)
    console.log(`killed ${id}`)
  })

program
  .command('doctor')
  .description('run health checks')
  .option('--prune', 'prune orphan sessions after checking')
  .option('--json', 'output JSON')
  .action((opts) => {
    const result = runDoctor()
    if (opts.prune && result.orphans.length > 0) pruneOrphans(result.orphans)
    const anyFail = result.checks.some(c => c.status === 'fail')
    if (opts.json) {
      console.log(JSON.stringify({
        ok: !anyFail,
        checks: result.checks,
        orphans: result.orphans,
        pruned: opts.prune ? result.orphans.length : 0,
      }, null, 2))
    } else {
      for (const check of result.checks) {
        const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'
        console.log(`${icon} ${check.name.padEnd(14)} ${check.detail}`)
      }
      if (result.orphans.length > 0) {
        console.log(`\n${result.orphans.length} orphan session${result.orphans.length > 1 ? 's' : ''}`)
        if (opts.prune) console.log('pruned')
        else console.log('run with --prune to remove them')
      }
    }
    process.exit(anyFail ? 1 : 0)
  })

// --- config command group ---

const configCmd = program
  .command('config')
  .description('manage provider and global configuration')
  .option('--json', 'output JSON')
  .action((opts) => {
    const cfg = loadConfig()
    if (opts.json) {
      console.log(JSON.stringify(cfg, null, 2))
    } else {
      for (const [name, p] of Object.entries(cfg.providers)) {
        console.log(`${name.padEnd(8)} auth=${p.auth}  perms=${p.default_permissions}  effort=${p.default_effort ?? '—'}  model=${p.default_model ?? '—'}`)
      }
      console.log(`global   tmux=${cfg.global.tmux_session_name}  peek=${cfg.global.peek_interval_seconds}s`)
    }
  })

configCmd
  .command('get <key>')
  .description('get a single config value (e.g. cc.auth, global.tmux)')
  .option('--json', 'output JSON with key+value')
  .action((key, opts) => {
    const { value, error } = getConfigValue(key)
    if (error) { console.error(error); process.exit(1) }
    if (opts.json) {
      console.log(JSON.stringify({ key, value }, null, 2))
    } else {
      console.log(value ?? '')
    }
  })

configCmd
  .command('set <key> <value>')
  .description('set a config value (e.g. cc.auth api-key, cc.model opus, cc.effort null)')
  .action((key, value) => {
    const error = setConfigValue(key, value)
    if (error) { console.error(error); process.exit(1) }
    console.log(`set ${key} = ${value}`)
  })

program
  .command('switch')
  .description('interactive session picker — select a session to attach to')
  .action(() => {
    const { unmount } = render(
      React.createElement(Switch, { onExit: () => { unmount(); process.exit(0) } })
    )
  })

program
  .command('settings')
  .description('open the TUI settings screen')
  .action(() => {
    render(React.createElement<RouterProps>(Router, { initialScreen: 'Settings' })).waitUntilExit().then(() => process.exit(0))
  })

program
  .command('orchestrate')
  .description('fan out multiple agents headlessly')
  .requiredOption('-g, --goal <goal>', 'overall objective')
  .option('--tag <tag>', 'session tag prefix', 'orchestrate')
  .option('-p, --provider <provider>', 'provider: cc, codex, gemini, opencode, aider, hermes', 'cc')
  .option('-a, --auth <auth>', 'auth mode: subscription, api-key, custom', 'subscription')
  .option('-e, --effort <effort>', 'effort: low, medium, high')
  .option('--perms <perms>', 'permissions: ask, skip', 'skip')
  .option('-w, --worker <worker>', '"name:prompt" (repeat for each worker)', (v: string, acc: string[]) => { acc.push(v); return acc }, [] as string[])
  .option('--working-dir <dir>', 'working directory for all agents (default: cwd)')
  .action((opts) => {
    if ((opts.worker as string[]).length === 0) {
      console.error('at least one --worker required, e.g. -w "backend:build the REST API"')
      process.exit(1)
    }
    const workers = parseWorkers(opts.worker as string[])
    const shared: SharedFormState = {
      provider: opts.provider as Provider,
      auth: opts.auth as Auth,
      model: null,
      permissions: opts.perms as Permissions,
      effort: opts.effort ? opts.effort as Effort : null,
    }
    try {
      const sessions = orchestrate(opts.goal, opts.tag, shared, workers, opts.workingDir)
      console.log(JSON.stringify(sessions, null, 2))
      for (const s of sessions) {
        console.log(`# attach: tmux attach -t ${s.tmux_session}:${s.tmux_window}`)
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

const TMUX_CONF = join(homedir(), '.tmux.conf')
const SETUP_MARKER = '# reevesagents'
const POPUP_BINDING = `bind-key A display-popup -w 90 -h 20 -E "reevesagents switch"`

program
  .command('setup-tmux')
  .description('add reevesagents session picker binding (Prefix+A) to ~/.tmux.conf')
  .action(() => {
    const existing = existsSync(TMUX_CONF) ? readFileSync(TMUX_CONF, 'utf-8') : ''
    if (existing.includes(SETUP_MARKER)) {
      console.log('reevesagents binding already present in ~/.tmux.conf')
      console.log('  Prefix+A opens the session picker from anywhere in tmux')
      process.exit(0)
    }
    const block = `\n${SETUP_MARKER}\n${POPUP_BINDING}\n`
    writeFileSync(TMUX_CONF, existing + block, 'utf-8')
    console.log('added to ~/.tmux.conf:')
    console.log(`  ${POPUP_BINDING}`)
    if (process.env.TMUX) {
      try {
        execFileSync('tmux', ['source-file', TMUX_CONF], { stdio: 'ignore' })
        console.log('reloaded tmux config — Prefix+A is live')
      } catch {
        console.log('could not auto-reload — run: tmux source-file ~/.tmux.conf')
      }
    } else {
      console.log('reload tmux config to activate: tmux source-file ~/.tmux.conf')
    }
  })

// --- history command group ---

const historyCmd = program
  .command('history')
  .description('list ended sessions')
  .option('--json', 'output JSON array')
  .option('--clear', 'delete all ended sessions from registry (requires --confirm)')
  .option('--confirm', 'confirm destructive --clear')
  .action((opts) => {
    const all = listSessions()
    const ended = all.filter(s => s.ended_at !== null).sort((a, b) =>
      new Date(b.ended_at!).getTime() - new Date(a.ended_at!).getTime()
    )
    if (opts.clear) {
      if (!opts.confirm) {
        console.error(`${ended.length} ended session(s) would be deleted — add --confirm to proceed`)
        process.exit(1)
      }
      for (const s of ended) removeSession(s.id)
      console.log(`deleted ${ended.length} session(s)`)
      return
    }
    if (opts.json) {
      console.log(JSON.stringify(ended, null, 2))
    } else {
      if (ended.length === 0) { console.log('no history'); return }
      for (const s of ended) {
        const dur = s.ended_at
          ? Math.floor((new Date(s.ended_at).getTime() - new Date(s.created_at).getTime()) / 1000)
          : 0
        const durStr = dur < 60 ? `${dur}s` : dur < 3600 ? `${Math.floor(dur / 60)}m` : `${Math.floor(dur / 3600)}h`
        console.log(`${s.id}  ${s.provider.padEnd(6)}  ${(s.tag ?? s.name).padEnd(24)}  ${durStr}`)
      }
    }
  })

historyCmd
  .command('delete <id>')
  .description('remove one ended session from registry')
  .action((id) => {
    const sessions = listSessions()
    const session = sessions.find(s => s.id === id)
    if (!session) { console.error(`session ${id} not found`); process.exit(1) }
    removeSession(id)
    console.log(`deleted ${id}`)
  })

// --- presets command group ---

const presetsCmd = program
  .command('presets')
  .description('list saved orchestration presets')
  .option('--json', 'output JSON array')
  .action((opts) => {
    const { presets } = loadState()
    if (opts.json) {
      console.log(JSON.stringify(presets, null, 2))
    } else {
      if (presets.length === 0) { console.log('no presets'); return }
      for (const p of presets) {
        console.log(`${p.name.padEnd(24)}  ${p.workers.length} worker(s)  ${p.shared.provider}/${p.shared.auth}  goal: ${p.goal.slice(0, 40)}`)
      }
    }
  })

presetsCmd
  .command('run <name>')
  .description('fan out all workers from a saved preset')
  .option('--tag <tag>', 'override session tag prefix')
  .action((name, opts) => {
    const { presets } = loadState()
    const preset = presets.find(p => p.name === name)
    if (!preset) { console.error(`preset "${name}" not found`); process.exit(1) }
    const tag = opts.tag ?? `${name}-${Date.now().toString(36)}`
    try {
      const sessions = orchestrate(preset.goal, tag, preset.shared, preset.workers)
      console.log(JSON.stringify(sessions, null, 2))
      for (const s of sessions) {
        console.log(`# attach: tmux attach -t ${s.tmux_session}:${s.tmux_window}`)
      }
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  })

presetsCmd
  .command('delete <name>')
  .description('remove a preset')
  .action((name) => {
    const { presets } = loadState()
    if (!presets.find(p => p.name === name)) { console.error(`preset "${name}" not found`); process.exit(1) }
    removePreset(name)
    console.log(`deleted preset "${name}"`)
  })

presetsCmd
  .command('save <name>')
  .description('save a new preset (same flags as orchestrate)')
  .requiredOption('-g, --goal <goal>', 'overall objective')
  .option('-p, --provider <provider>', 'provider', 'cc')
  .option('-a, --auth <auth>', 'auth mode', 'subscription')
  .option('-e, --effort <effort>', 'effort: low, medium, high')
  .option('--perms <perms>', 'permissions: ask, skip', 'skip')
  .option('-w, --worker <worker>', '"name:prompt" (repeat)', (v: string, acc: string[]) => { acc.push(v); return acc }, [] as string[])
  .action((name, opts) => {
    if ((opts.worker as string[]).length === 0) {
      console.error('at least one --worker required')
      process.exit(1)
    }
    const workers = parseWorkers(opts.worker as string[])
    const shared: SharedFormState = {
      provider: opts.provider as Provider,
      auth: opts.auth as Auth,
      model: null,
      permissions: opts.perms as Permissions,
      effort: opts.effort ? opts.effort as Effort : null,
    }
    addPreset(name, opts.goal, workers, shared)
    console.log(`saved preset "${name}" (${workers.length} worker(s))`)
  })

// Default: launch TUI when no subcommand given
const knownSubcommands = new Set(program.commands.map(c => c.name()))
const firstArg = process.argv[2]

if (!firstArg || (!knownSubcommands.has(firstArg) && !firstArg.startsWith('--'))) {
  render(React.createElement(Router)).waitUntilExit().then(() => process.exit(0))
} else {
  program.parse()
}

process.on('exit', printGoodbye)
