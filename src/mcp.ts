// MCP server: focused tools for spawning, watching, messaging, and tmux jump commands.
// Started via: reevesagents mcp  (stdio transport, JSON-RPC over stdin/stdout).
// REEVES_SESSION_ID env identifies the calling session for check_messages and update_task.

import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'

import { spawn as spawnSession } from './launcher/spawn.js'
import { peek } from './launcher/peek.js'
import { jumpCommand } from './launcher/jump.js'
import { PROVIDERS } from './launcher/providers.js'
import {
  listAll, read as readSession, updateSession,
  heartbeat, appendInbox, readInbox,
  computeStatus, nowIso,
} from './state/registry.js'
import type { Provider, Permissions, Effort, Message, TreeNode, Session } from './state/types.js'

function buildTree(all: Session[], rootId: string): TreeNode | null {
  const root = all.find(s => s.id === rootId)
  if (!root) return null
  return {
    session: root,
    status: computeStatus(root),
    children: all
      .filter(s => s.parent_id === rootId)
      .map(s => buildTree(all, s.id))
      .filter((n): n is TreeNode => n !== null),
  }
}

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] }
}

function fail(message: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify({ error: message }) }],
    isError: true as const,
  }
}

function parseEffort(value: unknown): Effort {
  if (value === 'low' || value === 'medium' || value === 'high' || value === 'xhigh' || value === 'max') return value
  return 'default'
}

export const TOOLS = [
  {
    name: 'spawn',
    description: 'Spawn a new AI CLI agent in its own tmux session. Returns session_id for subsequent tool calls.',
    inputSchema: {
      type: 'object',
      properties: {
        provider: { type: 'string', enum: PROVIDERS },
        model: { type: 'string', description: 'Model identifier, e.g. claude-opus-4-5, gpt-4o' },
        auth_mode: { type: 'string', enum: ['default', 'api-key'], description: 'Provider auth mode where supported' },
        effort: { type: 'string', enum: ['default', 'low', 'medium', 'high', 'xhigh', 'max'], description: 'Reasoning effort where supported' },
        task: { type: 'string', description: 'Initial prompt injected to the agent after startup' },
        working_dir: { type: 'string', description: 'Absolute or ~ path for the agent working directory' },
        nickname: { type: 'string', description: 'Short label used in tmux session name and TUI tree view' },
        permissions: { type: 'string', enum: ['skip', 'ask'], description: 'skip = dangerously skip all approvals' },
        rc_enabled: { type: 'boolean', description: 'Enable remote control (CC: /remote-control, Codex: --enable remote_control)' },
        ready_delay_ms: { type: 'number', description: 'Override startup delay before task injection (default from config)' },
      },
      required: ['provider', 'model', 'task', 'working_dir'],
    },
  },
  {
    name: 'list',
    description: 'List sessions. filter: "active" (running) | "ended" | "all" (default).',
    inputSchema: {
      type: 'object',
      properties: {
        filter: { type: 'string', enum: ['active', 'ended', 'all'] },
      },
    },
  },
  {
    name: 'tree',
    description: 'Return session hierarchy as nested TreeNode. With root_id: scoped. Without: all roots.',
    inputSchema: {
      type: 'object',
      properties: {
        root_id: { type: 'string', description: 'Scope to this tree root. Omit to list all root sessions.' },
      },
    },
  },
  {
    name: 'peek',
    description: 'Return last N lines of a session\'s tmux pane output (ANSI-stripped). Default: 10 lines.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        lines: { type: 'number' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'send_message',
    description: 'Write a message into a session\'s inbox. The target reads it on next check_messages().',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        text: { type: 'string' },
      },
      required: ['session_id', 'text'],
    },
  },
  {
    name: 'check_messages',
    description: 'Consume this session\'s inbox and heartbeat last_seen. Call every prompt cycle. Caller identified by REEVES_SESSION_ID env.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'update_task',
    description: 'Set task_status and optional note for a session. Called by orchestrating CLI to report subtask progress.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        status: { type: 'string', enum: ['queued', 'working', 'done', 'failed', 'blocked'] },
        note: { type: 'string', description: 'Free-text status note shown in tree view' },
      },
      required: ['session_id', 'status'],
    },
  },
  {
    name: 'wait',
    description: 'Block until a session ends (ended_at set) or timeout_ms elapses. Default: 300000ms.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        timeout_ms: { type: 'number' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'kill',
    description: 'Kill a session with SIGKILL. cascade=true kills entire tree (deepest first).',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        cascade: { type: 'boolean', description: 'Kill all sessions sharing the same root_id' },
      },
      required: ['session_id'],
    },
  },
  {
    name: 'jump_command',
    description: 'Return tmux commands to link a session window into the current tmux session, or an attach fallback outside tmux.',
    inputSchema: {
      type: 'object',
      properties: {
        session_id: { type: 'string' },
        current_session: { type: 'string', description: 'Optional tmux session to link into. Defaults to caller tmux session.' },
      },
      required: ['session_id'],
    },
  },
] as const

export async function handleMcpTool(name: string, a: Record<string, unknown>, callerSessionId: string | null) {
  if (name === 'spawn') {
    const session = spawnSession({
      provider: a.provider as Provider,
      model: String(a.model ?? ''),
      auth_mode: a.auth_mode === 'api-key' ? 'api-key' : 'default',
      effort: parseEffort(a.effort),
      task: String(a.task ?? ''),
      working_dir: String(a.working_dir ?? process.cwd()),
      nickname: typeof a.nickname === 'string' ? a.nickname : undefined,
      permissions: typeof a.permissions === 'string' ? (a.permissions as Permissions) : undefined,
      rc_enabled: typeof a.rc_enabled === 'boolean' ? a.rc_enabled : false,
      ready_delay_ms: typeof a.ready_delay_ms === 'number' ? a.ready_delay_ms : undefined,
      parent_id: callerSessionId ?? undefined,
    })
    return ok({ session_id: session.id, nickname: session.nickname })
  }

  if (name === 'kill') {
    const id = String(a.session_id)
    const cascade = a.cascade === true
    const killed: string[] = []

    if (cascade) {
      const session = readSession(id)
      const targets = listAll()
        .filter(s => s.root_id === session.root_id && !s.ended_at)
        .sort((x, y) => y.depth_level - x.depth_level)
      for (const s of targets) {
        try { execFileSync('tmux', ['kill-session', '-t', s.tmux_session], { stdio: 'ignore' }) } catch { /* already gone */ }
        updateSession(s.id, { ended_at: nowIso() })
        killed.push(s.id)
      }
    } else {
      const session = readSession(id)
      try { execFileSync('tmux', ['kill-session', '-t', session.tmux_session], { stdio: 'ignore' }) } catch { /* already gone */ }
      updateSession(id, { ended_at: nowIso() })
      killed.push(id)
    }

    return ok({ killed })
  }

  if (name === 'wait') {
    const id = String(a.session_id)
    const timeoutMs = typeof a.timeout_ms === 'number' ? a.timeout_ms : 300_000
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      const session = readSession(id)
      if (session.ended_at) return ok({ ended_at: session.ended_at })
      await new Promise(r => setTimeout(r, 1000))
    }
    return ok({ timeout: true })
  }

  if (name === 'list') {
    const filter = typeof a.filter === 'string' ? a.filter : 'all'
    let sessions = listAll()
    if (filter === 'active') sessions = sessions.filter(s => !s.ended_at)
    if (filter === 'ended') sessions = sessions.filter(s => !!s.ended_at)
    return ok(sessions.map(s => ({ ...s, status: computeStatus(s) })))
  }

  if (name === 'peek') {
    const id = String(a.session_id)
    const lines = typeof a.lines === 'number' ? a.lines : 10
    return ok(peek(id, lines))
  }

  if (name === 'tree') {
    const all = listAll()
    if (a.root_id) {
      const node = buildTree(all, String(a.root_id))
      if (!node) return fail(`Session not found: ${String(a.root_id)}`)
      return ok(node)
    }
    return ok(
      all
        .filter(s => s.parent_id === null)
        .map(s => buildTree(all, s.id))
        .filter((n): n is TreeNode => n !== null),
    )
  }

  if (name === 'send_message') {
    const message: Message = {
      id: randomUUID(),
      from_id: callerSessionId ?? 'external',
      text: String(a.text ?? ''),
      sent_at: new Date().toISOString(),
      read: false,
    }
    appendInbox(String(a.session_id), message)
    return ok({ queued: true })
  }

  if (name === 'check_messages') {
    if (!callerSessionId) return fail('REEVES_SESSION_ID not set — cannot identify caller session')
    heartbeat(callerSessionId)
    return ok(readInbox(callerSessionId))
  }

  if (name === 'update_task') {
    const id = String(a.session_id)
    const status = a.status as 'queued' | 'working' | 'done' | 'failed' | 'blocked'
    updateSession(id, {
      task_status: status,
      ...(typeof a.note === 'string' ? { task_note: a.note } : {}),
    })
    return ok({ ok: true })
  }

  if (name === 'jump_command') {
    return ok(jumpCommand(
      String(a.session_id),
      typeof a.current_session === 'string' ? a.current_session : undefined,
    ))
  }

  return fail(`Unknown tool: ${name}`)
}

export async function startMcpServer(): Promise<void> {
  const callerSessionId = process.env.REEVES_SESSION_ID ?? null

  const server = new Server(
    { name: 'reevesagents', version: '0.9.0' },
    { capabilities: { tools: {} } },
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }))

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args = {} } = request.params
    const a = args as Record<string, unknown>

    try {
      return await handleMcpTool(name, a, callerSessionId)
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}
