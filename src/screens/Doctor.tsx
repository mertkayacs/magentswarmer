// System health check display. Runs checks on mount, shows results with status icons.
// Inputs: none (reads system state). Outputs: check list with contextual fix hints.
// Invariant: all checks complete even if some fail; p prunes orphans; ↑↓ selects check.

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { runDoctor, pruneOrphans } from '../launcher/doctor.js'
import type { DoctorResult } from '../launcher/doctor.js'
import type { Session } from '../state/types.js'

const FIX_HINTS: Record<string, string[]> = {
  platform: [
    'Supported targets:',
    '  macOS',
    '  Linux',
    '  Windows via WSL',
    '',
    'Native Windows is unsupported',
    'because reevesagents requires tmux',
    'and POSIX shell behavior.',
  ],
  node: [
    'Install via nvm (recommended):',
    '  nvm install --lts',
    '  nvm use --lts',
    '',
    'Or via Homebrew:',
    '  brew install node',
  ],
  tmux: [
    'Install:',
    '  brew install tmux',
    '  sudo apt install tmux',
    '',
    'Upgrade to 3.0+:',
    '  brew upgrade tmux',
  ],
  providers: [
    'CC (Claude Code):',
    '  npm i -g @anthropic-ai/claude-code',
    '',
    'Codex:',
    '  npm i -g @openai/codex',
    '',
    'Gemini:',
    '  npm i -g @google/gemini-cli',
    '',
    'Hermes:',
    '  brew install hermes-agent',
    '  pip install hermes-agent',
  ],
  'provider compat': [
    'Installed provider versions differ.',
    '',
    'Run provider help to confirm flags:',
    '  claude --help',
    '  codex --help',
    '  gemini --help',
    '  hermes chat --help',
    '',
    'Upgrade the provider CLI if a',
    'required skip/trust flag is missing.',
  ],
  'state dir': [
    'Create the directory:',
    '  mkdir -p ~/.reeves',
    '',
    'Check permissions:',
    '  ls -la ~',
    '  chmod 755 ~/.reeves',
  ],
  registry: [
    'Check REEVES_REGISTRY env var',
    'points to a writable directory.',
    '',
    'Default:',
    '  ~/.local/share/reevesagents',
    '           /sessions',
  ],
  'tmux binding': [
    'Add the session picker binding:',
    '  reevesagents setup-tmux',
    '',
    'Adds Prefix+A to ~/.tmux.conf.',
    'Opens a floating picker from anywhere.',
  ],
  orphans: [
    'Sessions in registry with no',
    'matching tmux window.',
    '',
    'Press p to prune.',
    'Press r to re-run checks.',
  ],
}

function statusIcon(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return '✓'
  if (status === 'warn') return '!'
  return '✗'
}

function statusColor(status: 'ok' | 'warn' | 'fail'): string {
  if (status === 'ok') return 'green'
  if (status === 'warn') return 'yellow'
  return 'red'
}

export function Doctor() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const nav = useScreenNav(push, pop)
  const { cmdMode } = nav
  const [result, setResult] = useState<DoctorResult | null>(null)
  const [pruned, setPruned] = useState(false)
  const [selectedCheck, setSelectedCheck] = useState(0)

  useEffect(() => {
    setResult(runDoctor())
  }, [])

  useInput((input, key) => {
    if (cmdMode) return
    if (key.upArrow && result) { setSelectedCheck(i => Math.max(0, i - 1)); return }
    if (key.downArrow && result) { setSelectedCheck(i => Math.min(result.checks.length - 1, i + 1)); return }
    if (input === 'p' && result && result.orphans.length > 0 && !pruned) {
      pruneOrphans(result.orphans as Session[])
      setPruned(true)
      setResult(prev => prev ? { ...prev, orphans: [] } : null)
      return
    }
    if (input === 'r') { setPruned(false); setResult(runDoctor()); return }
  }, { isActive: !cmdMode })

  const allOk = result?.checks.every(c => c.status === 'ok') ?? false

  return (
    <ScreenLayout
      screen="Doctor"
      panes={panes}
      nav={nav}
      hint="↑↓ select check  p prune orphans  r re-run"
      header={
        <Box>
          <Text color="#5a96e0" bold>REEVES AGENTS</Text>
          <Text color="#4a6fa5">  /doctor · system health checks</Text>
        </Box>
      }
      rightPanel={
        panes >= 2 && result ? (
          <Box
            flexDirection="column"
            width={40}
            marginLeft={2}
            borderStyle="round"
            borderColor="#1e2d3e"
            paddingLeft={1}
            paddingRight={1}
          >
            {(() => {
              const check = result.checks[selectedCheck]
              if (!check) return null
              const hints = FIX_HINTS[check.name] ?? ['No specific fix available.']
              return (
                <>
                  <Text color={statusColor(check.status)} bold>{check.name.toUpperCase()}</Text>
                  <Text color="gray" dimColor>{check.detail}</Text>
                  {check.status !== 'ok' && (
                    <Box flexDirection="column" marginTop={1}>
                      {hints.map((line, i) => (
                        <Text key={i} color={line.startsWith('  ') ? '#7eb8f5' : 'gray'} dimColor={line === ''}>
                          {line || ' '}
                        </Text>
                      ))}
                    </Box>
                  )}
                  {check.status === 'ok' && (
                    <Box marginTop={1}><Text color="green" dimColor>all good</Text></Box>
                  )}
                </>
              )
            })()}
          </Box>
        ) : undefined
      }
    >
      {!result && <Text color="gray" dimColor>running checks...</Text>}

      {result && (
        <Box flexDirection="column" marginBottom={1}>
          {result.checks.map((check, i) => (
            <Box key={check.name}>
              <Text color={i === selectedCheck ? '#5a96e0' : 'gray'}>{i === selectedCheck ? '> ' : '  '}</Text>
              <Text color={statusColor(check.status)}>{statusIcon(check.status)}</Text>
              <Text color={i === selectedCheck ? 'white' : 'gray'}> {check.name.padEnd(14)}</Text>
              <Text color="gray" dimColor>{check.detail}</Text>
            </Box>
          ))}

          {result.orphans.length > 0 && !pruned && (
            <Box flexDirection="column" marginTop={1}>
              <Text color="yellow">{result.orphans.length} orphan session{result.orphans.length !== 1 ? 's' : ''}</Text>
              {result.orphans.map((s: Session) => (
                <Text key={s.id} color="gray" dimColor>  {s.id}</Text>
              ))}
              <Text color="gray" dimColor>p to prune, r to re-run</Text>
            </Box>
          )}

          {pruned && (
            <Box marginTop={1}><Text color="green">orphans pruned</Text></Box>
          )}

          {result.orphans.length === 0 && !pruned && (
            <Box marginTop={1}>
              <Text color={allOk ? 'green' : 'yellow'}>
                {allOk ? 'all checks passed' : 'some checks need attention'}
              </Text>
              <Text color="gray" dimColor>  r to re-run</Text>
            </Box>
          )}
        </Box>
      )}
    </ScreenLayout>
  )
}
