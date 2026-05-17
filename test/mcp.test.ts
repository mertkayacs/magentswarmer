import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Session } from '../src/state/types.js'

let tmpDir: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-mcp-test-'))
  process.env.REEVES_REGISTRY = tmpDir
})

afterEach(() => {
  delete process.env.REEVES_REGISTRY
  rmSync(tmpDir, { recursive: true, force: true })
})

function makeSession(id: string, overrides: Partial<Session> = {}): Session {
  return {
    id,
    nickname: `agent-${id}`,
    provider: 'cc',
    model: '',
    working_dir: '/tmp',
    task: 'test',
    task_status: 'queued',
    task_note: '',
    parent_id: null,
    root_id: id,
    depth_level: 0,
    last_seen: Date.now() - 60_000,
    started_at: new Date().toISOString(),
    ended_at: null,
    tmux_session: `reeves_${id}`,
    rc_enabled: false,
    inbox: [],
    ...overrides,
  }
}

function jsonText(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>
}

describe('mcp tools', () => {
  it('exposes only the focused v4 tool list', async () => {
    const { TOOLS } = await import('../src/mcp.js')
    expect(TOOLS.map(t => t.name)).toEqual([
      'spawn',
      'list',
      'tree',
      'peek',
      'send_message',
      'check_messages',
      'update_task',
      'wait',
      'kill',
      'jump_command',
    ])
  })

  it('spawn schema only lists focused providers', async () => {
    const { TOOLS } = await import('../src/mcp.js')
    const spawn = TOOLS.find(t => t.name === 'spawn')!
    const provider = spawn.inputSchema.properties.provider as { enum: string[] }
    expect(provider.enum).toEqual(['cc', 'codex', 'gemini', 'hermes'])
  })

  it('send_message and check_messages roundtrip through inbox', async () => {
    const { write } = await import('../src/state/registry.js')
    const { handleMcpTool } = await import('../src/mcp.js')
    write(makeSession('root'))
    write(makeSession('child', { parent_id: 'root', root_id: 'root', depth_level: 1 }))

    await handleMcpTool('send_message', { session_id: 'child', text: 'hello' }, 'root')
    const result = await handleMcpTool('check_messages', {}, 'child')
    const messages = JSON.parse(result.content[0]!.text) as Array<{ text: string; from_id: string }>

    expect(messages).toHaveLength(1)
    expect(messages[0]?.text).toBe('hello')
    expect(messages[0]?.from_id).toBe('root')
  })

  it('update_task changes session status and note', async () => {
    const { write, read } = await import('../src/state/registry.js')
    const { handleMcpTool } = await import('../src/mcp.js')
    write(makeSession('task1'))

    await handleMcpTool('update_task', { session_id: 'task1', status: 'working', note: 'phase 1' }, null)

    expect(read('task1').task_status).toBe('working')
    expect(read('task1').task_note).toBe('phase 1')
  })

  it('tree returns parent and child hierarchy', async () => {
    const { write } = await import('../src/state/registry.js')
    const { handleMcpTool } = await import('../src/mcp.js')
    write(makeSession('root'))
    write(makeSession('child', { parent_id: 'root', root_id: 'root', depth_level: 1 }))

    const result = await handleMcpTool('tree', { root_id: 'root' }, null)
    const tree = jsonText(result)

    expect((tree.session as Session).id).toBe('root')
    expect((tree.children as Array<{ session: Session }>)[0]?.session.id).toBe('child')
  })
})
