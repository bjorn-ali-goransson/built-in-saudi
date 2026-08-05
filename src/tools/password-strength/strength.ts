// Password strength without a 400KB dictionary dependency. Raw entropy from the
// character set is the number people expect, but it lies badly: "Password123!"
// scores 78 bits and is cracked instantly. So the estimate starts from entropy
// and then applies penalties for the patterns that make a password guessable —
// which is what an attacker's wordlist rules actually do.

export interface Finding { key: string; penalty: number }

export interface Result {
  entropy: number       // effective bits, after penalties
  rawEntropy: number    // naive character-set bits
  score: 0 | 1 | 2 | 3 | 4
  findings: Finding[]
  crackSeconds: number
  poolSize: number
}

// The 60 or so passwords that dominate every breach dump. A full list belongs in
// a service like Have I Been Pwned (which needs a network call we deliberately
// don't make); this catches the ones that matter most, offline.
const COMMON = [
  'password', 'passw0rd', '123456', '12345678', '123456789', '1234567890', 'qwerty',
  'qwertyuiop', 'abc123', 'monkey', 'letmein', 'dragon', 'baseball', 'football',
  'iloveyou', 'trustno1', 'sunshine', 'master', 'welcome', 'shadow', 'ashley',
  'michael', 'superman', 'batman', 'admin', 'login', 'princess', 'starwars',
  'whatever', 'freedom', 'ninja', 'azerty', 'solo', 'access', 'flower', 'hello',
  'charlie', 'donald', 'jordan', 'harley', 'hunter', 'ranger', 'buster', 'thomas',
  'robert', 'soccer', 'killer', 'george', 'sexy', 'andrew', 'tigger', 'pepper',
  'saudi', 'riyadh', 'jeddah', 'makkah', 'mohammed', 'ahmed', 'salam',
]

const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890']

function poolSize(pw: string): number {
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26
  if (/[A-Z]/.test(pw)) pool += 26
  if (/[0-9]/.test(pw)) pool += 10
  if (/[^A-Za-z0-9]/.test(pw)) pool += 33
  if (/[؀-ۿ]/.test(pw)) pool += 50 // Arabic letters in practical use
  return pool || 1
}

/** Leet-speak folded back, so P@ssw0rd is recognised as "password". */
function unleet(s: string): string {
  return s.toLowerCase()
    .replace(/[@4]/g, 'a').replace(/[3]/g, 'e').replace(/[1!|]/g, 'i')
    .replace(/[0]/g, 'o').replace(/[$5]/g, 's').replace(/[7]/g, 't')
}

function hasSequence(pw: string, min = 4): boolean {
  const s = pw.toLowerCase()
  for (let i = 0; i + min <= s.length; i++) {
    let asc = true, desc = true
    for (let j = 1; j < min; j++) {
      const d = s.charCodeAt(i + j) - s.charCodeAt(i + j - 1)
      if (d !== 1) asc = false
      if (d !== -1) desc = false
    }
    if (asc || desc) return true
  }
  return false
}

function hasKeyboardWalk(pw: string, min = 4): boolean {
  const s = pw.toLowerCase()
  for (const row of KEYBOARD_ROWS) {
    for (let i = 0; i + min <= row.length; i++) {
      const run = row.slice(i, i + min)
      if (s.includes(run) || s.includes([...run].reverse().join(''))) return true
    }
  }
  return false
}

function hasRepeat(pw: string): boolean {
  if (/(.)\1{2,}/.test(pw)) return true
  // A short unit repeated to fill length: "abcabcabc".
  for (let n = 2; n <= Math.floor(pw.length / 2); n++) {
    const unit = pw.slice(0, n)
    if (unit.repeat(Math.ceil(pw.length / n)).slice(0, pw.length) === pw) return true
  }
  return false
}

function hasYear(pw: string): boolean {
  return /(19|20)\d{2}/.test(pw)
}

/** Guesses per second an offline attacker with commodity GPUs manages against a
 *  fast hash. Deliberately pessimistic — the honest assumption is that the site
 *  storing your password did not use a slow one. */
const GUESSES_PER_SECOND = 1e11

export function analyze(pw: string): Result {
  if (!pw) {
    return { entropy: 0, rawEntropy: 0, score: 0, findings: [], crackSeconds: 0, poolSize: 0 }
  }
  const pool = poolSize(pw)
  const rawEntropy = pw.length * Math.log2(pool)
  const findings: Finding[] = []
  const lower = unleet(pw)

  const common = COMMON.find((c) => lower.includes(c))
  if (common) findings.push({ key: lower === common ? 'isCommon' : 'containsCommon', penalty: lower === common ? 0.85 : 0.4 })
  if (hasSequence(pw)) findings.push({ key: 'sequence', penalty: 0.25 })
  if (hasKeyboardWalk(pw)) findings.push({ key: 'keyboard', penalty: 0.25 })
  if (hasRepeat(pw)) findings.push({ key: 'repeat', penalty: 0.35 })
  if (hasYear(pw)) findings.push({ key: 'year', penalty: 0.15 })
  if (pw.length < 8) findings.push({ key: 'short', penalty: 0.3 })
  if (/^[A-Z][a-z]+\d{1,4}[!@#$]?$/.test(pw)) findings.push({ key: 'shape', penalty: 0.3 })
  if (!/[^A-Za-z]/.test(pw) && pw.length < 16) findings.push({ key: 'lettersOnly', penalty: 0.2 })
  if (/^\d+$/.test(pw)) findings.push({ key: 'digitsOnly', penalty: 0.5 })

  // Penalties compound rather than sum, so three small ones can't drive the
  // estimate negative.
  let factor = 1
  for (const f of findings) factor *= 1 - f.penalty
  const entropy = Math.max(0, rawEntropy * factor)

  const crackSeconds = (2 ** entropy / 2) / GUESSES_PER_SECOND
  const score: Result['score'] =
    entropy < 28 ? 0 : entropy < 40 ? 1 : entropy < 56 ? 2 : entropy < 76 ? 3 : 4

  return { entropy, rawEntropy, score, findings, crackSeconds, poolSize: pool }
}

export function humanTime(seconds: number, locale: 'en' | 'ar'): string {
  const ar = locale === 'ar'
  if (seconds < 1) return ar ? 'فورًا' : 'instantly'
  // Each step: how many of this unit make the next one up.
  const steps: [number, string, string][] = [
    [60, 'seconds', 'ثانية'], [60, 'minutes', 'دقيقة'], [24, 'hours', 'ساعة'], [365, 'days', 'يوم'],
  ]
  let n = seconds
  for (const [div, en, arName] of steps) {
    if (n < div) {
      const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n)
      return ar ? `${v.toLocaleString('ar')} ${arName}` : `${v} ${en}`
    }
    n /= div
  }
  // n is now years.
  if (n >= 1e9) return ar ? 'أطول من عمر الكون' : 'longer than the universe has existed'
  if (n >= 1e6) return ar ? `${Math.round(n / 1e6).toLocaleString('ar')} مليون سنة` : `${Math.round(n / 1e6).toLocaleString('en')} million years`
  if (n >= 1e3) return ar ? `${Math.round(n / 1e3).toLocaleString('ar')} ألف سنة` : `${Math.round(n / 1e3).toLocaleString('en')} thousand years`
  const v = n < 10 ? Math.round(n * 10) / 10 : Math.round(n)
  return ar ? `${v.toLocaleString('ar')} سنة` : `${v} years`
}
