// Detect installed CLIs and register reevesagents as their MCP server.
// Inputs: provider names. Outputs: config file updates for each provider.
// Invariant: registration only updates the reevesagents MCP entry.

import { readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { execFileSync } from 'node:child_process'
import type { Provider } from './state/types.js'
import { PROVIDERS } from './launcher/providers.js'

export interface CliRegistration {
  provider: Provider
  cli: string
  detected: boolean
  registered: boolean
  configPath: string
  note?: string
}

const LABEL: Record<Provider, string> = {
  cc: 'Claude Code',
  codex: 'Codex CLI',
  gemini: 'Gemini CLI',
  hermes: 'Hermes',
}

const BIN: Record<Provider, string> = {
  cc: 'claude',
  codex: 'codex',
  gemini: 'gemini',
  hermes: 'hermes',
}

function setupHome(): string {
  return process.env.REEVES_SETUP_HOME || homedir()
}

function isBinAvailable(bin: string): boolean {
  try {
    execFileSync('which', [bin], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function reevesPath(): string {
  return process.argv[1] ?? 'reevesagents'
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp`
  writeFileSync(tmp, content, 'utf-8')
  try {
    renameSync(tmp, path)
  } catch {
    writeFileSync(path, content, 'utf-8')
  }
}

function readJson(path: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as Record<string, unknown>
  } catch {
    return {}
  }
}

function writeJson(path: string, data: Record<string, unknown>): void {
  atomicWrite(path, JSON.stringify(data, null, 2))
}

function configPath(provider: Provider): string {
  const home = setupHome()
  if (provider === 'cc') return join(home, '.claude', 'settings.json')
  if (provider === 'codex') return join(home, '.codex', 'config.toml')
  if (provider === 'gemini') return join(home, '.gemini', 'settings.json')
  return join(home, '.hermes', 'config.yaml')
}

function serverConfig(): Record<string, unknown> {
  return { command: reevesPath(), args: ['mcp'] }
}

function registerJson(path: string): void {
  const config = readJson(path)
  const servers = typeof config.mcpServers === 'object' && config.mcpServers !== null
    ? config.mcpServers as Record<string, unknown>
    : {}
  servers.reevesagents = serverConfig()
  config.mcpServers = servers
  writeJson(path, config)
}

function unregisterJson(path: string): void {
  const config = readJson(path)
  if (typeof config.mcpServers === 'object' && config.mcpServers !== null) {
    delete (config.mcpServers as Record<string, unknown>).reevesagents
  }
  writeJson(path, config)
}

function isJsonRegistered(path: string): boolean {
  const config = readJson(path)
  const servers = config.mcpServers as Record<string, unknown> | undefined
  return !!servers?.reevesagents
}

function escapeTomlString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

function stripTomlReevesBlock(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let skipping = false

  for (const line of lines) {
    if (/^\[mcp_servers\.reevesagents\]\s*$/.test(line)) {
      skipping = true
      continue
    }
    if (skipping && /^\[/.test(line)) skipping = false
    if (!skipping) out.push(line)
  }

  return out.join('\n').trimEnd()
}

function registerCodexToml(path: string): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const stripped = stripTomlReevesBlock(existing)
  const block = [
    '[mcp_servers.reevesagents]',
    `command = "${escapeTomlString(reevesPath())}"`,
    'args = ["mcp"]',
  ].join('\n')
  atomicWrite(path, `${stripped}${stripped ? '\n\n' : ''}${block}\n`)
}

function unregisterCodexToml(path: string): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  atomicWrite(path, `${stripTomlReevesBlock(existing)}\n`)
}

function isTomlRegistered(path: string): boolean {
  try {
    return /^\[mcp_servers\.reevesagents\]\s*$/m.test(readFileSync(path, 'utf-8'))
  } catch {
    return false
  }
}

function quoteYaml(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
}

function stripYamlReevesBlock(content: string): string {
  const lines = content.split('\n')
  const out: string[] = []
  let skipping = false

  for (const line of lines) {
    if (/^ {2}reevesagents:\s*$/.test(line)) {
      skipping = true
      continue
    }
    if (skipping && (/^ {2}[^ ].*:\s*$/.test(line) || /^\S/.test(line))) skipping = false
    if (!skipping) out.push(line)
  }

  return out.join('\n').trimEnd()
}

function registerHermesYaml(path: string): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  const stripped = stripYamlReevesBlock(existing)
  const block = [
    '  reevesagents:',
    `    command: ${quoteYaml(reevesPath())}`,
    '    args: ["mcp"]',
  ]

  if (/^mcp_servers:\s*$/m.test(stripped)) {
    const lines = stripped.split('\n')
    const start = lines.findIndex(line => /^mcp_servers:\s*$/.test(line))
    let insertAt = lines.length
    for (let i = start + 1; i < lines.length; i++) {
      if (/^\S/.test(lines[i]!) && lines[i]!.trim() !== '') {
        insertAt = i
        break
      }
    }
    lines.splice(insertAt, 0, ...block)
    atomicWrite(path, `${lines.join('\n').trimEnd()}\n`)
    return
  }

  atomicWrite(path, `${stripped}${stripped ? '\n\n' : ''}mcp_servers:\n${block.join('\n')}\n`)
}

function unregisterHermesYaml(path: string): void {
  const existing = existsSync(path) ? readFileSync(path, 'utf-8') : ''
  atomicWrite(path, `${stripYamlReevesBlock(existing)}\n`)
}

function isYamlRegistered(path: string): boolean {
  try {
    return /^ {2}reevesagents:\s*$/m.test(readFileSync(path, 'utf-8'))
  } catch {
    return false
  }
}

export function register(provider: Provider): CliRegistration {
  const path = configPath(provider)
  const detected = isBinAvailable(BIN[provider])
  if (!detected) {
    return {
      provider,
      cli: LABEL[provider],
      detected,
      registered: false,
      configPath: path,
      note: `${BIN[provider]} binary not found on PATH`,
    }
  }

  try {
    if (provider === 'cc' || provider === 'gemini') registerJson(path)
    else if (provider === 'codex') registerCodexToml(path)
    else registerHermesYaml(path)
    return { provider, cli: LABEL[provider], detected, registered: true, configPath: path }
  } catch (e) {
    return {
      provider,
      cli: LABEL[provider],
      detected,
      registered: false,
      configPath: path,
      note: e instanceof Error ? e.message : String(e),
    }
  }
}

export function unregister(provider: Provider): CliRegistration {
  const path = configPath(provider)
  try {
    if (provider === 'cc' || provider === 'gemini') unregisterJson(path)
    else if (provider === 'codex') unregisterCodexToml(path)
    else unregisterHermesYaml(path)
    return { provider, cli: LABEL[provider], detected: isBinAvailable(BIN[provider]), registered: false, configPath: path }
  } catch (e) {
    return {
      provider,
      cli: LABEL[provider],
      detected: isBinAvailable(BIN[provider]),
      registered: isRegistered(provider),
      configPath: path,
      note: e instanceof Error ? e.message : String(e),
    }
  }
}

export function isRegistered(providerOrPath: Provider | string): boolean {
  if (PROVIDERS.includes(providerOrPath as Provider)) {
    const provider = providerOrPath as Provider
    const path = configPath(provider)
    if (provider === 'cc' || provider === 'gemini') return isJsonRegistered(path)
    if (provider === 'codex') return isTomlRegistered(path)
    return isYamlRegistered(path)
  }

  return isJsonRegistered(providerOrPath)
}

export function registerAll(): CliRegistration[] {
  return PROVIDERS.map(provider => register(provider))
}
