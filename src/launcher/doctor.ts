// Run health checks on reevesagents environment.
// Inputs: none (reads system state).
// Outputs: DoctorResult with checks and list of orphaned sessions.
// Invariant: all checks complete even if some fail; orphans are sessions in registry but not in tmux.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { accessSync, constants } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { CheckResult, Session } from '../state/types.js'
import { detectAvailable, inspectProviderCompatibility } from './providers.js'
import { listAll as listSessions, updateSession, nowIso } from '../state/registry.js'

export interface DoctorResult {
  checks: CheckResult[]
  orphans: Session[]
}

function checkNodeVersion(): CheckResult {
  // process.version is authoritative — no need for a subprocess
  const version = process.version.slice(1) // strip leading 'v'
  const major = parseInt(version.split('.')[0] ?? '0', 10)
  return {
    name: 'node',
    status: major >= 20 ? 'ok' : 'fail',
    detail: major >= 20 ? version : `${version} (need >=20.0.0)`,
  }
}

function readProcVersion(): string {
  try {
    return readFileSync('/proc/version', 'utf-8')
  } catch {
    return ''
  }
}

type EnvMap = Record<string, string | undefined>

function isWsl(env: EnvMap, procVersion: string): boolean {
  return Boolean(
    env.WSL_DISTRO_NAME ||
    env.WSL_INTEROP ||
    /microsoft|wsl/i.test(procVersion)
  )
}

export function platformSupportCheck(
  platform = process.platform,
  env: EnvMap = process.env,
  procVersion = platform === 'linux' ? readProcVersion() : '',
): CheckResult {
  if (platform === 'darwin') {
    return { name: 'platform', status: 'ok', detail: 'macOS supported' }
  }

  if (platform === 'linux') {
    return {
      name: 'platform',
      status: 'ok',
      detail: isWsl(env, procVersion) ? 'WSL supported' : 'Linux supported',
    }
  }

  if (platform === 'win32') {
    return {
      name: 'platform',
      status: 'fail',
      detail: 'native Windows unsupported — use WSL with tmux and provider CLIs installed inside WSL',
    }
  }

  return {
    name: 'platform',
    status: 'warn',
    detail: `${platform} is untested — supported targets are macOS, Linux, and WSL`,
  }
}

function checkTmux(): CheckResult {
  try {
    const versionStr = execFileSync('tmux', ['-V'], { encoding: 'utf8' }).trim()
    const match = versionStr.match(/tmux (\d+)\.(\d+)/)
    if (!match) {
      return { name: 'tmux', status: 'warn', detail: `unexpected version format: ${versionStr}` }
    }
    const major = parseInt(match[1] ?? '0', 10)
    const minor = parseInt(match[2] ?? '0', 10)
    if (major < 3) {
      return { name: 'tmux', status: 'warn', detail: `tmux ${major}.${minor} — upgrade to 3.0+ recommended` }
    }
    return { name: 'tmux', status: 'ok', detail: `tmux ${major}.${minor}` }
  } catch {
    return { name: 'tmux', status: 'fail', detail: 'not on PATH (brew install tmux)' }
  }
}

function checkProviders(): CheckResult {
  const available = detectAvailable()
  const providers = Object.entries(available)
  const statuses = providers
    .map(([name, isAvail]) => (isAvail ? `${name} ✓` : `${name} ✗`))
    .join('  ')

  const noneAvail = providers.every(([, isAvail]) => !isAvail)

  return {
    name: 'providers',
    status: noneAvail ? 'fail' : 'ok',
    detail: statuses
  }
}

function checkProviderCompatibility(): CheckResult {
  if (process.env.REEVES_DOCTOR_SKIP_PROVIDER_COMPAT === '1') {
    return {
      name: 'provider compat',
      status: 'warn',
      detail: 'skipped by REEVES_DOCTOR_SKIP_PROVIDER_COMPAT',
    }
  }

  const compatibility = inspectProviderCompatibility()
  const installed = Object.values(compatibility).filter(p => p.available)
  if (installed.length === 0) {
    return {
      name: 'provider compat',
      status: 'warn',
      detail: 'no installed providers to inspect',
    }
  }

  const problems = installed
    .filter(p => !p.ok)
    .map(p => `${p.provider}: ${p.detail}`)

  if (problems.length === 0) {
    return {
      name: 'provider compat',
      status: 'ok',
      detail: `${installed.map(p => p.provider).join(', ')} compatible`,
    }
  }

  return {
    name: 'provider compat',
    status: 'warn',
    detail: problems.slice(0, 3).join('; ') + (problems.length > 3 ? `; +${problems.length - 3} more` : ''),
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

function checkTmuxBinding(): CheckResult {
  const conf = join(homedir(), '.tmux.conf')
  try {
    const content = readFileSync(conf, 'utf-8')
    const bound = content.includes('# reevesagents')
    return {
      name: 'tmux binding',
      status: bound ? 'ok' : 'warn',
      detail: bound
        ? 'Prefix+A session picker active'
        : 'not configured — run: reevesagents setup-tmux',
    }
  } catch {
    return {
      name: 'tmux binding',
      status: 'warn',
      detail: 'no ~/.tmux.conf — run: reevesagents setup-tmux',
    }
  }
}

function findOrphans(): { check: CheckResult; orphans: Session[] } {
  const orphans: Session[] = []
  try {
    const active = listSessions().filter(s => s.ended_at === null)
    for (const session of active) {
      try {
        execFileSync('tmux', ['has-session', '-t', session.tmux_session], { stdio: 'ignore' })
      } catch {
        orphans.push(session)
      }
    }
    const detail = orphans.length === 0
      ? 'none'
      : `${orphans.length}: ${orphans.map(s => s.id.slice(0, 8)).join(', ')}`
    return {
      check: { name: 'orphans', status: orphans.length === 0 ? 'ok' : 'warn', detail },
      orphans,
    }
  } catch (err) {
    return {
      check: { name: 'orphans', status: 'fail', detail: `error checking: ${err instanceof Error ? err.message : 'unknown'}` },
      orphans: [],
    }
  }
}

export function runDoctor(): DoctorResult {
  const checks: CheckResult[] = [
    platformSupportCheck(),
    checkNodeVersion(),
    checkTmux(),
    checkTmuxBinding(),
    checkProviders(),
    checkProviderCompatibility(),
    checkStateDir(),
    checkRegistry()
  ]

  const { check: orphanCheck, orphans } = findOrphans()
  checks.push(orphanCheck)

  return { checks, orphans }
}

export function pruneOrphans(orphans: Session[]): void {
  for (const session of orphans) {
    updateSession(session.id, { ended_at: nowIso() })
  }
}
