// Reactive pane-count hook. Maps terminal width to 1, 2, or 3 panes.
// Breakpoints: <90 = 1, 90-139 = 2, >=140 = 3. Re-renders on SIGWINCH.

import { useWindowSize } from 'ink'
import type { Panes } from '../state/types.js'

export function usePanes(): Panes {
  const { columns } = useWindowSize()
  if (columns >= 140) return 3
  if (columns >= 90) return 2
  return 1
}
