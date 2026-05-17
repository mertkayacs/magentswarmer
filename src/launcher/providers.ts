// Build CLI commands for supported providers.
// Each provider has a different binary, permission flags, and model args.
// RC (remote control) is provider-specific: CC uses send-keys inject, Codex uses a startup flag.

import { execFileSync } from 'node:child_process'
import type { Provider, Permissions, AuthMode, Effort } from '../state/types.js'

export interface BuildCommandOptions {
  provider: Provider
  permissions: Permissions
  model: string
  auth_mode?: AuthMode
  effort?: Effort
  rc_enabled?: boolean
}

export const BIN: Record<Provider, string> = {
  cc: 'claude',
  codex: 'codex',
  gemini: 'gemini',
  hermes: 'hermes',
}

// API key env var name per provider — used by mcp-setup and doctor.
export const DEFAULT_KEY_VAR: Record<Provider, string> = {
  cc: 'ANTHROPIC_API_KEY',
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  hermes: 'ANTHROPIC_API_KEY',
}

export const PROVIDERS = Object.keys(BIN) as Provider[]
const HELP_INSPECT_TIMEOUT_MS = 3000
const HELP_INSPECT_TOTAL_BUDGET_MS = 8000

interface HelpRequirement {
  feature: string
  tokens: string[]
}

export interface ProviderCompatibility {
  provider: Provider
  available: boolean
  ok: boolean
  detail: string
  missing: string[]
}

const HELP_REQUIREMENTS: Record<Provider, HelpRequirement[]> = {
  cc: [
    { feature: 'skip permissions', tokens: ['--dangerously-skip-permissions'] },
  ],
  codex: [
    { feature: 'skip permissions', tokens: ['--dangerously-bypass-approvals-and-sandbox'] },
  ],
  gemini: [
    { feature: 'skip permissions', tokens: ['--yolo', '--skip-trust'] },
  ],
  hermes: [
    { feature: 'chat launch', tokens: ['--model'] },
    { feature: 'skip permissions', tokens: ['--yolo'] },
  ],
}

export function isProvider(value: unknown): value is Provider {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(BIN, value)
}

export function buildCommand(opts: BuildCommandOptions): string[] {
  const { provider, permissions, model, auth_mode = 'default', effort = 'default', rc_enabled = false } = opts
  if (!isProvider(provider)) {
    throw new Error(`Unsupported provider: ${String(provider)}`)
  }

  const cmd: string[] = [BIN[provider]]

  if (provider === 'cc') {
    if (permissions === 'skip') cmd.push('--dangerously-skip-permissions')
    if (auth_mode === 'api-key') cmd.push('--bare')
    if (effort !== 'default') cmd.push('--effort', effort)
    if (model) cmd.push('--model', model)
    // RC injected via send-keys after startup; not a launch flag for CC
    return cmd
  }

  if (provider === 'codex') {
    if (permissions === 'skip') cmd.push('--dangerously-bypass-approvals-and-sandbox')
    if (rc_enabled) cmd.push('--enable', 'remote_control')
    if (model) cmd.push('--model', model)
    return cmd
  }

  if (provider === 'gemini') {
    if (permissions === 'skip') cmd.push('--yolo', '--skip-trust')
    if (model) cmd.push('--model', model)
    return cmd
  }

  if (provider === 'hermes') {
    cmd.push('chat')
    if (permissions === 'skip') cmd.push('--yolo')
    if (model) cmd.push('--model', model)
    return cmd
  }

  return cmd
}

export function detectAvailable(): Record<Provider, boolean> {
  const result = {} as Record<Provider, boolean>
  for (const provider of PROVIDERS) {
    try {
      execFileSync('which', [BIN[provider]], { stdio: 'pipe' })
      result[provider] = true
    } catch {
      result[provider] = false
    }
  }
  return result
}

export function helpCommand(provider: Provider): string[] {
  if (provider === 'hermes') return [BIN[provider], 'chat', '--help']
  return [BIN[provider], '--help']
}

export function missingHelpFeatures(provider: Provider, helpText: string): string[] {
  return HELP_REQUIREMENTS[provider]
    .filter(req => req.tokens.some(token => !helpText.includes(token)))
    .map(req => req.feature)
}

export function inspectProviderCompatibility(): Record<Provider, ProviderCompatibility> {
  const available = detectAvailable()
  const result = {} as Record<Provider, ProviderCompatibility>
  const deadline = Date.now() + HELP_INSPECT_TOTAL_BUDGET_MS

  for (const provider of PROVIDERS) {
    if (!available[provider]) {
      result[provider] = {
        provider,
        available: false,
        ok: true,
        detail: 'not installed',
        missing: [],
      }
      continue
    }

    try {
      const remaining = deadline - Date.now()
      if (remaining <= 0) {
        result[provider] = {
          provider,
          available: true,
          ok: false,
          detail: 'help inspection skipped after timeout budget',
          missing: ['help inspection'],
        }
        continue
      }
      const [bin, ...args] = helpCommand(provider)
      const help = execFileSync(bin, args, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: Math.min(HELP_INSPECT_TIMEOUT_MS, remaining),
      })
      const missing = missingHelpFeatures(provider, help)
      result[provider] = {
        provider,
        available: true,
        ok: missing.length === 0,
        detail: missing.length === 0 ? 'compatible' : `missing ${missing.join(', ')}`,
        missing,
      }
    } catch (err) {
      result[provider] = {
        provider,
        available: true,
        ok: false,
        detail: `could not inspect help: ${err instanceof Error ? err.message : 'unknown error'}`,
        missing: ['help inspection'],
      }
    }
  }

  return result
}
