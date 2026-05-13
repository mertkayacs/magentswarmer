// Validates a tmux window name. Empty = auto-generate (always valid).
// Only alphanumeric, dash, underscore allowed (max 30 chars).
// Invariant: returns null on valid input, error string on invalid.

export function validateName(name: string): string | null {
  if (!name) return null
  if (name.length > 30) return 'max 30 chars'
  if (!/^[A-Za-z0-9_-]*$/.test(name)) return 'alphanumeric, dash, underscore only'
  return null
}
