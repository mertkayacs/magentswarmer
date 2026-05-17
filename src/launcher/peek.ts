// Capture output from a tmux pane for a live session.
// Inputs: sessionId, optional line count.
// Outputs: ANSI-stripped last N lines from the pane, or empty string on error.
// Invariant: always returns empty string on error — callers should not throw on peek failure.

import { execFileSync } from 'node:child_process'
import stripAnsi from 'strip-ansi'
import { read as readSession } from '../state/registry.js'
import { redactSecrets } from '../utils/display.js'

export function peek(sessionId: string, lines: number = 10): string {
  try {
    const session = readSession(sessionId)

    const output = execFileSync(
      'tmux',
      // -e: include ANSI escapes (stripped below); -S -N: capture last N lines from pane bottom
      ['capture-pane', '-p', '-e', '-S', String(-lines), '-t', session.tmux_session],
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }
    )

    return redactSecrets(stripAnsi(output).trim())
  } catch {
    return ''
  }
}
