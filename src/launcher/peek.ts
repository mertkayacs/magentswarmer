// Capture output from a tmux pane for a live session.
// Inputs: sessionId, optional line count.
// Outputs: string of last N lines from the pane, or empty string if not found.
// Invariant: returns empty string on error (session not found, tmux fails).

import { execSync } from 'node:child_process'
import { read as readSession } from '../state/registry.js'

export function peek(sessionId: string, lines: number = 20): string {
  try {
    const session = readSession(sessionId)
    const target = `${session.tmux_session}:${session.tmux_window}`

    const output = execSync(
      `tmux capture-pane -p -t ${target}`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )

    const allLines = output.split('\n')
    const lastN = allLines.slice(Math.max(0, allLines.length - lines))

    return lastN.join('\n').trim()
  } catch {
    return ''
  }
}
