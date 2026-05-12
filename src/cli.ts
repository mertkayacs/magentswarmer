// CLI entry point. No args = launch TUI. Subcommands run headlessly.
// Inputs: process.argv. Outputs: TUI render or stdout JSON/text.
// Invariant: TUI path awaits until exit; subcommands exit(0) on success, exit(1) on error.

import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import { Router } from './router.js'
import { Switch } from './screens/Switch.js'
import { spawn } from './launcher/spawn.js'
import { peek } from './launcher/peek.js'
import { runDoctor, pruneOrphans } from './launcher/doctor.js'
import { listAll as listSessions, remove as removeSession } from './state/registry.js'
import { loadConfig } from './state/config.js'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Provider, Auth, Effort, Permissions } from './state/types.js'

const GOODBYE_MESSAGES = [
  'goodbye', 'au revoir', 'auf Wiedersehen', 'hasta luego', 'arrivederci',
  'sayonara', 'annyeong', 'zai jian', 'khuda hafiz', 'vale',
  'adieu', 'do svidaniya', 'tchau', 'tot ziens', 'farvel',
  'hej da', 'nakupenda', 'aloha', 'ciao', 'shukran',
  'namaste', 'mersi', 'dag', 'czesc', 'pa pa',
  'yasas', 'güle güle', 'slaan well', 'do pobachennya', 'kwa heri',
]

let goodbyePrinted = false

function printGoodbye(): void {
  if (goodbyePrinted) return
  goodbyePrinted = true
  const msg = GOODBYE_MESSAGES[Math.floor(Math.random() * GOODBYE_MESSAGES.length)]
  process.stderr.write(msg + '\n')
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
  .requiredOption('-t, --task <task>', 'start prompt for the agent')
  .option('-a, --auth <auth>', 'auth mode: subscription, api-key, custom', 'subscription')
  .option('-e, --effort <effort>', 'effort: low, medium, high')
  .option('--perms <perms>', 'permissions: ask, skip', 'skip')
  .option('-m, --model <model>', 'model override')
  .option('--tag <tag>', 'session tag')
  .action((opts) => {
    try {
      const session = spawn({
        provider: opts.provider as Provider,
        auth: opts.auth as Auth,
        permissions: (opts.perms ?? 'skip') as Permissions,
        effort: opts.effort ? opts.effort as Effort : undefined,
        model: opts.model,
        tag: opts.tag,
        start_prompt: opts.task,
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
  .description('list all sessions in registry')
  .option('--json', 'output JSON array')
  .action((opts) => {
    const sessions = listSessions()
    if (opts.json) {
      console.log(JSON.stringify(sessions, null, 2))
    } else {
      if (sessions.length === 0) {
        console.log('no sessions')
        return
      }
      for (const s of sessions) {
        const age = Math.floor((Date.now() - new Date(s.created_at).getTime()) / 1000)
        const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`
        console.log(`${s.id}  ${s.provider.padEnd(6)}  ${(s.tag ?? s.name).padEnd(24)}  ${ageStr}`)
      }
    }
  })

program
  .command('peek <id>')
  .description('show last 20 lines of a session tmux pane')
  .option('-n, --lines <n>', 'number of lines', '20')
  .action((id, opts) => {
    const output = peek(id, parseInt(opts.lines, 10))
    if (!output) {
      console.error(`no output for session ${id} (session may be gone)`)
      process.exit(1)
    }
    console.log(output)
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
  .action((opts) => {
    const result = runDoctor()
    for (const check of result.checks) {
      const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'
      console.log(`${icon} ${check.name.padEnd(14)} ${check.detail}`)
    }
    if (result.orphans.length > 0) {
      console.log(`\n${result.orphans.length} orphan sessions`)
      if (opts.prune) {
        pruneOrphans(result.orphans)
        console.log('pruned')
      } else {
        console.log('run with --prune to remove them')
      }
    }
    const anyFail = result.checks.some(c => c.status === 'fail')
    process.exit(anyFail ? 1 : 0)
  })

program
  .command('config')
  .description('show current config path and summary')
  .action(() => {
    const cfg = loadConfig()
    for (const [name, p] of Object.entries(cfg.providers)) {
      console.log(`${name.padEnd(8)} auth=${p.auth}  perms=${p.default_permissions}  effort=${p.default_effort ?? '—'}`)
    }
  })

program
  .command('switch')
  .description('interactive session picker — select a session to attach to')
  .action(() => {
    const { unmount } = render(
      React.createElement(Switch, { onExit: () => { unmount(); process.exit(0) } })
    )
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

// Default: launch TUI when no subcommand given
const knownSubcommands = new Set(program.commands.map(c => c.name()))
const firstArg = process.argv[2]

if (!firstArg || (!knownSubcommands.has(firstArg) && !firstArg.startsWith('--'))) {
  render(React.createElement(Router)).waitUntilExit().then(() => process.exit(0))
} else {
  program.parse()
}

process.on('exit', printGoodbye)
