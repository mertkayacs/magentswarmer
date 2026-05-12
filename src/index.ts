// Programmatic API: spawn, orchestrate, peek, doctor, registry, config.
// Inputs: function arguments. Outputs: typed return values.
// Invariant: all exports are pure functions or constants; no side effects on import.

export { ErrorBoundary } from './components/ErrorBoundary.js'

export { spawn } from './launcher/spawn.js'
export { orchestrate, fanOut } from './launcher/orchestrate.js'
export { peek } from './launcher/peek.js'
export { runDoctor, pruneOrphans } from './launcher/doctor.js'
export { detectAvailable, buildCommand, buildEnv, BIN } from './launcher/providers.js'

export {
  listAll as listSessions,
  read as readSession,
  write as writeSession,
  remove as removeSession,
  heartbeat,
  isStale,
  newId,
  registryDir,
} from './state/registry.js'

export {
  loadConfig,
  saveConfig,
  defaultConfig,
  configExists,
  configPath,
  getProvider,
} from './state/config.js'

export {
  loadState,
  saveState,
  defaultState,
} from './state/store.js'

export type {
  Provider,
  Auth,
  Permissions,
  Effort,
  ScreenName,
  Panes,
  ProviderConfig,
  Config,
  SpawnFormState,
  SharedFormState,
  WorkerEntry,
  OrchestrateFormState,
  Preset,
  AppState,
  Session,
  SpawnRequest,
  SpawnConfig,
  CheckResult,
  RouterContextValue,
} from './state/types.js'
