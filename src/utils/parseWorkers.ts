// Parse "-w name:prompt" style CLI strings into WorkerEntry objects.
// Inputs: array of raw worker strings from CLI.
// Outputs: WorkerEntry array.
// Invariant: first colon splits name from prompt; no colon = auto-name worker-N.

import type { WorkerEntry } from '../state/types.js'

export function parseWorkers(workerArgs: string[]): WorkerEntry[] {
  return workerArgs.map((w, i) => {
    const colonIdx = w.indexOf(':')
    if (colonIdx === -1) return { name: `worker-${i + 1}`, prompt: w }
    return { name: w.slice(0, colonIdx), prompt: w.slice(colonIdx + 1) }
  })
}
