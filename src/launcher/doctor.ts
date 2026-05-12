// Run health checks on reevesagents environment.
// Inputs: none (reads system state).
// Outputs: DoctorResult with checks and list of orphaned sessions.
// Invariant: all checks complete even if some fail; orphans are sessions in registry but not in tmux.

import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CheckResult } from '../state/types.js'
import { detectAvailable, BIN } from './providers.js'
import { registryDir, listAll as listSessions, remove as removeSession } from '../state/registry.js'

export interface DoctorResult {
  checks: CheckResult[]
  orphans: import('../state/types.js').Session[]
}

function checkNodeVersion(): CheckResult {
  try {
    const version = execSync('node -v', { encoding: 'utf8' }).trim().slice(1)
    const [major] = version.split('.').map(Number)

    if (major >= 20) {
      return {
        name: 'node',
        status: 'ok',
        detail: version
      }
    } else {
      return {
        name: 'node',
        status: 'fail',
        detail: `${version} (need >=20.0.0)`
      }
    }
  } catch {
    return {
      name: 'node',
      status: 'fail',
      detail: 'not found'
    }
  }
}

function checkTmux(): CheckResult {
  try {
    const version = execSync('tmux -V', { encoding: 'utf8' }).trim()
    return {
      name: 'tmux',
      status: 'ok',
      detail: version
    }
  } catch {
    return {
      name: 'tmux',
      status: 'fail',
      detail: 'not on PATH (brew install tmux)'
    }
  }
}

function checkProviders(): CheckResult {
  const available = detectAvailable()
  const providers = Object.entries(available)
  const statuses = providers
    .map(([name, isAvail]) => (isAvail ? `${name} ✓` : `${name} ✗`))
    .join('  ')

  const allAvail = providers.every(([, isAvail]) => isAvail)
  const noneAvail = providers.every(([, isAvail]) => !isAvail)

  return {
    name: 'providers',
    status: noneAvail ? 'fail' : allAvail ? 'ok' : 'warn',
    detail: statuses
  }
}

function checkStateDir(): CheckResult {
  const stateDir = join(homedir(), '.reeves')

  if (!existsSync(stateDir)) {
    return {
      name: 'state dir',
      status: 'warn',
      detail: `${stateDir} (will be created on first use)`
    }
  }

  try {
    accessSync(stateDir, constants.W_OK)
    return {
      name: 'state dir',
      status: 'ok',
      detail: stateDir
    }
  } catch {
    return {
      name: 'state dir',
      status: 'fail',
      detail: `${stateDir} (not writable)`
    }
  }
}

function checkRegistry(): CheckResult {
  try {
    const sessions = listSessions()
    return {
      name: 'registry',
      status: 'ok',
      detail: `${sessions.length} session${sessions.length === 1 ? '' : 's'}`
    }
  } catch (err) {
    return {
      name: 'registry',
      status: 'fail',
      detail: `error reading registry: ${err instanceof Error ? err.message : 'unknown'}`
    }
  }
}

function findOrphans(): { check: CheckResult; orphans: import('../state/types.js').Session[] } {
  const orphans: import('../state/types.js').Session[] = []

  try {
    const sessions = listSessions()

    // Get all tmux windows in reevesagents session
    let tmuxWindows: string[] = []
    try {
      const output = execSync(
        'tmux list-windows -t reevesagents -F "#{window_name}"',
        { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
      )
      tmuxWindows = output.trim().split('\n').filter(Boolean)
    } catch {
      // reevesagents session may not exist yet
    }

    const windowSet = new Set(tmuxWindows)

    for (const session of sessions) {
      if (!windowSet.has(session.tmux_window)) {
        orphans.push(session)
      }
    }

    const detail =
      orphans.length === 0
        ? 'none'
        : `${orphans.length}: ${orphans.map((s) => s.id).join(', ')}`

    return {
      check: {
        name: 'orphans',
        status: orphans.length === 0 ? 'ok' : 'warn',
        detail
      },
      orphans
    }
  } catch (err) {
    return {
      check: {
        name: 'orphans',
        status: 'fail',
        detail: `error checking: ${err instanceof Error ? err.message : 'unknown'}`
      },
      orphans: []
    }
  }
}

export function runDoctor(): DoctorResult {
  const checks: CheckResult[] = [
    checkNodeVersion(),
    checkTmux(),
    checkProviders(),
    checkStateDir(),
    checkRegistry()
  ]

  const { check: orphanCheck, orphans } = findOrphans()
  checks.push(orphanCheck)

  return { checks, orphans }
}

export function pruneOrphans(orphans: import('../state/types.js').Session[]): void {
  for (const session of orphans) {
    removeSession(session.id)
  }
}
