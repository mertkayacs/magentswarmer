// Reads NO_COLOR and TERM env to determine if colors are supported.
// Invariant: computed once at import time, safe to cache.
export const COLOR_ENABLED = !process.env.NO_COLOR && process.env.TERM !== 'dumb'
