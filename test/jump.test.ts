import { describe, it, expect } from 'vitest'
import type { Session } from '../src/state/types.js'

function makeSession(overrides: Partial<Session> = {}): Session {
  return {
    id: 'jump1',
    nickname: 'alpha',
    provider: 'cc',
    model: '',
    working_dir: '/tmp',
    task: 'test',
    task_status: 'queued',
    task_note: '',
    parent_id: null,
    root_id: 'jump1',
    depth_level: 0,
    last_seen: Date.now(),
    started_at: new Date().toISOString(),
    ended_at: null,
    tmux_session: 'reeves_alpha_jump1',
    rc_enabled: false,
    inbox: [],
    ...overrides,
  }
}

describe('tmux jump commands', () => {
  it('outside tmux returns attach fallback only', async () => {
    const { buildJumpCommandResult } = await import('../src/launcher/jump.js')
    const result = buildJumpCommandResult(makeSession(), null)
    expect(result.inside_tmux).toBe(false)
    expect(result.attach_command).toBe('tmux attach -t reeves_alpha_jump1')
    expect(result.commands).toEqual(['tmux attach -t reeves_alpha_jump1'])
  })

  it('inside tmux returns rename, link, and select commands', async () => {
    const { buildJumpCommandResult } = await import('../src/launcher/jump.js')
    const result = buildJumpCommandResult(makeSession(), 'user-session', false, '@42')
    expect(result.linked_window_name).toBe('ra:alpha')
    expect(result.commands).toEqual([
      'tmux rename-window -t reeves_alpha_jump1:0 ra:alpha',
      'tmux link-window -d -s reeves_alpha_jump1:0 -t user-session:',
      'tmux select-window -t @42',
    ])
  })

  it('reuses an already linked tmux window', async () => {
    const { buildJumpCommandResult } = await import('../src/launcher/jump.js')
    const result = buildJumpCommandResult(makeSession(), 'user-session', true, '@42')
    expect(result.already_linked).toBe(true)
    expect(result.commands).toEqual(['tmux select-window -t @42'])
  })
})
