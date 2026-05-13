// Display utilities: provider colors, age formatting, session labels.
// Inputs: Provider enum, timestamps. Outputs: color strings, formatted strings.
// Invariant: providerColor always returns a valid hex string or named color.

import chalk from 'chalk'
import type { Provider } from '../state/types.js'

export function providerColor(p: Provider): string {
  if (p === 'cc') return '#5a96e0'
  if (p === 'codex') return '#4ade80'
  if (p === 'gemini') return '#facc15'
  if (p === 'opencode') return '#a78bfa'
  if (p === 'aider') return '#fb923c'
  if (p === 'hermes') return '#f472b6'
  return 'gray'
}

export function formatAge(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

export function formatDuration(createdAt: string, endedAt: string): string {
  const ms = new Date(endedAt).getTime() - new Date(createdAt).getTime()
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) {
    const rs = s % 60
    return `${m}m ${rs}s`
  }
  const h = Math.floor(m / 60)
  const rm = m % 60
  return `${h}h ${rm}m`
}

export function supportsColor(): boolean {
  return chalk.level >= 2
}

export function supportsHex(): boolean {
  return chalk.level >= 3
}
