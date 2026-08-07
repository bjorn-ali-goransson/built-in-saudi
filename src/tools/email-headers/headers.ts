// Reading raw email headers.
//
// Everything here is text parsing with no network, which matters: the online
// header analysers all want you to paste a message you have just been told is
// suspicious into somebody else's server. The headers of a phishing report
// routinely carry the recipient's address, internal hostnames and message ids.
//
// The three rules that make this more than a split on newlines:
//
// 1. **Headers fold.** A line starting with a space or tab continues the one
//    before it, so a long Received line arrives in four pieces.
// 2. **Received headers are PREPENDED.** Each hop adds its own at the top, so
//    the file is in reverse chronological order and the last one is the first
//    hop. Printing them top-down shows the journey backwards.
// 3. **Non-ASCII is encoded.** A subject in Arabic arrives as `=?UTF-8?B?…?=`
//    and has to be decoded, or the tool shows gibberish for exactly the
//    messages a reader most needs to understand.

export interface Header { name: string; value: string }

export interface Hop {
  index: number
  from: string
  by: string
  with: string
  date: Date | null
  /** Seconds spent between the previous hop and this one. */
  delay: number | null
  raw: string
}

export type Verdict = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'unknown'

export interface Auth { spf: Verdict; dkim: Verdict; dmarc: Verdict; raw: string }

export interface Analysis {
  headers: Header[]
  hops: Hop[]
  auth: Auth
  from: string
  to: string
  subject: string
  date: Date | null
  messageId: string
  replyTo: string
  returnPath: string
  /** Things worth a second look, not accusations. */
  flags: { key: string; detail: string }[]
  totalSeconds: number | null
}

/** Undo RFC 5322 folding: a line beginning with space or tab continues the last. */
export function unfold(raw: string): string[] {
  const out: string[] = []
  for (const line of raw.replace(/\r\n/g, '\n').split('\n')) {
    if (/^[ \t]/.test(line) && out.length) out[out.length - 1] += ' ' + line.trim()
    else if (line.trim()) out.push(line)
    else if (out.length) break // the blank line ends the header block; the body is not ours
  }
  return out
}

export function parseHeaders(raw: string): Header[] {
  return unfold(raw)
    .map((line) => {
      const i = line.indexOf(':')
      if (i < 0) return null
      return { name: line.slice(0, i).trim(), value: line.slice(i + 1).trim() }
    })
    .filter((h): h is Header => !!h)
}

/** RFC 2047 encoded-words: =?charset?B|Q?text?= */
export function decodeWords(s: string): string {
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]*)\?=/g, (_all, charset: string, enc: string, text: string) => {
    try {
      let bytes: Uint8Array
      if (enc.toUpperCase() === 'B') {
        const bin = atob(text.replace(/\s/g, ''))
        bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
      } else {
        // Q encoding: underscore is a space, =XX is a byte.
        const fixed = text.replace(/_/g, ' ')
        const out: number[] = []
        for (let i = 0; i < fixed.length; i++) {
          if (fixed[i] === '=' && /[0-9a-f]{2}/i.test(fixed.slice(i + 1, i + 3))) {
            out.push(parseInt(fixed.slice(i + 1, i + 3), 16)); i += 2
          } else out.push(fixed.charCodeAt(i))
        }
        bytes = Uint8Array.from(out)
      }
      return new TextDecoder(charset.toLowerCase().replace(/^"|"$/g, '')).decode(bytes)
    } catch { return _all }
  })
}

const verdictOf = (s: string, key: string): Verdict => {
  const m = new RegExp(`\\b${key}\\s*=\\s*(pass|fail|softfail|neutral|none|permerror|temperror)`, 'i').exec(s)
  if (!m) return 'unknown'
  const v = m[1].toLowerCase()
  // permerror/temperror are real SPF outcomes but not verdicts a reader can act
  // on, so they fold into "not stated" rather than being reported as a result.
  const known: Verdict[] = ['pass', 'fail', 'softfail', 'neutral', 'none']
  return known.includes(v as Verdict) ? (v as Verdict) : 'unknown'
}

function parseHop(value: string, index: number): Hop {
  const grab = (key: string) => {
    const m = new RegExp(`\\b${key}\\s+([^;]+?)(?=\\s+\\b(?:from|by|with|via|id|for)\\b|;|$)`, 'i').exec(value)
    return m ? m[1].trim() : ''
  }
  // The timestamp is what follows the last semicolon.
  const semi = value.lastIndexOf(';')
  const stamp = semi >= 0 ? value.slice(semi + 1).trim() : ''
  const parsed = stamp ? new Date(stamp) : null
  return {
    index,
    from: grab('from'),
    by: grab('by'),
    with: grab('with'),
    date: parsed && !isNaN(parsed.getTime()) ? parsed : null,
    delay: null,
    raw: value,
  }
}

const addressOf = (s: string) => {
  const m = /<([^>]+)>/.exec(s)
  return (m ? m[1] : s).trim().toLowerCase()
}
const domainOf = (s: string) => addressOf(s).split('@')[1] ?? ''

export function analyse(raw: string): Analysis {
  const headers = parseHeaders(raw)
  const get = (name: string) => headers.find((h) => h.name.toLowerCase() === name)?.value ?? ''
  const all = (name: string) => headers.filter((h) => h.name.toLowerCase() === name).map((h) => h.value)

  // Received headers are prepended by each hop, so the file reads newest-first.
  // Reversing puts the message's actual journey in order.
  const received = all('received').reverse()
  const hops = received.map((v, i) => parseHop(v, i + 1))
  for (let i = 1; i < hops.length; i++) {
    const a = hops[i - 1].date
    const b = hops[i].date
    hops[i].delay = a && b ? Math.max(0, Math.round((b.getTime() - a.getTime()) / 1000)) : null
  }

  const authRaw = [get('authentication-results'), get('received-spf'), get('arc-authentication-results')].filter(Boolean).join(' ; ')
  const auth: Auth = {
    spf: verdictOf(authRaw, 'spf'),
    dkim: verdictOf(authRaw, 'dkim'),
    dmarc: verdictOf(authRaw, 'dmarc'),
    raw: authRaw,
  }

  const from = decodeWords(get('from'))
  const replyTo = decodeWords(get('reply-to'))
  const returnPath = get('return-path')
  const dateHeader = get('date')
  const parsedDate = dateHeader ? new Date(dateHeader) : null

  const flags: { key: string; detail: string }[] = []
  if (auth.spf === 'fail' || auth.dkim === 'fail' || auth.dmarc === 'fail') {
    flags.push({ key: 'auth-fail', detail: [auth.spf === 'fail' && 'SPF', auth.dkim === 'fail' && 'DKIM', auth.dmarc === 'fail' && 'DMARC'].filter(Boolean).join(', ') })
  }
  if (replyTo && domainOf(replyTo) && domainOf(replyTo) !== domainOf(from)) {
    flags.push({ key: 'reply-to', detail: `${domainOf(from)} → ${domainOf(replyTo)}` })
  }
  if (returnPath && domainOf(returnPath) && domainOf(returnPath) !== domainOf(from)) {
    flags.push({ key: 'return-path', detail: `${domainOf(from)} → ${domainOf(returnPath)}` })
  }
  if (!received.length) flags.push({ key: 'no-received', detail: '' })

  const first = hops[0]?.date
  const last = hops[hops.length - 1]?.date
  return {
    headers,
    hops,
    auth,
    from,
    to: decodeWords(get('to')),
    subject: decodeWords(get('subject')),
    date: parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate : null,
    messageId: get('message-id'),
    replyTo,
    returnPath,
    flags,
    totalSeconds: first && last ? Math.max(0, Math.round((last.getTime() - first.getTime()) / 1000)) : null,
  }
}

export function humanDelay(sec: number | null): string {
  if (sec == null) return '—'
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}
