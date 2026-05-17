// Session registry: CRUD operations for per-session JSON files.
// Storage: REEVES_REGISTRY env or ~/.reeves/sessions/<id>.json.
// All writes use 0o600 mode — session data is owner-private.
// Atomic write via temp file + rename. Mutations are serialized with a lock file.

import {
  readFileSync,
  writeFileSync,
  readdirSync,
  unlinkSync,
  mkdirSync,
  renameSync,
  chmodSync,
  openSync,
  closeSync,
  statSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { Session, SessionStatus, Message } from './types.js'
import { redactSecrets } from '../utils/display.js'

// Redacts API-key-shaped substrings from every user-text field before serialising.
// Idempotent — already-redacted text passes through unchanged.
function redactSession(s: Session): Session {
  return {
    ...s,
    task: redactSecrets(s.task),
    task_note: redactSecrets(s.task_note),
    inbox: s.inbox.map(m => ({ ...m, text: redactSecrets(m.text) })),
  }
}

export function registryDir(): string {
  const env = process.env.REEVES_REGISTRY
  if (env) return env
  return join(homedir(), '.reeves', 'sessions')
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function nowMs(): number {
  return Date.now()
}

function sleepSync(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
}

export function withRegistryLock<T>(fn: () => T): T {
  const dir = registryDir()
  mkdirSync(dir, { recursive: true })
  const lockPath = join(dir, '.registry.lock')
  const staleMs = 5000
  const deadline = Date.now() + staleMs

  while (true) {
    try {
      const fd = openSync(lockPath, 'wx', 0o600)
      try {
        writeFileSync(fd, JSON.stringify({ pid: process.pid, created_at: nowIso() }))
      } finally {
        closeSync(fd)
      }
      break
    } catch {
      try {
        const age = Date.now() - statSync(lockPath).mtimeMs
        if (age > staleMs) unlinkSync(lockPath)
      } catch {
        // lock disappeared between attempts
      }

      if (Date.now() > deadline) {
        throw new Error(`Timed out waiting for registry lock: ${lockPath}`)
      }
      sleepSync(25)
    }
  }

  try {
    return fn()
  } finally {
    try { unlinkSync(lockPath) } catch { /* lock already gone */ }
  }
}

export function computeStatus(session: Session): SessionStatus {
  if (session.ended_at !== null) return 'ended'
  if (Date.now() - session.last_seen < 30_000) return 'working'
  return 'idle'
}

function writeUnlocked(session: Session): string {
  const dir = registryDir()
  mkdirSync(dir, { recursive: true })

  const path = join(dir, `${session.id}.json`)
  const tmpPath = `${path}.tmp`

  writeFileSync(tmpPath, JSON.stringify(redactSession(session), null, 2))
  chmodSync(tmpPath, 0o600)
  renameSync(tmpPath, path)

  return path
}

export function write(session: Session): string {
  return withRegistryLock(() => writeUnlocked(session))
}

// Coerces v3-era sessions to v4 schema so stale disk data doesn't crash the display layer.
function normalizeSession(raw: Record<string, unknown>): Session {
  const r = raw as Record<string, unknown>
  const id = (r['id'] as string) ?? ''
  const lastSeenRaw = r['last_seen']
  const lastSeenAtRaw = r['last_seen_at']
  let last_seen: number
  if (typeof lastSeenRaw === 'number') {
    last_seen = lastSeenRaw
  } else if (typeof lastSeenAtRaw === 'string') {
    last_seen = new Date(lastSeenAtRaw).getTime()
  } else {
    last_seen = 0
  }
  return {
    id,
    nickname: (r['nickname'] as string) ?? (r['name'] as string) ?? id,
    provider: ((r['provider'] as string) ?? 'cc') as Session['provider'],
    model: (r['model'] as string) ?? '',
    working_dir: (r['working_dir'] as string) ?? '',
    task: (r['task'] as string) ?? '',
    task_status: (r['task_status'] as Session['task_status']) ?? 'idle',
    task_note: (r['task_note'] as string) ?? '',
    parent_id: (r['parent_id'] as string | null) ?? null,
    root_id: (r['root_id'] as string) ?? id,
    depth_level: (r['depth_level'] as number) ?? 0,
    last_seen,
    started_at: (r['started_at'] as string) ?? (r['created_at'] as string) ?? new Date(last_seen).toISOString(),
    ended_at: (r['ended_at'] as string | null) ?? null,
    tmux_session: (r['tmux_session'] as string) ?? '',
    rc_enabled: (r['rc_enabled'] as boolean) ?? false,
    inbox: (r['inbox'] as Session['inbox']) ?? [],
  }
}

function readUnlocked(id: string): Session {
  const path = join(registryDir(), `${id}.json`)
  const content = readFileSync(path, 'utf8')
  return normalizeSession(JSON.parse(content) as Record<string, unknown>)
}

export function read(id: string): Session {
  return readUnlocked(id)
}

export function listAll(): Session[] {
  const dir = registryDir()
  let files: string[]
  try {
    files = readdirSync(dir)
  } catch {
    return []
  }

  const sessions: Session[] = []

  for (const file of files) {
    if (!file.endsWith('.json')) continue

    try {
      const id = file.slice(0, -5)
      const session = read(id)
      sessions.push(session)
    } catch {
      // skip invalid entries
    }
  }

  return sessions.sort((a, b) => new Date(b.started_at).getTime() - new Date(a.started_at).getTime())
}

export function remove(id: string): void {
  withRegistryLock(() => {
    const path = join(registryDir(), `${id}.json`)
    try {
      unlinkSync(path)
    } catch {
      // no-op if not found
    }
  })
}

export function updateSession(id: string, patch: Partial<Session>): void {
  withRegistryLock(() => {
    const session = readUnlocked(id)
    const updated = { ...session, ...patch }
    writeUnlocked(updated)
  })
}

export function heartbeat(id: string): void {
  updateSession(id, { last_seen: nowMs() })
}

export function appendInbox(id: string, message: Message): void {
  withRegistryLock(() => {
    const session = readUnlocked(id)
    session.inbox.push(message)
    writeUnlocked(session)
  })
}

export function readInbox(id: string): Message[] {
  return withRegistryLock(() => {
    const session = readUnlocked(id)
    const messages = session.inbox
    session.inbox = []
    writeUnlocked(session)
    return messages
  })
}
