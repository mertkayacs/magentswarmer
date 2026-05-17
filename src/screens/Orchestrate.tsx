// Orchestrate: compose and launch agent trees, with optional saved presets.
// Views: builder (compose), list (load presets), launch (launch older presets with overrides).
// Invariant: all spawns wrapped in try/catch; builder skips worker fields when count is 0.

import React, { useState, useEffect, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { useRouter } from '../router.js'
import { useScreenNav } from '../hooks/useScreenNav.js'
import { usePanes } from '../hooks/usePanes.js'
import { ScreenLayout } from '../components/ScreenLayout.js'
import { useSessionState } from '../state/SessionContext.js'
import { spawn } from '../launcher/spawn.js'
import { listSavedTrees, saveSavedTree, deleteSavedTree } from '../state/store.js'
import { providerColor } from '../utils/display.js'
import { nowIso } from '../state/registry.js'
import { PROVIDERS } from '../launcher/providers.js'
import type { Provider, Permissions, AuthMode, Effort, SavedTree, SavedTreeSlot } from '../state/types.js'

type View = 'list' | 'launch' | 'builder' | 'confirm-delete'

const PERMS: Permissions[] = ['ask', 'skip']
const AUTH_MODES: AuthMode[] = ['default', 'api-key']
const EFFORTS: Effort[] = ['default', 'low', 'medium', 'high', 'xhigh', 'max']
const AUTH_PROVIDERS = new Set<Provider>(['cc'])
const EFFORT_PROVIDERS = new Set<Provider>(['cc'])
const RC_PROVIDERS = new Set<Provider>(['cc', 'codex'])

function cycle<T>(arr: T[], v: T, dir: 1 | -1): T {
  const i = arr.indexOf(v)
  return arr[(i + dir + arr.length) % arr.length]!
}

// Builder field indices:
// 0=name 1=desc 2=working_dir 3=root.nick 4=root.provider 5=root.permissions
// 6=root.auth 7=root.effort 8=root.rc 9=root.model 10=root.task
// 11=num_workers 12=worker.provider 13=worker.permissions 14=worker.auth 15=worker.effort
// 16=worker.rc 17=worker.model 18=worker.task 19=LAUNCH 20=SAVE
const B_TOTAL = 21
const B_TEXT = new Set([0, 1, 2, 3, 9, 10, 17, 18])

// Launch fields: 0=root_task  1=working_dir  2=LAUNCH
const L_TOTAL = 3

function authFor(provider: Provider, auth: AuthMode): AuthMode {
  return AUTH_PROVIDERS.has(provider) ? auth : 'default'
}

function effortFor(provider: Provider, effort: Effort): Effort {
  return EFFORT_PROVIDERS.has(provider) ? effort : 'default'
}

function rcFor(provider: Provider, enabled: boolean): boolean {
  return RC_PROVIDERS.has(provider) && enabled
}

export function Orchestrate() {
  const { push, pop } = useRouter()
  const panes = usePanes()
  const { refresh } = useSessionState()

  const [view, setView] = useState<View>('builder')
  const [trees, setTrees] = useState<SavedTree[]>([])
  const [listIdx, setListIdx] = useState(0)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  const reloadTrees = useCallback(() => {
    setTrees(listSavedTrees().sort((a, b) => b.updated_at.localeCompare(a.updated_at)))
  }, [])

  useEffect(() => { reloadTrees() }, [reloadTrees])

  const selectedTree = trees[listIdx]

  // --- Launch view state ---
  const [lTask, setLTask] = useState('')
  const [lDir, setLDir] = useState('')
  const [lFocus, setLFocus] = useState(0)
  const [lCursor, setLCursor] = useState(0)

  // --- Builder view state ---
  const [bFocus, setBFocus] = useState(0)
  const [bCursor, setBCursor] = useState(0)
  const [bName, setBName] = useState('')
  const [bDesc, setBDesc] = useState('')
  const [bWorkDir, setBWorkDir] = useState('')
  const [bRootNick, setBRootNick] = useState('root')
  const [bRootProvider, setBRootProvider] = useState<Provider>('cc')
  const [bRootPerms, setBRootPerms] = useState<Permissions>('ask')
  const [bRootAuth, setBRootAuth] = useState<AuthMode>('default')
  const [bRootEffort, setBRootEffort] = useState<Effort>('default')
  const [bRootRc, setBRootRc] = useState(false)
  const [bRootModel, setBRootModel] = useState('')
  const [bRootTask, setBRootTask] = useState('')
  const [bCount, setBCount] = useState(1)
  const [bWProvider, setBWProvider] = useState<Provider>('cc')
  const [bWPerms, setBWPerms] = useState<Permissions>('ask')
  const [bWAuth, setBWAuth] = useState<AuthMode>('default')
  const [bWEffort, setBWEffort] = useState<Effort>('default')
  const [bWRc, setBWRc] = useState(false)
  const [bWModel, setBWModel] = useState('')
  const [bWTask, setBWTask] = useState('support the root agent: {{root_task}}')

  function openBuilder(tree?: SavedTree) {
    if (tree) {
      setBName(tree.name); setBDesc(tree.description); setBWorkDir(tree.root.working_dir || tree.working_dir_pattern || '')
      setBRootNick(tree.root.nickname_template); setBRootProvider(tree.root.provider)
      setBRootPerms(tree.root.permissions); setBRootAuth(tree.root.auth_mode); setBRootEffort(tree.root.effort)
      setBRootRc(tree.root.rc_enabled); setBRootModel(tree.root.model)
      setBRootTask(tree.root.task_template); setBCount(tree.workers.length)
      const w = tree.workers[0]
      if (w) {
        setBWProvider(w.provider); setBWPerms(w.permissions); setBWAuth(w.auth_mode); setBWEffort(w.effort)
        setBWRc(w.rc_enabled); setBWModel(w.model); setBWTask(w.task_template)
      }
    } else {
      setBName(''); setBDesc(''); setBWorkDir(''); setBRootNick('root')
      setBRootProvider('cc'); setBRootPerms('ask'); setBRootAuth('default'); setBRootEffort('default')
      setBRootRc(false); setBRootModel(''); setBRootTask('')
      setBCount(1); setBWProvider('cc'); setBWPerms('ask'); setBWAuth('default'); setBWEffort('default')
      setBWRc(false); setBWModel('')
      setBWTask('support the root agent: {{root_task}}')
    }
    setBFocus(0); setBCursor(0); setError('')
    setView('builder')
  }

  function openLaunch(tree: SavedTree) {
      setLTask(tree.root.task_template); setLDir(tree.root.working_dir || tree.working_dir_pattern || '')
    setLFocus(0); setLCursor(tree.root.task_template.length); setError('')
    setView('launch')
  }

  function saveBuilder() {
    if (!bName.trim()) { setError('name is required'); return }
    const now = nowIso()
    const existing = trees.find(t => t.name === bName.trim())
    const workers: SavedTreeSlot[] = Array.from({ length: bCount }, (_, i) => ({
      nickname_template: `worker-${i + 1}`,
      provider: bWProvider, model: bWModel,
      auth_mode: authFor(bWProvider, bWAuth), effort: effortFor(bWProvider, bWEffort),
      task_template: bWTask, working_dir: bWorkDir, permissions: bWPerms, rc_enabled: rcFor(bWProvider, bWRc),
    }))
    saveSavedTree({
      name: bName.trim(), description: bDesc, working_dir_pattern: bWorkDir,
      root: { nickname_template: bRootNick || 'root', provider: bRootProvider, model: bRootModel,
              auth_mode: authFor(bRootProvider, bRootAuth), effort: effortFor(bRootProvider, bRootEffort),
              task_template: bRootTask, working_dir: bWorkDir,
              permissions: bRootPerms, rc_enabled: rcFor(bRootProvider, bRootRc) },
      workers, created_at: existing?.created_at ?? now, updated_at: now,
    })
    reloadTrees(); setError(''); setView('list')
  }

  function treeFromBuilder(): SavedTree {
    const now = nowIso()
    const workers: SavedTreeSlot[] = Array.from({ length: bCount }, (_, i) => ({
      nickname_template: `worker-${i + 1}`,
      provider: bWProvider,
      model: bWModel,
      auth_mode: authFor(bWProvider, bWAuth),
      effort: effortFor(bWProvider, bWEffort),
      task_template: bWTask,
      working_dir: bWorkDir,
      permissions: bWPerms,
      rc_enabled: rcFor(bWProvider, bWRc),
    }))
    return {
      name: bName.trim() || 'composed-tree',
      description: bDesc,
      working_dir_pattern: bWorkDir,
      root: {
        nickname_template: bRootNick || 'root',
        provider: bRootProvider,
        model: bRootModel,
        auth_mode: authFor(bRootProvider, bRootAuth),
        effort: effortFor(bRootProvider, bRootEffort),
        task_template: bRootTask || '(interactive)',
        working_dir: bWorkDir,
        permissions: bRootPerms,
        rc_enabled: rcFor(bRootProvider, bRootRc),
      },
      workers,
      created_at: now,
      updated_at: now,
    }
  }

  function launchTree(tree: SavedTree, rootTaskInput: string, dirInput: string): boolean {
    setError('')
    try {
      const rootTask = rootTaskInput.trim() || tree.root.task_template || '(interactive)'
      const workDir = dirInput.trim() || tree.root.working_dir || tree.working_dir_pattern || process.cwd()
      const rootSession = spawn({
        provider: tree.root.provider, model: tree.root.model,
        auth_mode: tree.root.auth_mode, effort: tree.root.effort,
        task: rootTask, working_dir: workDir,
        nickname: tree.root.nickname_template,
        permissions: tree.root.permissions, rc_enabled: tree.root.rc_enabled,
      })
      let spawned = 1
      for (const w of tree.workers) {
        try {
          spawn({
            provider: w.provider, model: w.model,
            auth_mode: w.auth_mode, effort: w.effort,
            task: w.task_template.replace('{{root_task}}', rootTask),
            working_dir: w.working_dir || workDir, nickname: w.nickname_template,
            permissions: w.permissions, rc_enabled: w.rc_enabled,
            parent_id: rootSession.id,
          })
          spawned++
        } catch { /* skip failed workers */ }
      }
      refresh()
      setNotice(`launched ${spawned} agent${spawned > 1 ? 's' : ''}`)
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'launch failed')
      return false
    }
  }

  function doLaunch() {
    if (!selectedTree) return
    if (launchTree(selectedTree, lTask, lDir)) setView('builder')
  }

  function launchBuilder() {
    launchTree(treeFromBuilder(), bRootTask, bWorkDir)
  }

  // Builder field skip when no workers
  function bNext(from: number): number {
    const raw = Math.min(B_TOTAL - 1, from + 1)
    return bCount === 0 && raw >= 12 && raw <= 18 ? 19 : raw
  }
  function bPrev(from: number): number {
    const raw = Math.max(0, from - 1)
    return bCount === 0 && raw >= 12 && raw <= 18 ? 11 : raw
  }

  function bVal(idx: number): string {
    if (idx === 0) return bName; if (idx === 1) return bDesc; if (idx === 2) return bWorkDir
    if (idx === 3) return bRootNick; if (idx === 9) return bRootModel; if (idx === 10) return bRootTask
    if (idx === 17) return bWModel; if (idx === 18) return bWTask
    return ''
  }
  function setBVal(idx: number, fn: (_v: string) => string) {
    if (idx === 0) setBName(fn); else if (idx === 1) setBDesc(fn); else if (idx === 2) setBWorkDir(fn)
    else if (idx === 3) setBRootNick(fn); else if (idx === 9) setBRootModel(fn)
    else if (idx === 10) setBRootTask(fn); else if (idx === 17) setBWModel(fn)
    else if (idx === 18) setBWTask(fn)
  }

  const isBuilderText = view === 'builder' && B_TEXT.has(bFocus)
  const isLaunchText  = view === 'launch'  && lFocus < 2
  const nav = useScreenNav(push, pop, isBuilderText || isLaunchText)
  const { cmdMode } = nav

  useInput((input, key) => {
    if (cmdMode) return

    // LIST
    if (view === 'list') {
      if (key.upArrow)   { setListIdx(i => Math.max(0, i - 1)); return }
      if (key.downArrow) { setListIdx(i => Math.min(trees.length - 1, i + 1)); return }
      if (key.return && selectedTree) { openLaunch(selectedTree); return }
      if (input === 'l' && selectedTree) { openBuilder(selectedTree); return }
      if (input === 'n') { openBuilder(); return }
      if (input === 'e' && selectedTree) { openBuilder(selectedTree); return }
      if (input === 'd' && selectedTree) { setView('confirm-delete'); return }
      if (key.escape) { pop(); return }
      return
    }

    // CONFIRM DELETE
    if (view === 'confirm-delete') {
      if (input === 'y' || key.return) {
        if (selectedTree) deleteSavedTree(selectedTree.name)
        reloadTrees(); setListIdx(i => Math.max(0, i - 1)); setView('list'); return
      }
      if (input === 'n' || key.escape) { setView('list'); return }
      return
    }

    // LAUNCH
    if (view === 'launch') {
      if (key.escape) { setView('list'); return }
      const lIsText = lFocus < 2
      if (lIsText) {
        if (key.upArrow)   { setLFocus(f => Math.max(0, f - 1)); return }
        if (key.downArrow || key.return) {
          if (lFocus < L_TOTAL - 1) { setLFocus(f => f + 1); return }
          doLaunch(); return
        }
        if (key.leftArrow)  { setLCursor(c => Math.max(0, c - 1)); return }
        if (key.rightArrow) { setLCursor(c => Math.min((lFocus === 0 ? lTask : lDir).length, c + 1)); return }
        if (key.backspace && lCursor > 0) {
          if (lFocus === 0) setLTask(v => v.slice(0, lCursor - 1) + v.slice(lCursor))
          else setLDir(v => v.slice(0, lCursor - 1) + v.slice(lCursor))
          setLCursor(c => c - 1); return
        }
        if (!key.ctrl && !key.meta && input) {
          if (lFocus === 0) setLTask(v => v.slice(0, lCursor) + input + v.slice(lCursor))
          else setLDir(v => v.slice(0, lCursor) + input + v.slice(lCursor))
          setLCursor(c => c + 1); return
        }
        return
      }
      if (key.upArrow)   { setLFocus(f => Math.max(0, f - 1)); return }
      if (key.downArrow) { setLFocus(f => Math.min(L_TOTAL - 1, f + 1)); return }
      if (key.return && lFocus === L_TOTAL - 1) { doLaunch(); return }
      return
    }

    // BUILDER
    if (view === 'builder') {
      if (key.escape && !B_TEXT.has(bFocus)) { setView('list'); setError(''); return }
      if (B_TEXT.has(bFocus)) {
        if (key.escape) { setView('list'); setError(''); return }
        if (key.upArrow)   { const t = bPrev(bFocus); setBFocus(t); setBCursor(bVal(t).length); return }
        if (key.downArrow || key.return) {
          if (bFocus < B_TOTAL - 1) { const t = bNext(bFocus); setBFocus(t); setBCursor(bVal(t).length); return }
          saveBuilder(); return
        }
        if (key.leftArrow)  { setBCursor(c => Math.max(0, c - 1)); return }
        if (key.rightArrow) { setBCursor(c => Math.min(bVal(bFocus).length, c + 1)); return }
        if (key.backspace && bCursor > 0) {
          setBVal(bFocus, v => v.slice(0, bCursor - 1) + v.slice(bCursor))
          setBCursor(c => c - 1); return
        }
        if (!key.ctrl && !key.meta && input) {
          setBVal(bFocus, v => v.slice(0, bCursor) + input + v.slice(bCursor))
          setBCursor(c => c + 1); return
        }
        return
      }
      // select / numeric fields
      if (key.leftArrow || key.rightArrow) {
        const dir = key.leftArrow ? -1 as const : 1 as const
        if (bFocus === 4) setBRootProvider(p => cycle(PROVIDERS, p, dir))
        else if (bFocus === 5) setBRootPerms(p => cycle(PERMS, p, dir))
        else if (bFocus === 6 && AUTH_PROVIDERS.has(bRootProvider)) setBRootAuth(p => cycle(AUTH_MODES, p, dir))
        else if (bFocus === 7 && EFFORT_PROVIDERS.has(bRootProvider)) setBRootEffort(p => cycle(EFFORTS, p, dir))
        else if (bFocus === 8 && RC_PROVIDERS.has(bRootProvider)) setBRootRc(v => !v)
        else if (bFocus === 11) setBCount(n => Math.max(0, Math.min(10, n + dir)))
        else if (bFocus === 12) setBWProvider(p => cycle(PROVIDERS, p, dir))
        else if (bFocus === 13) setBWPerms(p => cycle(PERMS, p, dir))
        else if (bFocus === 14 && AUTH_PROVIDERS.has(bWProvider)) setBWAuth(p => cycle(AUTH_MODES, p, dir))
        else if (bFocus === 15 && EFFORT_PROVIDERS.has(bWProvider)) setBWEffort(p => cycle(EFFORTS, p, dir))
        else if (bFocus === 16 && RC_PROVIDERS.has(bWProvider)) setBWRc(v => !v)
        return
      }
      if (key.upArrow)   { const t = bPrev(bFocus); setBFocus(t); setBCursor(bVal(t).length); return }
      if (key.downArrow) { const t = bNext(bFocus); setBFocus(t); setBCursor(bVal(t).length); return }
      if (key.return && bFocus === 19) { launchBuilder(); return }
      if (key.return && bFocus === 20) { saveBuilder(); return }
      if (input === 'p') { reloadTrees(); setView('list'); return }
      if (key.escape) { setView('list'); setError(''); return }
      return
    }
  }, { isActive: !cmdMode })

  // ---- Render helpers ----
  const marker = (focused: boolean) => focused ? '>' : ' '
  const lc = (focused: boolean) => focused ? '#5a96e0' : 'gray'

  function TRow({ idx: _idx, label, value, placeholder, cursor, focused, textActive }:
    { idx: number; label: string; value: string; placeholder: string; cursor: number; focused: boolean; textActive: boolean }) {
    const MAX = 46
    let display: React.ReactNode
    if (focused && textActive) {
      const start = Math.max(0, cursor - Math.floor(MAX / 2))
      const view = value.slice(start, start + MAX)
      const ci = cursor - start
      display = <Text>{view.slice(0, ci)}<Text color="#5a96e0">█</Text>{view.slice(ci)}</Text>
    } else {
      display = <Text color={value ? 'white' : 'gray'} dimColor={!value}>{value || placeholder}</Text>
    }
    return (
      <Box>
        <Text color={lc(focused)} bold={focused}>{marker(focused)} {label.padEnd(18)}</Text>
        {display}
      </Box>
    )
  }

  function SRow({ label, value, color, focused }:
    { label: string; value: string; color: string; focused: boolean }) {
    return (
      <Box>
        <Text color={lc(focused)} bold={focused}>{marker(focused)} {label.padEnd(18)}</Text>
        {focused && <Text color="gray" dimColor>{'← '}</Text>}
        <Text color={color} bold={focused}>{value}</Text>
        {focused && <Text color="gray" dimColor>{' →'}</Text>}
      </Box>
    )
  }

  const header = (
    <Box>
      <Text color="#5a96e0" bold>REEVES AGENTS</Text>
      <Text color="#4a6fa5">  /orchestrate</Text>
      {view !== 'list' && <Text color="gray" dimColor>  {view}</Text>}
    </Box>
  )

  // ---- LIST ----
  if (view === 'list') {
    const rightPanel = panes >= 2 && selectedTree ? (
      <Box flexDirection="column" width={44} marginLeft={1} borderStyle="round" borderColor="#1e2d3e" paddingX={1}>
        <Text color="#4a6fa5">── {selectedTree.name.slice(0, 24)} ──</Text>
        {selectedTree.description
          ? <Box marginTop={1}><Text color="gray" wrap="wrap">{selectedTree.description}</Text></Box>
          : null}
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="gray" dimColor>root    </Text>
            <Text color={providerColor(selectedTree.root.provider)}>{selectedTree.root.provider}</Text>
            <Text color="gray" dimColor>  {selectedTree.root.nickname_template}</Text>
          </Box>
          {selectedTree.root.task_template
            ? <Text color="gray" dimColor wrap="wrap">  {selectedTree.root.task_template.slice(0, 56)}</Text>
            : null}
        </Box>
        {selectedTree.workers.length > 0 && (
          <Box marginTop={1} flexDirection="column">
            <Text color="gray" dimColor>workers ({selectedTree.workers.length})</Text>
            {selectedTree.workers.slice(0, 4).map((w, i) => (
              <Box key={i}>
                <Text color="gray" dimColor>  </Text>
                <Text color={providerColor(w.provider)}>{w.provider}</Text>
                <Text color="gray" dimColor>  {w.nickname_template}</Text>
              </Box>
            ))}
          </Box>
        )}
        <Box marginTop={1}>
        <Text color="#4a6fa5">Enter </Text><Text color="gray" dimColor>launch  </Text>
        <Text color="#4a6fa5">l </Text><Text color="gray" dimColor>load  </Text>
          <Text color="#4a6fa5">e </Text><Text color="gray" dimColor>edit  </Text>
          <Text color="red" dimColor>d delete</Text>
        </Box>
      </Box>
    ) : undefined

    return (
      <ScreenLayout screen="Orchestrate" panes={panes} nav={nav} header={header}
        rightPanel={rightPanel} hint="↑↓ navigate  Enter launch  l load  n new  e edit  d delete">
        {trees.length === 0 ? (
          <Box flexDirection="column" marginTop={1}>
            <Text color="gray" dimColor>no saved trees yet</Text>
            <Box marginTop={1}>
              <Text color="gray" dimColor>press </Text><Text color="#5a96e0">n</Text>
              <Text color="gray" dimColor> to build a template, or use MCP tools from an agent</Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="column">
            {trees.map((t, i) => {
              const sel = i === listIdx
              return (
                <Box key={t.name}>
                  <Text color={sel ? '#5a96e0' : 'gray'}>{sel ? '>' : ' '} </Text>
                  <Text color={sel ? 'white' : '#c9d1d9'} bold={sel}>{t.name.slice(0, 20).padEnd(21)}</Text>
                  <Text color="gray" dimColor>{t.workers.length + 1}a  </Text>
                  <Text color="gray" dimColor>{t.description.slice(0, 28)}</Text>
                </Box>
              )
            })}
          </Box>
        )}
        {notice && <Box marginTop={1}><Text color="green">{notice}</Text></Box>}
        {error  && <Box marginTop={1}><Text color="red">{error}</Text></Box>}
      </ScreenLayout>
    )
  }

  // ---- CONFIRM DELETE ----
  if (view === 'confirm-delete') {
    return (
      <ScreenLayout screen="Orchestrate" panes={panes} nav={nav} header={header}
        hint="y/Enter confirm  n/Esc cancel">
        <Box flexDirection="column" marginTop={1}>
          <Box>
            <Text>Delete </Text>
            <Text color="#e5a050" bold>{selectedTree?.name}</Text>
            <Text>?</Text>
          </Box>
          <Box marginTop={1}>
            <Text color="green">y/Enter</Text><Text color="gray"> confirm   </Text>
            <Text color="gray">n/Esc cancel</Text>
          </Box>
        </Box>
      </ScreenLayout>
    )
  }

  // ---- LAUNCH ----
  if (view === 'launch' && selectedTree) {
    const total = 1 + selectedTree.workers.length
    return (
      <ScreenLayout screen="Orchestrate" panes={panes} nav={nav} header={header}
        hint="↑↓ navigate  enter next/launch  esc back">
        <Box flexDirection="column" marginBottom={1}>
          <Text color="#4a6fa5">── {selectedTree.name} ──  </Text>
          <Text color="gray" dimColor>{total} agent{total > 1 ? 's' : ''} will spawn</Text>
        </Box>
        <Box flexDirection="column">
          <TRow idx={0} label="root task" value={lTask}
            placeholder={selectedTree.root.task_template || 'what should the root agent do?'}
            cursor={lCursor} focused={lFocus === 0} textActive={lFocus === 0} />
          <TRow idx={1} label="working dir" value={lDir}
            placeholder={selectedTree.root.working_dir || selectedTree.working_dir_pattern || process.cwd()}
            cursor={lCursor} focused={lFocus === 1} textActive={lFocus === 1} />
          <Box>
            <Text color={lc(lFocus === 2)} bold={lFocus === 2}>
              {marker(lFocus === 2)} [ LAUNCH {total} AGENT{total > 1 ? 'S' : ''} ]
            </Text>
          </Box>
        </Box>
        {error && <Box marginTop={1}><Text color="red">{error}</Text></Box>}
      </ScreenLayout>
    )
  }

  // ---- BUILDER ----
  const f = bFocus
  return (
    <ScreenLayout screen="Orchestrate" panes={panes} nav={nav} header={header}
      hint="↑↓/tab navigate  ← → select/adjust  esc cancel">
      <Box flexDirection="column">
        <Text color="#4a6fa5">── COMPOSE TREE ──────────────────</Text>
        <TRow idx={0} label="name *" value={bName} placeholder="my-tree" cursor={bCursor} focused={f===0} textActive={f===0} />
        <TRow idx={1} label="description" value={bDesc} placeholder="(optional)" cursor={bCursor} focused={f===1} textActive={f===1} />
        <TRow idx={2} label="working dir" value={bWorkDir} placeholder={process.cwd()} cursor={bCursor} focused={f===2} textActive={f===2} />

        <Box marginTop={1}><Text color="#4a6fa5">── ROOT AGENT ─────────────────────</Text></Box>
        <TRow idx={3} label="nickname" value={bRootNick} placeholder="root" cursor={bCursor} focused={f===3} textActive={f===3} />
        <SRow label="provider" value={bRootProvider} color={providerColor(bRootProvider)} focused={f===4} />
        <SRow label="permissions" value={bRootPerms} color="#7eb8f5" focused={f===5} />
        <SRow label="auth" value={authFor(bRootProvider, bRootAuth)} color="#7eb8f5" focused={f===6} />
        <SRow label="effort" value={effortFor(bRootProvider, bRootEffort)} color="#7eb8f5" focused={f===7} />
        <SRow label="remote control" value={rcFor(bRootProvider, bRootRc) ? 'on' : 'off'} color="#7eb8f5" focused={f===8} />
        <TRow idx={9} label="model" value={bRootModel} placeholder="(provider default)" cursor={bCursor} focused={f===9} textActive={f===9} />
        <TRow idx={10} label="task template" value={bRootTask} placeholder="what should the root agent do?" cursor={bCursor} focused={f===10} textActive={f===10} />

        <Box marginTop={1}><Text color="#4a6fa5">── WORKERS ────────────────────────</Text></Box>
        <Box>
          <Text color={lc(f===11)} bold={f===11}>{marker(f===11)} {'count'.padEnd(18)}</Text>
          {f===11 && <Text color="gray" dimColor>{'← '}</Text>}
          <Text color="#7eb8f5" bold={f===11}>{bCount}</Text>
          {f===11 && <Text color="gray" dimColor>{' →  (0-10)'}</Text>}
        </Box>
        {bCount > 0 && (
          <>
            <SRow label="provider" value={bWProvider} color={providerColor(bWProvider)} focused={f===12} />
            <SRow label="permissions" value={bWPerms} color="#7eb8f5" focused={f===13} />
            <SRow label="auth" value={authFor(bWProvider, bWAuth)} color="#7eb8f5" focused={f===14} />
            <SRow label="effort" value={effortFor(bWProvider, bWEffort)} color="#7eb8f5" focused={f===15} />
            <SRow label="remote control" value={rcFor(bWProvider, bWRc) ? 'on' : 'off'} color="#7eb8f5" focused={f===16} />
            <TRow idx={17} label="model" value={bWModel} placeholder="(provider default)" cursor={bCursor} focused={f===17} textActive={f===17} />
            <TRow idx={18} label="task template" value={bWTask} placeholder="may use {{root_task}}" cursor={bCursor} focused={f===18} textActive={f===18} />
          </>
        )}
        <Box marginTop={1}>
          <Text color={lc(f===19)} bold={f===19}>{marker(f===19)} [ LAUNCH TREE ]</Text>
        </Box>
        <Box>
          <Text color={lc(f===20)} bold={f===20}>{marker(f===20)} [ SAVE PRESET ]</Text>
        </Box>
        {error && <Box marginTop={1}><Text color="red">{error}</Text></Box>}
      </Box>
    </ScreenLayout>
  )
}
