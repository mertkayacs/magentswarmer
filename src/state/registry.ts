// Session registry: generate IDs, read/write session JSON, list all, manage lifecycle.
// Reads from REEVES_REGISTRY env or ~/.reeves/sessions.
// Atomic writes, collision retry, stale detection, default field merge.

import { readFileSync, writeFileSync, readdirSync, unlinkSync, mkdirSync, renameSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { randomInt } from 'node:crypto'
import type { Session, Provider, Auth, Effort, Permissions } from './types.js'

const ALPHABET = 'abcdefghjkmnpqrstvwxyz23456789'
const ID_LEN = 4
const COLLISION_RETRIES = 5

export function registryDir(): string {
  const base = process.env.REEVES_REGISTRY
  if (base) return base
  return join(homedir(), '.reeves', 'sessions')
}

function randomId(): string {
  let id = ''
  for (let i = 0; i < ID_LEN; i++) {
    id += ALPHABET[randomInt(0, ALPHABET.length)]
  }
  return id
}

export function newId(): string {
  const dir = registryDir()
  let retries = 0

  while (retries < COLLISION_RETRIES) {
    const id = randomId()
    const path = join(dir, `${id}.json`)

    try {
      readFileSync(path, 'utf-8')
      // File exists, retry
    } catch {
      // File does not exist, good
      return id
    }

    retries++
  }

  throw new Error(`Failed to generate unique session ID after ${COLLISION_RETRIES} retries`)
}

export function nowIso(): string {
  return new Date().toISOString()
}

function mergeDefaults(raw: unknown): Session {
  const defaults: Partial<Session> = {
    tag: null,
    permissions: 'ask',
    effort: null,
    start_prompt: null,
    goal: null
  }

  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Session data must be an object')
  }

  const obj = raw as Record<string, unknown>
  const merged: Session = {
    id: (obj.id as string) || '',
    name: (obj.name as string) || '',
    parent_id: (obj.parent_id as string | null) ?? null,
    provider: (obj.provider as Provider) || 'cc',
    auth: (obj.auth as Auth) || 'subscription',
    base_url: (obj.base_url as string | null) ?? null,
    model: (obj.model as string | null) ?? null,
    key_ref: (obj.key_ref as string | null) ?? null,
    tag: (obj.tag as string | null) ?? (defaults.tag ?? null),
    permissions: (obj.permissions as Permissions) || (defaults.permissions ?? 'ask'),
    effort: (obj.effort as Effort | null) ?? (defaults.effort ?? null),
    start_prompt: (obj.start_prompt as string | null) ?? (defaults.start_prompt ?? null),
    goal: (obj.goal as string | null) ?? (defaults.goal ?? null),
    tmux_session: (obj.tmux_session as string) || '',
    tmux_window: (obj.tmux_window as string) || '',
    created_at: (obj.created_at as string) || nowIso(),
    last_seen_at: (obj.last_seen_at as string) || nowIso()
  }

  return merged
}

export function write(session: Session): string {
  const dir = registryDir()
  mkdirSync(dir, { recursive: true })

  const path = join(dir, `${session.id}.json`)
  const tmpPath = `${path}.tmp`

  writeFileSync(tmpPath, JSON.stringify(session, null, 2), 'utf-8')

  try {
    renameSync(tmpPath, path)
  } catch {
    writeFileSync(path, JSON.stringify(session, null, 2), 'utf-8')
  }

  return path
}

export function read(sessionId: string): Session {
  const path = join(registryDir(), `${sessionId}.json`)
  const content = readFileSync(path, 'utf-8')
  const parsed = JSON.parse(content)
  return mergeDefaults(parsed)
}

export function listAll(): Session[] {
  const dir = registryDir()
  let files: string[] = []

  try {
    files = readdirSync(dir).filter(f => f.endsWith('.json'))
  } catch {
    return []
  }

  const sessions: Session[] = []

  for (const file of files) {
    try {
      const path = join(dir, file)
      const content = readFileSync(path, 'utf-8')
      const parsed = JSON.parse(content)
      const session = mergeDefaults(parsed)
      sessions.push(session)
    } catch {
      // Skip invalid entries
    }
  }

  sessions.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return sessions
}

export function remove(sessionId: string): void {
  const path = join(registryDir(), `${sessionId}.json`)
  try {
    unlinkSync(path)
  } catch {
    // File does not exist, no-op
  }
}

export function heartbeat(sessionId: string): void {
  const session = read(sessionId)
  session.last_seen_at = nowIso()
  write(session)
}

export function isStale(session: Session, thresholdS: number = 300): boolean {
  const lastSeen = new Date(session.last_seen_at)
  const now = new Date()
  const diffMs = now.getTime() - lastSeen.getTime()
  const diffS = diffMs / 1000

  return diffS > thresholdS
}
