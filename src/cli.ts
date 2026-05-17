// CLI entry point. No args = launch TUI. Subcommands run headlessly.
// Inputs: process.argv. Outputs: TUI render or stdout JSON/text.
// Invariant: TUI path awaits until exit; subcommands exit(0) on success, exit(1) on error.

import React from 'react'
import { render } from 'ink'
import { Command } from 'commander'
import { Router } from './router.js'
import { peek } from './launcher/peek.js'
import { runDoctor, pruneOrphans } from './launcher/doctor.js'
import { listAll, updateSession, computeStatus, nowIso } from './state/registry.js'
import { startMcpServer } from './mcp.js'
import { registerAll } from './mcp-setup.js'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { pickGoodbye } from './brand/goodbye.js'

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
  .version('0.9.0')

// Primary surface: MCP server over stdio. CC/Codex/Gemini connect here.
program
  .command('mcp')
  .description('start MCP server (stdio) — register with: reevesagents setup')
  .action(async () => {
    await startMcpServer()
  })

// One-time setup: detect installed CLIs, write MCP config entries.
program
  .command('setup')
  .description('detect installed CLIs and register reevesagents as their MCP server')
  .option('--json', 'output JSON array')
  .action((opts) => {
    const results = registerAll()
    if (opts.json) {
      console.log(JSON.stringify(results, null, 2))
      return
    }
    for (const r of results) {
      const icon = r.registered ? '✓' : r.detected ? '✗' : '—'
      const label = r.registered ? 'registered' : r.detected ? 'detected, not registered' : 'not found'
      console.log(`${icon} ${r.cli.padEnd(12)}  ${label}${r.note ? `  (${r.note})` : ''}`)
    }
  })

program
  .command('sessions')
  .description('list sessions (use --all to include ended)')
  .option('--all', 'include ended sessions')
  .option('--json', 'output JSON array')
  .action((opts) => {
    const all = listAll()
    const sessions = opts.all ? all : all.filter(s => s.ended_at === null)
    if (opts.json) {
      console.log(JSON.stringify(sessions.map(s => ({ ...s, status: computeStatus(s) })), null, 2))
      return
    }
    if (sessions.length === 0) {
      console.log(opts.all ? 'no sessions' : 'no active sessions')
      return
    }
    for (const s of sessions) {
      const age = Math.floor((Date.now() - new Date(s.started_at).getTime()) / 1000)
      const ageStr = age < 60 ? `${age}s` : age < 3600 ? `${Math.floor(age / 60)}m` : `${Math.floor(age / 3600)}h`
      console.log(`${s.id.slice(0, 8)}  ${s.provider.padEnd(8)}  ${s.nickname.padEnd(20)}  ${ageStr}  ${computeStatus(s)}`)
    }
  })

program
  .command('info <id>')
  .description('show full JSON for one session')
  .action((id) => {
    const all = listAll()
    const session = all.find(s => s.id === id) ?? all.find(s => s.id.startsWith(id))
    if (!session) { console.error(`session ${id} not found`); process.exit(1) }
    console.log(JSON.stringify({ ...session, status: computeStatus(session) }, null, 2))
  })

program
  .command('peek <id>')
  .description('show last N lines of a session tmux pane')
  .option('-n, --lines <n>', 'number of lines', '20')
  .option('--json', 'output JSON with lines array')
  .action((id, opts) => {
    const all = listAll()
    const session = all.find(s => s.id === id) ?? all.find(s => s.id.startsWith(id))
    if (!session) { console.error(`session ${id} not found`); process.exit(1) }
    const output = peek(session.id, parseInt(opts.lines, 10))
    if (!output) {
      if (opts.json) {
        console.log(JSON.stringify({ id, lines: null, error: 'no output — session may be gone' }, null, 2))
        process.exit(1)
      }
      console.error(`no output for session ${id}`)
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
  .description('attach to a session by ID or prefix. No ID: list active sessions')
  .action((id?: string) => {
    if (!id) {
      const active = listAll().filter(s => s.ended_at === null)
      if (active.length === 0) { console.log('no active sessions'); process.exit(0) }
      console.log('active sessions (tmux attach -t <name>):')
      for (const s of active) {
        console.log(`  ${s.tmux_session.padEnd(40)}  ${s.nickname}  ${s.provider}`)
      }
      process.exit(0)
    }

    const all = listAll()
    let session = all.find(s => s.id === id)
    if (!session) {
      const matches = all.filter(s => s.id.startsWith(id))
      if (matches.length === 0) { console.error(`session ${id} not found`); process.exit(1) }
      if (matches.length > 1) { console.error(`ambiguous — matches: ${matches.map(s => s.id).join(', ')}`); process.exit(1) }
      session = matches[0]!
    }

    if (process.env.TMUX) {
      try { execFileSync('tmux', ['switch-client', '-t', session.tmux_session], { stdio: 'ignore' }); return } catch { /* fall through */ }
    }
    console.log(`tmux attach -t ${session.tmux_session}`)
  })

program
  .command('kill <id>')
  .description('kill a session (tmux + mark ended). --cascade kills the entire subtree')
  .option('--cascade', 'kill all sessions sharing the same root_id')
  .action((id, opts) => {
    const all = listAll()
    const session = all.find(s => s.id === id) ?? all.find(s => s.id.startsWith(id))
    if (!session) { console.error(`session ${id} not found`); process.exit(1) }

    const targets = opts.cascade
      ? all.filter(s => s.root_id === session.root_id && !s.ended_at).sort((a, b) => b.depth_level - a.depth_level)
      : [session]

    for (const s of targets) {
      try { execFileSync('tmux', ['kill-session', '-t', s.tmux_session], { stdio: 'ignore' }) } catch { /* already gone */ }
      updateSession(s.id, { ended_at: nowIso() })
      console.log(`killed ${s.id.slice(0, 8)}  ${s.nickname}`)
    }
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
      console.log(JSON.stringify({ ok: !anyFail, checks: result.checks, orphans: result.orphans, pruned: opts.prune ? result.orphans.length : 0 }, null, 2))
    } else {
      for (const check of result.checks) {
        const icon = check.status === 'ok' ? '✓' : check.status === 'warn' ? '!' : '✗'
        console.log(`${icon} ${check.name.padEnd(14)} ${check.detail}`)
      }
      if (result.orphans.length > 0) {
        console.log(`\n${result.orphans.length} orphan session${result.orphans.length > 1 ? 's' : ''}`)
        console.log(opts.prune ? 'pruned' : 'run with --prune to remove them')
      }
    }
    process.exit(anyFail ? 1 : 0)
  })

const TMUX_CONF = join(homedir(), '.tmux.conf')
const SETUP_MARKER = '# reevesagents'
const POPUP_BINDING = `bind-key A display-popup -w 120 -h 30 -E "reevesagents"`

program
  .command('setup-tmux')
  .description('add reevesagents TUI popup binding (Prefix+A) to ~/.tmux.conf')
  .action(() => {
    const existing = existsSync(TMUX_CONF) ? readFileSync(TMUX_CONF, 'utf-8') : ''
    if (existing.includes(SETUP_MARKER)) {
      console.log('reevesagents binding already present in ~/.tmux.conf')
      process.exit(0)
    }
    writeFileSync(TMUX_CONF, existing + `\n${SETUP_MARKER}\n${POPUP_BINDING}\n`, 'utf-8')
    console.log(`added to ~/.tmux.conf:\n  ${POPUP_BINDING}`)
    if (process.env.TMUX) {
      try { execFileSync('tmux', ['source-file', TMUX_CONF], { stdio: 'ignore' }); console.log('reloaded — Prefix+A is live') }
      catch { console.log('could not auto-reload — run: tmux source-file ~/.tmux.conf') }
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
