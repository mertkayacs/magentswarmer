// Provider config editor: auth mode, key env var, model defaults per provider.
// Inputs: loads current config on mount. Outputs: form Box, saves on submit.
// Invariant: useScreenNav disabled when a text field is being edited.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { FieldHint } from '../components/FieldHint.js'
import { loadConfig, saveConfig } from '../state/config.js'
import type { Auth } from '../state/types.js'

const AUTHS: Auth[] = ['subscription', 'api-key', 'custom']

// Fields: 0=cc_auth, 1=cc_key, 2=codex_auth, 3=codex_key, 4=gemini_auth, 5=gemini_key, 6=save
const TOTAL_FIELDS = 7

function cycleAuth(current: Auth, dir: 1 | -1): Auth {
  const idx = AUTHS.indexOf(current)
  return AUTHS[(idx + dir + AUTHS.length) % AUTHS.length]
}

export function Settings() {
  const { push, pop } = useRouter()
  const [focusIdx, setFocusIdx] = useState(0)
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState(false)

  const [ccAuth, setCcAuth] = useState<Auth>('subscription')
  const [ccKeyEnv, setCcKeyEnv] = useState('')
  const [codexAuth, setCodexAuth] = useState<Auth>('subscription')
  const [codexKeyEnv, setCodexKeyEnv] = useState('')
  const [geminiAuth, setGeminiAuth] = useState<Auth>('subscription')
  const [geminiKeyEnv, setGeminiKeyEnv] = useState('')

  const isTextField = [1, 3, 5].includes(focusIdx)
  const fieldFocused = editing && isTextField

  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, pop, fieldFocused)

  useEffect(() => {
    const cfg = loadConfig()
    setCcAuth(cfg.providers.cc.auth)
    setCcKeyEnv(cfg.providers.cc.key_env ?? '')
    setCodexAuth(cfg.providers.codex.auth)
    setCodexKeyEnv(cfg.providers.codex.key_env ?? '')
    setGeminiAuth(cfg.providers.gemini.auth)
    setGeminiKeyEnv(cfg.providers.gemini.key_env ?? '')
  }, [])

  function currentTextSetter(): ((v: (prev: string) => string) => void) | null {
    if (focusIdx === 1) return setCcKeyEnv as unknown as ((v: (prev: string) => string) => void)
    if (focusIdx === 3) return setCodexKeyEnv as unknown as ((v: (prev: string) => string) => void)
    if (focusIdx === 5) return setGeminiKeyEnv as unknown as ((v: (prev: string) => string) => void)
    return null
  }

  // Text input handler (active when editing a text field)
  useInput((input, key) => {
    const setter = currentTextSetter()
    if (!setter) return
    if (key.escape || key.return) {
      setEditing(false)
      if (key.return) setFocusIdx(i => Math.min(TOTAL_FIELDS - 1, i + 1))
      return
    }
    if (key.backspace || key.delete) { setter(v => v.slice(0, -1)); return }
    if (!key.ctrl && !key.meta) setter(v => v + input)
  }, { isActive: fieldFocused })

  // Navigation handler (active when not editing and not in cmd mode)
  useInput((input, key) => {
    if (key.tab || key.downArrow) {
      setFocusIdx(i => Math.min(TOTAL_FIELDS - 1, i + 1))
      return
    }
    if (key.upArrow || (key.tab && key.shift)) {
      setFocusIdx(i => Math.max(0, i - 1))
      return
    }
    if (key.leftArrow) {
      if (focusIdx === 0) setCcAuth(a => cycleAuth(a, -1))
      else if (focusIdx === 2) setCodexAuth(a => cycleAuth(a, -1))
      else if (focusIdx === 4) setGeminiAuth(a => cycleAuth(a, -1))
      return
    }
    if (key.rightArrow) {
      if (focusIdx === 0) setCcAuth(a => cycleAuth(a, 1))
      else if (focusIdx === 2) setCodexAuth(a => cycleAuth(a, 1))
      else if (focusIdx === 4) setGeminiAuth(a => cycleAuth(a, 1))
      return
    }
    if (key.return) {
      if (isTextField) { setEditing(true); return }
      if (focusIdx === TOTAL_FIELDS - 1) {
        const cfg = loadConfig()
        cfg.providers.cc.auth = ccAuth
        cfg.providers.cc.key_env = ccKeyEnv || null
        cfg.providers.codex.auth = codexAuth
        cfg.providers.codex.key_env = codexKeyEnv || null
        cfg.providers.gemini.auth = geminiAuth
        cfg.providers.gemini.key_env = geminiKeyEnv || null
        saveConfig(cfg)
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
    }
  }, { isActive: !fieldFocused && !cmdMode })

  function rowColor(idx: number) {
    return focusIdx === idx ? '#5a96e0' : 'gray'
  }

  function selectRow(idx: number, label: string, options: Auth[], value: Auth) {
    const focused = focusIdx === idx
    return (
      <Box key={idx}>
        <Text color={rowColor(idx)} bold={focused}>{focused ? '>' : ' '} {label.padEnd(14)}</Text>
        {options.map((opt, i) => (
          <React.Fragment key={opt}>
            {i > 0 && <Text color="gray"> </Text>}
            <Text color={value === opt ? '#7eb8f5' : 'gray'} bold={value === opt}>{opt}</Text>
          </React.Fragment>
        ))}
      </Box>
    )
  }

  function textRow(idx: number, label: string, value: string, hint: string) {
    const focused = focusIdx === idx
    const active = focused && editing
    return (
      <Box key={idx} flexDirection="column">
        <Box>
          <Text color={rowColor(idx)} bold={focused}>{focused ? '>' : ' '} {label.padEnd(14)}</Text>
          {active ? (
            <Text>{value}<Text color="#5a96e0">█</Text></Text>
          ) : (
            <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || hint}</Text>
          )}
        </Box>
        {focused && !active && <FieldHint text="press enter to edit" />}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      <Box marginBottom={1}>
        <Text color="#5a96e0" bold>settings</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>CC (claude)</Text>
        {selectRow(0, 'auth', AUTHS, ccAuth)}
        {textRow(1, 'key env', ccKeyEnv, 'ANTHROPIC_API_KEY')}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>CODEX</Text>
        {selectRow(2, 'auth', AUTHS, codexAuth)}
        {textRow(3, 'key env', codexKeyEnv, 'OPENAI_API_KEY')}
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>GEMINI</Text>
        {selectRow(4, 'auth', AUTHS, geminiAuth)}
        {textRow(5, 'key env', geminiKeyEnv, 'GEMINI_API_KEY')}
      </Box>

      <Box>
        <Text color={focusIdx === TOTAL_FIELDS - 1 ? '#5a96e0' : 'gray'} bold={focusIdx === TOTAL_FIELDS - 1}>
          {focusIdx === TOTAL_FIELDS - 1 ? '>' : ' '} [save]
        </Text>
        {saved && <Text color="green">  saved</Text>}
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>tab to navigate, enter to edit/save</Text>}
        </Box>
      </Box>

      <StatusBar screen="settings" />
    </Box>
  )
}
