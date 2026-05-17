// Tmux jump helpers: link an agent window into the current tmux session or print attach commands.
// Inputs: Session or session id. Outputs: command arrays/string commands or side-effectful tmux jump.
// Invariant: outside tmux, no tmux state is modified.

import { execFileSync } from 'node:child_process'
import { read as readSession } from '../state/registry.js'
import type { Session } from '../state/types.js'

export interface JumpCommandResult {
  session_id: string
  tmux_session: string
  linked_window_name: string
  inside_tmux: boolean
  attach_command: string
  commands: string[]
  already_linked: boolean
}

function shellQuote(s: string): string {
  if (/^[A-Za-z0-9_@%+=:,./-]+$/.test(s)) return s
  return `'${s.replace(/'/g, "'\\''")}'`
}

function commandString(args: string[]): string {
  return args.map(shellQuote).join(' ')
}

export function linkedWindowName(session: Pick<Session, 'nickname'>): string {
  return `ra:${session.nickname}`.slice(0, 64)
}

function tmuxOutput(args: string[]): string {
  return execFileSync('tmux', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
}

function currentTmuxSession(): string | null {
  if (!process.env.TMUX) return null
  try {
    return tmuxOutput(['display-message', '-p', '#S'])
  } catch {
    return null
  }
}

function windowId(tmuxSession: string): string {
  return tmuxOutput(['display-message', '-p', '-t', `${tmuxSession}:0`, '#{window_id}'])
}

function linkedWindowId(currentSession: string, sourceWindowId: string): string | null {
  const rows = tmuxOutput(['list-windows', '-t', currentSession, '-F', '#{window_id}']).split('\n')
  return rows.includes(sourceWindowId) ? sourceWindowId : null
}

function buildCommands(session: Session, currentSession: string | null, alreadyLinked: boolean, sourceWindowId: string | null): string[][] {
  if (!currentSession) return [['tmux', 'attach', '-t', session.tmux_session]]
  const name = linkedWindowName(session)
  const target = sourceWindowId ?? `${session.tmux_session}:0`
  if (alreadyLinked) return [['tmux', 'select-window', '-t', target]]
  return [
    ['tmux', 'rename-window', '-t', `${session.tmux_session}:0`, name],
    ['tmux', 'link-window', '-d', '-s', `${session.tmux_session}:0`, '-t', `${currentSession}:`],
    ['tmux', 'select-window', '-t', target],
  ]
}

export function buildJumpCommandResult(
  session: Session,
  currentSession: string | null,
  alreadyLinked = false,
  sourceWindowId: string | null = null,
): JumpCommandResult {
  const commandArrays = buildCommands(session, currentSession, alreadyLinked, sourceWindowId)
  return {
    session_id: session.id,
    tmux_session: session.tmux_session,
    linked_window_name: linkedWindowName(session),
    inside_tmux: currentSession !== null,
    attach_command: commandString(['tmux', 'attach', '-t', session.tmux_session]),
    commands: commandArrays.map(commandString),
    already_linked: alreadyLinked,
  }
}

export function jumpCommand(sessionId: string, currentSession = currentTmuxSession()): JumpCommandResult {
  const session = readSession(sessionId)
  const sourceWindowId = currentSession ? windowId(session.tmux_session) : null
  const alreadyLinked = currentSession && sourceWindowId
    ? linkedWindowId(currentSession, sourceWindowId) !== null
    : false
  return buildJumpCommandResult(session, currentSession, alreadyLinked, sourceWindowId)
}

export function jumpToSession(session: Session): JumpCommandResult {
  const currentSession = currentTmuxSession()
  const sourceWindowId = currentSession ? windowId(session.tmux_session) : null
  const alreadyLinked = currentSession && sourceWindowId
    ? linkedWindowId(currentSession, sourceWindowId) !== null
    : false
  const result = buildJumpCommandResult(session, currentSession, alreadyLinked, sourceWindowId)
  if (!currentSession) return result

  for (const command of buildCommands(session, currentSession, result.already_linked, sourceWindowId)) {
    execFileSync(command[0]!, command.slice(1), { stdio: 'ignore' })
  }

  return result
}
