// Rotating multilingual goodbye shown on clean exit.
// Selection rotates by day-of-week + hour slot, not random, for variety across sessions.
// Invariant: GOODBYE_MESSAGES.length === 30; pickGoodbye() always returns a non-empty string.

export const GOODBYE_MESSAGES: string[] = [
  'goodbye',            // english
  'görüşürüz',         // turkish
  'au revoir',          // french
  'auf Wiedersehen',    // german
  'adiós',              // spanish
  'さようなら',          // japanese
  '再见',               // chinese (simplified)
  'مع السلامة',         // arabic
  'até logo',           // portuguese
  'arrivederci',        // italian
  'до свидания',        // russian
  '안녕히 가세요',       // korean
  'अलविदा',            // hindi
  'tot ziens',          // dutch
  'do widzenia',        // polish
  'hej då',             // swedish
  'ha det bra',         // norwegian
  'farvel',             // danish
  'näkemiin',           // finnish
  'αντίο',              // greek
  'na shledanou',       // czech
  'viszlát',            // hungarian
  'la revedere',        // romanian
  'довиждане',          // bulgarian
  'doviđenja',          // croatian
  'dovidenia',          // slovak
  'nasvidenje',         // slovenian
  'head aega',          // estonian
  'uz redzēšanos',      // latvian
  'iki pasimatymo',     // lithuanian
]

export function pickGoodbye(): string {
  const d = new Date()
  const idx = (d.getDay() * 4 + (d.getHours() % 4)) % GOODBYE_MESSAGES.length
  return GOODBYE_MESSAGES[idx] ?? 'goodbye'
}
