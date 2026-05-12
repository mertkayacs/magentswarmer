// Configure providers and global settings.
// Per-provider sections (auth/key/url/model/effort/perms) + global (tmux name, peek interval).
// Inputs: loadConfig on mount. Outputs: saves on submit.
// Invariant: section switch with left/right arrow at save button; field edit with enter in fields.

import React, { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { loadConfig, saveConfig } from '../state/config.js'
import type { Auth, Provider, Effort, Permissions } from '../state/types.js'

const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']
const EFFORTS: Array<Effort | null> = [null, 'low', 'medium', 'high']
const PERMS: Permissions[] = ['ask', 'skip']
const PEEK_INTERVALS = [3, 5, 10] as const
type PeekInterval = 3 | 5 | 10

const PROVIDER_FIELDS = ['auth', 'key_env', 'base_url', 'default_model', 'default_effort', 'default_permissions'] as const
type ProviderField = typeof PROVIDER_FIELDS[number]

const GLOBAL_FIELDS = ['tmux_session_name', 'peek_interval_seconds'] as const
type GlobalField = typeof GLOBAL_FIELDS[number]

type Section = Provider | 'global'

function cycle<T>(arr: readonly T[], current: T, dir: 1 | -1): T {
  const idx = arr.indexOf(current)
  return arr[(idx + dir + arr.length) % arr.length] as T
}

function effortLabel(e: Effort | null): string {
  return e ?? '—'
}

const SECTIONS: Section[] = ['cc', 'codex', 'gemini', 'global']

export function Settings() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const [config, setConfig] = useState(() => loadConfig())
  const [section, setSection] = useState<Section>('cc')
  const [focusField, setFocusField] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const isGlobal = section === 'global'
  const fields = isGlobal ? GLOBAL_FIELDS : PROVIDER_FIELDS
  const totalFields = fields.length + 1

  const isTextProvider = (f: ProviderField) => f === 'key_env' || f === 'base_url' || f === 'default_model'
  const isTextGlobal = (f: GlobalField) => f === 'tmux_session_name'
  const isTextField = isGlobal
    ? isTextGlobal(fields[focusField] as GlobalField)
    : isTextProvider(fields[focusField] as ProviderField)
  const fieldFocused = editing && isTextField

  const nav = useScreenNav(push, pop, fieldFocused)
  const { cmdMode } = nav

  function providerFieldVisible(f: ProviderField): boolean {
    if (section === 'global') return false
    const pc = config.providers[section as Provider]
    if (f === 'key_env') return pc.auth === 'api-key' || pc.auth === 'custom'
    if (f === 'base_url') return pc.auth === 'custom'
    return true
  }

  function updateProviderField(field: ProviderField, updater: (_v: string) => string) {
    if (section === 'global') return
    const s = section as Provider
    setConfig(c => ({
      ...c,
      providers: {
        ...c.providers,
        [s]: { ...c.providers[s], [field]: updater(String(c.providers[s][field] ?? '')) }
      }
    }))
  }

  function updateGlobalText(field: 'tmux_session_name', updater: (_v: string) => string) {
    setConfig(c => ({
      ...c,
      global: { ...c.global, [field]: updater(c.global[field]) }
    }))
  }

  useInput((input, key) => {
    if (fieldFocused) {
      if (key.escape || key.return) { setEditing(false); return }
      if (key.backspace || key.delete) {
        if (isGlobal) {
          updateGlobalText('tmux_session_name', v => v.slice(0, -1))
        } else {
          updateProviderField(fields[focusField] as ProviderField, v => v.slice(0, -1))
        }
        return
      }
      if (!key.ctrl && !key.meta) {
        if (isGlobal) {
          updateGlobalText('tmux_session_name', v => v + input)
        } else {
          updateProviderField(fields[focusField] as ProviderField, v => v + input)
        }
      }
      return
    }

    if (key.tab || key.downArrow) { setFocusField(i => Math.min(totalFields - 1, i + 1)); return }
    if (key.upArrow) { setFocusField(i => Math.max(0, i - 1)); return }
    if (key.leftArrow || key.rightArrow) {
      const dir = key.leftArrow ? -1 : 1 as 1 | -1
      if (focusField === totalFields - 1) {
        setSection(s => cycle(SECTIONS, s, dir))
        setFocusField(0)
        return
      }
      const field = fields[focusField]
      if (!isGlobal) {
        const s = section as Provider
        const pc = config.providers[s]
        if (field === 'auth') {
          setConfig(c => ({ ...c, providers: { ...c.providers, [s]: { ...c.providers[s], auth: cycle(AUTHS, pc.auth, dir) } } }))
        } else if (field === 'default_permissions') {
          setConfig(c => ({ ...c, providers: { ...c.providers, [s]: { ...c.providers[s], default_permissions: cycle(PERMS, pc.default_permissions, dir) } } }))
        } else if (field === 'default_effort') {
          setConfig(c => ({ ...c, providers: { ...c.providers, [s]: { ...c.providers[s], default_effort: cycle(EFFORTS, pc.default_effort, dir) } } }))
        }
      } else {
        if (field === 'peek_interval_seconds') {
          setConfig(c => ({ ...c, global: { ...c.global, peek_interval_seconds: cycle(PEEK_INTERVALS, c.global.peek_interval_seconds as PeekInterval, dir) } }))
        }
      }
      return
    }
    if (key.return) {
      if (focusField === totalFields - 1) {
        saveConfig(config)
        setSaveMsg('saved')
        setTimeout(() => setSaveMsg(''), 2000)
        return
      }
      if (isTextField) { setEditing(true) }
    }
  }, { isActive: !cmdMode })

  const pc = !isGlobal ? config.providers[section as Provider] : null

  function renderProviderField(field: ProviderField, idx: number) {
    if (!providerFieldVisible(field)) return null
    const isFocused = focusField === idx
    const pc = config.providers[section as Provider]
    const label = field.replace(/_/g, ' ').replace(/^default /, '')
    let valueText = ''
    if (field === 'auth') valueText = pc.auth
    else if (field === 'key_env') valueText = pc.key_env ?? ''
    else if (field === 'base_url') valueText = pc.base_url ?? ''
    else if (field === 'default_model') valueText = pc.default_model ?? ''
    else if (field === 'default_effort') valueText = effortLabel(pc.default_effort)
    else if (field === 'default_permissions') valueText = pc.default_permissions
    const isActive = isFocused && editing
    return (
      <Box key={field}>
        <Text color={isFocused ? '#5a96e0' : 'gray'} bold={isFocused}>{(isFocused ? '> ' : '  ') + label.padEnd(14)}</Text>
        {isActive ? (
          <Text>{valueText}<Text color="#5a96e0">█</Text></Text>
        ) : (
          <Text color={valueText ? 'white' : 'gray'} dimColor={!valueText}>{valueText || '(empty)'}</Text>
        )}
      </Box>
    )
  }

  return (
    <ScreenLayout
      screen="Settings"
      panes={panes}
      nav={nav}
      hint="tab/↑↓ navigate  ← → select  enter edit  ← → at save: switch section"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /settings</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 ? (
          <Box
            flexDirection="column"
            width={36}
            marginLeft={2}
            borderStyle="round"
            borderColor="#1e2d3e"
            paddingLeft={1}
            paddingRight={1}
          >
            <Text color="#4a6fa5">── CURRENT {'─'.repeat(20)}</Text>
            {!isGlobal && pc && PROVIDER_FIELDS.map(f => {
              if (!providerFieldVisible(f)) return null
              let v = ''
              if (f === 'auth') v = pc.auth
              else if (f === 'key_env') v = pc.key_env ?? '(empty)'
              else if (f === 'base_url') v = pc.base_url ?? '(empty)'
              else if (f === 'default_model') v = pc.default_model ?? '(empty)'
              else if (f === 'default_effort') v = effortLabel(pc.default_effort)
              else if (f === 'default_permissions') v = pc.default_permissions
              return (
                <Box key={f}>
                  <Text color="gray" dimColor>{f.replace('default_', '').padEnd(12)}</Text>
                  <Text color="gray">{v}</Text>
                </Box>
              )
            })}
            {isGlobal && (
              <>
                <Box>
                  <Text color="gray" dimColor>{'tmux'.padEnd(12)}</Text>
                  <Text color="gray">{config.global.tmux_session_name}</Text>
                </Box>
                <Box>
                  <Text color="gray" dimColor>{'peek'.padEnd(12)}</Text>
                  <Text color="gray">{config.global.peek_interval_seconds}s</Text>
                </Box>
              </>
            )}
          </Box>
        ) : undefined
      }
    >
      <Box marginBottom={1}>
        {SECTIONS.map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <Text color="gray">  </Text>}
            <Text color={section === s ? '#5a96e0' : 'gray'} bold={section === s} underline={section === s}>{s}</Text>
          </React.Fragment>
        ))}
      </Box>

      {!isGlobal && pc && (
        <Box flexDirection="column">
          {PROVIDER_FIELDS.map((f, i) => renderProviderField(f, i))}
        </Box>
      )}

      {isGlobal && (
        <Box flexDirection="column">
          <Box>
            <Text color={focusField === 0 ? '#5a96e0' : 'gray'} bold={focusField === 0}>
              {(focusField === 0 ? '> ' : '  ') + 'tmux session   '}
            </Text>
            {editing && focusField === 0 ? (
              <Text>{config.global.tmux_session_name}<Text color="#5a96e0">█</Text></Text>
            ) : (
              <Text color="white">{config.global.tmux_session_name}</Text>
            )}
          </Box>
          <Box>
            <Text color={focusField === 1 ? '#5a96e0' : 'gray'} bold={focusField === 1}>
              {(focusField === 1 ? '> ' : '  ') + 'peek interval  '}
            </Text>
            <Text color="white">{config.global.peek_interval_seconds}s</Text>
            {focusField === 1 && <Text color="gray" dimColor>  ← →</Text>}
          </Box>
        </Box>
      )}

      <Box marginTop={1}>
        <Text color={focusField === totalFields - 1 ? '#5a96e0' : 'gray'} bold={focusField === totalFields - 1}>
          {(focusField === totalFields - 1 ? '> ' : '  ') + '[ SAVE ]'}
        </Text>
        {focusField === totalFields - 1 && <Text color="gray" dimColor>  ← → switch section</Text>}
      </Box>

      {saveMsg !== '' && <Text color="green">{saveMsg}</Text>}
    </ScreenLayout>
  )
}
