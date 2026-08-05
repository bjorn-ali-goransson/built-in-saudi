// Find the things in a dataset that identify a person, so they can be masked
// before it is shared with a colleague, a vendor or an LLM.
//
// The order matters: an IBAN contains digits that also look like a phone
// number, so the longer, more specific patterns run first and later ones only
// see what is left.

export type Kind = 'email' | 'iban' | 'saudiId' | 'phone' | 'creditCard' | 'ip' | 'url' | 'name'

export interface Rule {
  kind: Kind
  re: RegExp
  en: string
  ar: string
}

export const RULES: Rule[] = [
  {
    kind: 'email', en: 'Email addresses', ar: 'عناوين البريد',
    re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
  },
  {
    kind: 'iban', en: 'IBANs', ar: 'أرقام الآيبان',
    re: /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g,
  },
  {
    kind: 'creditCard', en: 'Card numbers', ar: 'أرقام البطاقات',
    re: /\b(?:\d[ -]*?){13,19}\b/g,
  },
  {
    // Saudi national ID / iqama: 10 digits starting 1 (citizen) or 2 (resident).
    kind: 'saudiId', en: 'Saudi ID / iqama numbers', ar: 'أرقام الهوية والإقامة',
    re: /\b[12]\d{9}\b/g,
  },
  {
    kind: 'phone', en: 'Phone numbers', ar: 'أرقام الهاتف',
    re: /(?:\+|00)?\d[\d\s().-]{7,17}\d/g,
  },
  {
    kind: 'ip', en: 'IP addresses', ar: 'عناوين IP',
    re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  },
  {
    kind: 'url', en: 'Links', ar: 'الروابط',
    re: /https?:\/\/[^\s,;"']+/g,
  },
]

export type Mode = 'mask' | 'redact' | 'pseudonym'

export interface Options {
  enabled: Record<Kind, boolean>
  mode: Mode
  /** Keep the last few characters so rows stay distinguishable and joinable. */
  keepTail: boolean
}

export const DEFAULT_ENABLED: Record<Kind, boolean> = {
  email: true, iban: true, saudiId: true, phone: true,
  creditCard: true, ip: false, url: false, name: false,
}

/** Luhn, so a 16-digit order number is not mistaken for a card. */
function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, '')
  if (d.length < 13 || d.length > 19) return false
  let sum = 0
  let alt = false
  for (let i = d.length - 1; i >= 0; i--) {
    let n = Number(d[i])
    if (alt) { n *= 2; if (n > 9) n -= 9 }
    sum += n
    alt = !alt
  }
  return sum % 10 === 0
}

export interface Result {
  text: string
  counts: Record<Kind, number>
}

export function anonymize(input: string, o: Options): Result {
  const counts = Object.fromEntries(RULES.map((r) => [r.kind, 0])) as Record<Kind, number>
  // Stable pseudonyms: the same value always maps to the same placeholder, so a
  // dataset stays internally consistent and still joins on itself.
  const seen = new Map<string, string>()
  let text = input

  for (const rule of RULES) {
    if (!o.enabled[rule.kind]) continue
    text = text.replace(new RegExp(rule.re.source, rule.re.flags), (match) => {
      if (rule.kind === 'creditCard' && !luhnValid(match)) return match
      // A bare 10-digit Saudi ID would also match the phone rule; because IDs run
      // first, anything already replaced no longer looks like a phone number.
      if (rule.kind === 'phone' && match.replace(/\D/g, '').length < 8) return match
      counts[rule.kind]++
      if (o.mode === 'redact') return '[redacted]'
      if (o.mode === 'pseudonym') {
        const key = `${rule.kind}:${match}`
        if (!seen.has(key)) seen.set(key, `[${rule.kind}_${seen.size + 1}]`)
        return seen.get(key)!
      }
      // mask
      const tail = o.keepTail ? match.slice(-4) : ''
      if (rule.kind === 'email') {
        const [user, domain] = match.split('@')
        return `${user[0]}${'•'.repeat(Math.max(2, user.length - 1))}@${domain}`
      }
      return `${'•'.repeat(Math.max(3, match.length - tail.length))}${tail}`
    })
  }
  return { text, counts }
}

/** What is in the text, before anything is changed — the "found" summary. */
export function scan(input: string): Record<Kind, number> {
  const counts = Object.fromEntries(RULES.map((r) => [r.kind, 0])) as Record<Kind, number>
  let remaining = input
  for (const rule of RULES) {
    remaining = remaining.replace(new RegExp(rule.re.source, rule.re.flags), (match) => {
      if (rule.kind === 'creditCard' && !luhnValid(match)) return match
      if (rule.kind === 'phone' && match.replace(/\D/g, '').length < 8) return match
      counts[rule.kind]++
      return ' '.repeat(match.length)
    })
  }
  return counts
}
