// First-run onboarding screen. Detects available providers and saves default config.
// Inputs: push from router. Outputs: Banner + provider status + setup prompt.
// Invariant: only shown when no config file exists; always saves config before pushing Home.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { CommandPicker } from '../components/CommandPicker.js'
import { StatusBar } from '../components/StatusBar.js'
import { Banner } from '../components/Banner.js'
import { usePanes } from '../hooks/usePanes.js'
import { detectAvailable } from '../launcher/providers.js'
import { defaultConfig, saveConfig } from '../state/config.js'
import type { Provider } from '../state/types.js'

export function Welcome() {
  const { push } = useRouter()
  const panes = usePanes()
  const { cmdMode, cmdValue, cmdError, completions, selectedIdx } = useScreenNav(push, () => {})
  const [providers, setProviders] = useState<Record<Provider, boolean> | null>(null)

  useEffect(() => {
    setProviders(detectAvailable())
  }, [])

  useInput((_, key) => {
    if (cmdMode) return
    if (key.return && providers !== null) {
      saveConfig(defaultConfig())
      push('Home')
    }
  }, { isActive: !cmdMode })

  return (
    <Box flexDirection="column" paddingX={1}>
      <Banner compact={panes === 1} />

      <Box marginTop={1} marginBottom={1}>
        <Text color="#7eb8f5">no config found. press enter to use defaults, or /settings to customize.</Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text color="gray" dimColor>DETECTED PROVIDERS</Text>
        {providers === null && <Text color="gray" dimColor>  detecting...</Text>}
        {providers !== null && (['cc', 'codex', 'gemini'] as Provider[]).map(p => (
          <Box key={p}>
            <Text color={providers[p] ? 'green' : 'gray'}>{providers[p] ? '✓' : '○'}</Text>
            <Text>  {p.padEnd(8)}</Text>
            <Text color="gray" dimColor>{providers[p] ? 'found on PATH' : 'not found — install to use'}</Text>
          </Box>
        ))}
      </Box>

      <Box marginBottom={1}>
        <Text color="gray" dimColor>defaults: auth=subscription, permissions=skip, effort=high</Text>
      </Box>

      <Box flexDirection="column" marginTop={1}>
        <CommandPicker completions={completions} selectedIdx={selectedIdx} />
        {cmdError && <Box paddingLeft={1}><Text color="red">{cmdError}</Text></Box>}
        <Box borderStyle="round" borderColor={cmdMode ? '#5a96e0' : 'gray'} paddingLeft={1} paddingRight={1}>
          <Text color="gray">/ </Text>
          <Text>{cmdMode ? cmdValue : ''}</Text>
          {!cmdMode && <Text color="gray" dimColor>enter to continue, /settings to customize</Text>}
        </Box>
      </Box>

      <StatusBar screen="welcome" />
    </Box>
  )
}
