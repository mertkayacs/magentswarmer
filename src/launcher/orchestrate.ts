// Fan out and orchestrate multiple spawned sessions.
// Inputs: SpawnRequest[] or (goal, tag, shared form state, worker list).
// Outputs: Array of Session objects written to registry.
// Invariant: all sessions share parent_id and tag; each worker gets its own session.

import type { SpawnRequest, Session, SharedFormState, WorkerEntry } from '../state/types.js'
import { spawn } from './spawn.js'
import { setLastOrchestrate } from '../state/store.js'

export function fanOut(requests: SpawnRequest[]): Session[] {
  const sessions: Session[] = []

  for (const req of requests) {
    const session = spawn(req)
    sessions.push(session)
  }

  return sessions
}

export function buildSpawnRequests(
  goal: string,
  tag: string,
  shared: SharedFormState,
  workers: WorkerEntry[],
  working_dir?: string
): SpawnRequest[] {
  return workers.map((worker) => ({
    provider: shared.provider,
    auth: shared.auth,
    model: shared.model || undefined,
    permissions: shared.permissions || 'skip',
    effort: shared.effort || undefined,
    name: worker.name,
    start_prompt: worker.prompt,
    goal,
    tag,
    working_dir,
  }))
}

export function orchestrate(
  goal: string,
  tag: string,
  shared: SharedFormState,
  workers: WorkerEntry[],
  working_dir?: string
): Session[] {
  const requests: SpawnRequest[] = workers.map((worker) => ({
    provider: shared.provider,
    auth: shared.auth,
    model: shared.model || undefined,
    permissions: shared.permissions || 'skip',
    effort: shared.effort || undefined,
    name: worker.name,
    start_prompt: worker.prompt,
    goal,
    tag,
    working_dir,
  }))

  const sessions = fanOut(requests)
  setLastOrchestrate({ goal, tag, shared, workers })
  return sessions
}
