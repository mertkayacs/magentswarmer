import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

let tmpDir: string
let cfgPath: string

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'reeves-helpers-test-'))
  cfgPath = join(tmpDir, 'config.json')
  process.env.REEVES_CONFIG = cfgPath
})

afterEach(() => {
  delete process.env.REEVES_CONFIG
  rmSync(tmpDir, { recursive: true, force: true })
})

// Defaults from DEFAULT_PROVIDERS in config.ts:
// cc: auth=subscription, model=opus, permissions=skip, effort=high
// hermes: auth=subscription, model=null, permissions=ask, effort=null
// gemini: auth=subscription, model=null, permissions=skip, effort=null

describe('resolveConfigKey', () => {
  it('returns section and field for valid dot-key', async () => {
    const { resolveConfigKey } = await import('../src/state/config-helpers.js')
    expect(resolveConfigKey('cc.auth')).toEqual({ section: 'cc', field: 'auth' })
  })

  it('uses first dot only when field contains dots', async () => {
    const { resolveConfigKey } = await import('../src/state/config-helpers.js')
    expect(resolveConfigKey('global.tmux.session')).toEqual({ section: 'global', field: 'tmux.session' })
  })

  it('returns null when no dot present', async () => {
    const { resolveConfigKey } = await import('../src/state/config-helpers.js')
    expect(resolveConfigKey('nofield')).toBeNull()
  })

  it('returns null for empty string', async () => {
    const { resolveConfigKey } = await import('../src/state/config-helpers.js')
    expect(resolveConfigKey('')).toBeNull()
  })
})

describe('getConfigValue', () => {
  it('returns error for key without dot', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('ccauth')
    expect(error).toBeTruthy()
    expect(value).toBeNull()
  })

  it('reads cc.auth default (subscription)', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.auth')
    expect(error).toBeNull()
    expect(value).toBe('subscription')
  })

  it('reads cc.model default (opus)', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.model')
    expect(error).toBeNull()
    expect(value).toBe('opus')
  })

  it('reads cc.effort default (high)', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.effort')
    expect(error).toBeNull()
    expect(value).toBe('high')
  })

  it('reads cc.permissions default (skip)', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.permissions')
    expect(error).toBeNull()
    expect(value).toBe('skip')
  })

  it('reads cc.key as null by default', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.key')
    expect(error).toBeNull()
    expect(value).toBeNull()
  })

  it('reads cc.base_url as null by default', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.base_url')
    expect(error).toBeNull()
    expect(value).toBeNull()
  })

  it('hermes.permissions defaults to ask', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('hermes.permissions')
    expect(error).toBeNull()
    expect(value).toBe('ask')
  })

  it('hermes.model defaults to null', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('hermes.model')
    expect(error).toBeNull()
    expect(value).toBeNull()
  })

  it('reads global.tmux via short alias', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('global.tmux')
    expect(error).toBeNull()
    expect(typeof value).toBe('string')
  })

  it('reads global.tmux_session_name via full name', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('global.tmux_session_name')
    expect(error).toBeNull()
    expect(typeof value).toBe('string')
  })

  it('reads global.peek as a number', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('global.peek')
    expect(error).toBeNull()
    expect(typeof value).toBe('number')
  })

  it('returns error for unknown global field', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('global.nonexistent')
    expect(error).toMatch(/unknown global field/)
    expect(value).toBeNull()
  })

  it('returns error for unknown section', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('unknown.field')
    expect(error).toMatch(/unknown section/)
    expect(value).toBeNull()
  })

  it('returns error for unknown provider field', async () => {
    const { getConfigValue } = await import('../src/state/config-helpers.js')
    const { value, error } = getConfigValue('cc.badfield')
    expect(error).toMatch(/unknown provider field/)
    expect(value).toBeNull()
  })

  it('works for all 6 providers reading auth', async () => {
    const { getConfigValue, CONFIG_PROVIDERS } = await import('../src/state/config-helpers.js')
    for (const provider of CONFIG_PROVIDERS) {
      const { value, error } = getConfigValue(`${provider}.auth`)
      expect(error).toBeNull()
      expect(typeof value).toBe('string')
    }
  })
})

describe('setConfigValue', () => {
  it('returns error for key without dot', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    const err = setConfigValue('ccauth', 'subscription')
    expect(err).toBeTruthy()
  })

  it('sets cc.auth and persists to disk', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.auth', 'api-key')).toBeNull()
    expect(getConfigValue('cc.auth').value).toBe('api-key')
  })

  it('rejects invalid auth value', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    const err = setConfigValue('cc.auth', 'bad-auth')
    expect(err).toMatch(/auth must be/)
  })

  // Use hermes (null default) for clear tests: mergeDefaults treats stored null as
  // "fall back to default", so clearing only works when the default itself is null.
  it('sets hermes.model and clears with null string', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    setConfigValue('hermes.model', 'claude-opus-4')
    expect(getConfigValue('hermes.model').value).toBe('claude-opus-4')
    setConfigValue('hermes.model', 'null')
    expect(getConfigValue('hermes.model').value).toBeNull()
  })

  it('sets hermes.model and clears with empty string', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    setConfigValue('hermes.model', 'claude-sonnet-4')
    expect(getConfigValue('hermes.model').value).toBe('claude-sonnet-4')
    setConfigValue('hermes.model', '')
    expect(getConfigValue('hermes.model').value).toBeNull()
  })

  it('sets cc.model to non-default value and reads it back', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.model', 'sonnet')).toBeNull()
    expect(getConfigValue('cc.model').value).toBe('sonnet')
  })

  it('sets cc.effort to valid values', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    for (const effort of ['low', 'medium', 'high']) {
      expect(setConfigValue('cc.effort', effort)).toBeNull()
      expect(getConfigValue('cc.effort').value).toBe(effort)
    }
  })

  it('rejects invalid effort value', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.effort', 'extreme')).toMatch(/effort must be/)
  })

  it('clears gemini.effort with empty string (null default allows true clear)', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    setConfigValue('gemini.effort', 'medium')
    expect(getConfigValue('gemini.effort').value).toBe('medium')
    setConfigValue('gemini.effort', '')
    expect(getConfigValue('gemini.effort').value).toBeNull()
  })

  it('sets cc.permissions to ask or skip', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.permissions', 'skip')).toBeNull()
    expect(getConfigValue('cc.permissions').value).toBe('skip')
    expect(setConfigValue('cc.permissions', 'ask')).toBeNull()
    expect(getConfigValue('cc.permissions').value).toBe('ask')
  })

  it('rejects invalid permissions value', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.permissions', 'always')).toMatch(/permissions must be/)
  })

  it('sets cc.key and clears with null (aider has non-null default, cc.key defaults to null)', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    setConfigValue('cc.key', 'MY_KEY_ENV')
    expect(getConfigValue('cc.key').value).toBe('MY_KEY_ENV')
    setConfigValue('cc.key', 'null')
    expect(getConfigValue('cc.key').value).toBeNull()
  })

  it('sets cc.base_url and clears with empty string', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    setConfigValue('cc.base_url', 'https://proxy.example.com')
    expect(getConfigValue('cc.base_url').value).toBe('https://proxy.example.com')
    setConfigValue('cc.base_url', '')
    expect(getConfigValue('cc.base_url').value).toBeNull()
  })

  it('sets global.tmux_session_name via short alias', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('global.tmux', 'my-session')).toBeNull()
    expect(getConfigValue('global.tmux').value).toBe('my-session')
  })

  it('sets global.peek to valid positive integer', async () => {
    const { setConfigValue, getConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('global.peek', '10')).toBeNull()
    expect(getConfigValue('global.peek').value).toBe(10)
  })

  it('rejects global.peek of zero', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('global.peek', '0')).toMatch(/positive integer/)
  })

  it('rejects global.peek that is not a number', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('global.peek', 'fast')).toMatch(/positive integer/)
  })

  it('returns error for unknown global field', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('global.nope', 'val')).toMatch(/unknown global field/)
  })

  it('returns error for unknown section', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('bogus.auth', 'subscription')).toMatch(/unknown section/)
  })

  it('returns error for unknown provider field', async () => {
    const { setConfigValue } = await import('../src/state/config-helpers.js')
    expect(setConfigValue('cc.notafield', 'val')).toMatch(/unknown provider field/)
  })
})
