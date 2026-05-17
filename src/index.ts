// Programmatic API: spawn, peek, doctor, registry, MCP surface.
// Inputs: function arguments. Outputs: typed return values.
// Invariant: all exports are pure functions or constants; no side effects on import.

export { ErrorBoundary } from './components/ErrorBoundary.js'

export { spawn } from './launcher/spawn.js'
export { peek } from './launcher/peek.js'
export { jumpCommand, buildJumpCommandResult } from './launcher/jump.js'
export { runDoctor, pruneOrphans } from './launcher/doctor.js'
export { detectAvailable, buildCommand, BIN, PROVIDERS, isProvider } from './launcher/providers.js'

export {
  listAll as listSessions,
  read as readSession,
  computeStatus,
  nowIso,
  registryDir,
} from './state/registry.js'

export { loadConfig, saveConfig, defaultConfig } from './state/config.js'
export {
  loadLastSpawn, saveLastSpawn,
  listSavedTrees, loadSavedTree, saveSavedTree, deleteSavedTree,
} from './state/store.js'

export { startMcpServer } from './mcp.js'
export { registerAll, register, unregister, isRegistered } from './mcp-setup.js'

export type {
  Provider,
  Permissions,
  AuthMode,
  Effort,
  TaskStatus,
  SessionStatus,
  ScreenName,
  Panes,
  Config,
  GlobalConfig,
  SpawnFormState,
  OrchestrateFormState,
  Session,
  SpawnRequest,
  Message,
  TreeNode,
  CheckResult,
  RouterContextValue,
} from './state/types.js'
