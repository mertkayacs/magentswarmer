// ANSI Shadow ASCII art for "REEVES" and "AGENTS" with per-column blue gradient.
// No runtime figlet calls; art is committed verbatim. Single source of brand truth.

export const REEVES_ART = `\
██████╗ ███████╗███████╗██╗   ██╗███████╗███████╗
██╔══██╗██╔════╝██╔════╝██║   ██║██╔════╝██╔════╝
██████╔╝█████╗  █████╗  ██║   ██║█████╗  ███████╗
██╔══██╗██╔══╝  ██╔══╝  ╚██╗ ██╔╝██╔══╝  ╚════██║
██║  ██║███████╗███████╗ ╚████╔╝ ███████╗███████║
╚═╝  ╚═╝╚══════╝╚══════╝  ╚═══╝  ╚══════╝╚══════╝`

export const AGENTS_ART = `\
 █████╗  ██████╗ ███████╗███╗   ██╗████████╗███████╗
██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝██╔════╝
███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ███████╗
██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ╚════██║
██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ███████║
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚══════╝`

export const BANNER_ART = REEVES_ART + '\n' + AGENTS_ART

export const BANNER_WIDTH = Math.max(...BANNER_ART.split('\n').map(l => l.length))
export const BANNER_HEIGHT = BANNER_ART.split('\n').length

// Blue gradient stops: deep blue to pale blue highlight
export const GRADIENT_STOPS: readonly string[] = [
  '#3a7ad8',
  '#5a96e0',
  '#7eb8f5',
  '#a5cdf7',
]

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

export function gradientColor(stops: readonly string[], t: number): string {
  if (stops.length === 0) return '#ffffff'
  if (t <= 0) return stops[0] ?? '#ffffff'
  if (t >= 1) return stops[stops.length - 1] ?? '#ffffff'
  const nSeg = stops.length - 1
  const pos = t * nSeg
  const idx = Math.floor(pos)
  const local = pos - idx
  const a = hexToRgb(stops[idx] ?? '#ffffff')
  const b = hexToRgb(stops[idx + 1] ?? '#ffffff')
  return rgbToHex([
    Math.round(a[0] + (b[0] - a[0]) * local),
    Math.round(a[1] + (b[1] - a[1]) * local),
    Math.round(a[2] + (b[2] - a[2]) * local),
  ])
}

// Returns array of { char, color } for each character in the art
export interface ColoredChar {
  char: string
  color: string
}

export function gradientChars(
  art: string = BANNER_ART,
  stops: readonly string[] = GRADIENT_STOPS,
): ColoredChar[][] {
  const lines = art.split('\n')
  const width = Math.max(...lines.map(l => l.length), 1)
  return lines.map(line =>
    Array.from(line).map((char, i) => ({
      char,
      color: gradientColor(stops, i / Math.max(width - 1, 1)),
    })),
  )
}
