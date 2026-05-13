// Build CLI commands and environment for spawning providers (cc, codex, gemini).
// Manages auth modes (subscription, api-key, custom), base URLs, model/effort args.

import { execFileSync } from 'node:child_process'
import type { Provider, SpawnConfig } from '../state/types.js'

export const DEFAULT_KEY_VAR: Record<Provider, string> = {
  cc: 'ANTHROPIC_API_KEY',
  codex: 'OPENAI_API_KEY',
  gemini: 'GEMINI_API_KEY',
  opencode: 'OPENAI_API_KEY',
  aider: 'ANTHROPIC_API_KEY',
}

// Env vars to unset when auth=subscription (force provider's own auth flow)
const SUBSCRIPTION_UNSET: Record<Provider, string[]> = {
  cc: ['ANTHROPIC_API_KEY'],
  codex: ['OPENAI_API_KEY'],
  gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY'],
  opencode: [],  // opencode uses its own auth.json; don't touch env
  aider: [],     // subscription = "keys already in env, leave them"
}

const BASE_URL_VAR: Record<Provider, string> = {
  cc: 'ANTHROPIC_BASE_URL',
  codex: 'OPENAI_BASE_URL',
  gemini: 'GEMINI_BASE_URL',
  opencode: 'OPENAI_BASE_URL',
  aider: 'ANTHROPIC_BASE_URL',
}

export const BIN: Record<Provider, string> = {
  cc: 'claude',
  codex: 'codex',
  gemini: 'gemini',
  opencode: 'opencode',
  aider: 'aider',
}

export function buildEnv(cfg: SpawnConfig, baseEnv: Record<string, string>): Record<string, string> {
  const env = { ...baseEnv }

  if (cfg.auth === 'subscription') {
    // Unset API key vars for subscription mode
    const vars = SUBSCRIPTION_UNSET[cfg.provider]
    for (const v of vars) {
      delete env[v]
    }
    return env
  }

  if (cfg.auth === 'api-key') {
    // Keep env as-is
    return env
  }

  if (cfg.auth === 'custom') {
    // Requires base_url + key_ref
    if (cfg.base_url) {
      const urlVar = BASE_URL_VAR[cfg.provider]
      env[urlVar] = cfg.base_url
    }

    if (cfg.key_ref) {
      const keyVar = DEFAULT_KEY_VAR[cfg.provider]

      // Resolve "env:VAR_NAME" style refs
      if (cfg.key_ref.startsWith('env:')) {
        const varName = cfg.key_ref.slice(4)
        env[keyVar] = env[varName] || ''
      } else {
        env[keyVar] = cfg.key_ref
      }
    }

    return env
  }

  return env
}

export function buildCommand(cfg: SpawnConfig): string[] {
  const cmd: string[] = [BIN[cfg.provider]]

  if (cfg.provider === 'cc') {
    if (cfg.permissions === 'skip') {
      cmd.push('--dangerously-skip-permissions')
    }
    if (cfg.model) {
      cmd.push('--model', cfg.model)
    }
    if (cfg.effort) {
      cmd.push('--effort', cfg.effort)
    }
    return cmd
  }

  if (cfg.provider === 'codex') {
    if (cfg.permissions === 'skip') {
      cmd.push('--dangerously-bypass-approvals-and-sandbox')
    }

    if (cfg.model) {
      cmd.push('--model', cfg.model)
    }

    if (cfg.effort) {
      cmd.push('-c', `model_reasoning_effort="${cfg.effort}"`)
    }

    return cmd
  }

  if (cfg.provider === 'gemini') {
    if (cfg.permissions === 'skip') {
      cmd.push('--yolo')
    }
    if (cfg.model) {
      cmd.push('--model', cfg.model)
    }
    // effort unsupported for gemini
    return cmd
  }

  if (cfg.provider === 'opencode') {
    if (cfg.model) {
      cmd.push('--model', cfg.model)
    }
    // no documented permissions-skip flag; opencode is interactive by default
    // effort unsupported
    return cmd
  }

  if (cfg.provider === 'aider') {
    if (cfg.permissions === 'skip') {
      cmd.push('--yes')
    }
    if (cfg.model) {
      cmd.push('--model', cfg.model)
    }
    // effort unsupported for aider
    return cmd
  }

  return cmd
}

export function detectAvailable(): Record<Provider, boolean> {
  const result: Record<Provider, boolean> = {
    cc: false,
    codex: false,
    gemini: false,
    opencode: false,
    aider: false,
  }

  for (const provider of Object.keys(BIN) as Provider[]) {
    const bin = BIN[provider]

    try {
      execFileSync('which', [bin], { stdio: 'pipe' })
      result[provider] = true
    } catch {
      result[provider] = false
    }
  }

  return result
}
