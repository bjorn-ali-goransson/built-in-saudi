// What a QR code actually says, and whether you should trust it.
//
// The reason to read a code before opening it is that the payload is invisible
// until you do — which is the whole point of a "quishing" sticker slapped over a
// real one on a parking meter or a restaurant table. So we surface the raw text,
// and flag the specific tricks that make a link look like somewhere it isn't.

export type Parsed =
  | { kind: 'url'; url: string; fields: [string, string][] }
  | { kind: 'wifi'; fields: [string, string][] }
  | { kind: 'contact'; fields: [string, string][] }
  | { kind: 'email'; fields: [string, string][] }
  | { kind: 'phone'; fields: [string, string][] }
  | { kind: 'sms'; fields: [string, string][] }
  | { kind: 'geo'; fields: [string, string][] }
  | { kind: 'text'; fields: [string, string][] }

/** Split "WIFI:S:name;T:WPA;P:pass;;" style payloads into key/value pairs. */
function splitStructured(body: string): Map<string, string> {
  const out = new Map<string, string>()
  // Escaped ; and : are legal inside values, so walk it rather than split().
  let key = '', val = '', inKey = true
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (c === '\\') { const n = body[++i]; if (n !== undefined) (inKey ? (key += n) : (val += n)); continue }
    if (c === ':' && inKey) { inKey = false; continue }
    if (c === ';') { if (key) out.set(key.toUpperCase(), val); key = ''; val = ''; inKey = true; continue }
    if (inKey) key += c; else val += c
  }
  if (key) out.set(key.toUpperCase(), val)
  return out
}

export function parsePayload(raw: string): Parsed {
  const t = raw.trim()

  if (/^https?:\/\//i.test(t)) {
    let fields: [string, string][] = []
    try {
      const u = new URL(t)
      fields = [['Host', u.host], ['Path', u.pathname + u.search || '/'], ['Scheme', u.protocol.replace(':', '')]]
    } catch { /* malformed but still http-ish — show it raw */ }
    return { kind: 'url', url: t, fields }
  }

  if (/^WIFI:/i.test(t)) {
    const m = splitStructured(t.slice(5))
    const auth = m.get('T') || ''
    return {
      kind: 'wifi',
      fields: [
        ['Network', m.get('S') || ''],
        ['Security', auth === 'nopass' || auth === '' ? 'Open (no password)' : auth],
        ['Password', m.get('P') || ''],
        ['Hidden', m.get('H') === 'true' ? 'Yes' : 'No'],
      ].filter(([, v]) => v !== '') as [string, string][],
    }
  }

  if (/^MATMSG:/i.test(t)) {
    const m = splitStructured(t.slice(7))
    return { kind: 'email', fields: [['To', m.get('TO') || ''], ['Subject', m.get('SUB') || ''], ['Body', m.get('BODY') || '']].filter(([, v]) => v) as [string, string][] }
  }
  if (/^mailto:/i.test(t)) return { kind: 'email', fields: [['To', t.slice(7).split('?')[0]]] }
  if (/^tel:/i.test(t)) return { kind: 'phone', fields: [['Number', t.slice(4)]] }
  if (/^smsto:/i.test(t)) { const [n, ...b] = t.slice(6).split(':'); return { kind: 'sms', fields: [['Number', n], ['Message', b.join(':')]].filter(([, v]) => v) as [string, string][] } }
  if (/^geo:/i.test(t)) { const [lat, lon] = t.slice(4).split(','); return { kind: 'geo', fields: [['Latitude', lat || ''], ['Longitude', (lon || '').split(';')[0]]] } }

  if (/^BEGIN:VCARD/i.test(t)) {
    const fields: [string, string][] = []
    for (const line of t.split(/\r?\n/)) {
      const m = line.match(/^(FN|N|ORG|TITLE|TEL|EMAIL|ADR|URL)[^:]*:(.*)$/i)
      if (m && m[2].trim()) fields.push([m[1].toUpperCase(), m[2].replace(/;+/g, ' ').trim()])
    }
    return { kind: 'contact', fields }
  }
  if (/^MECARD:/i.test(t)) {
    const m = splitStructured(t.slice(7))
    return { kind: 'contact', fields: [...m].filter(([, v]) => v) as [string, string][] }
  }

  return { kind: 'text', fields: [] }
}

export type Warning = 'punycode' | 'userinfo' | 'ip' | 'nonstandard-port' | 'insecure' | 'shortener' | 'confusable'

const SHORTENERS = new Set(['bit.ly', 't.co', 'tinyurl.com', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly', 'cutt.ly', 'rb.gy', 'lnkd.in', 'shorturl.at'])

/** Cheap, explainable checks — not a blocklist, just "look closer at this". */
export function warnings(raw: string): Warning[] {
  const out: Warning[] = []
  if (!/^https?:\/\//i.test(raw.trim())) return out
  let u: URL
  try { u = new URL(raw.trim()) } catch { return out }

  // "user@host" hides the real host behind text that reads like one.
  if (u.username || u.password) out.push('userinfo')
  // xn-- is legal, but it is also how a look-alike domain is spelled.
  if (u.hostname.split('.').some((p) => p.startsWith('xn--'))) out.push('punycode')
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(u.hostname) || u.hostname.startsWith('[')) out.push('ip')
  if (u.port && u.port !== '80' && u.port !== '443') out.push('nonstandard-port')
  if (u.protocol === 'http:') out.push('insecure')
  if (SHORTENERS.has(u.hostname.toLowerCase().replace(/^www\./, ''))) out.push('shortener')
  // Latin letters mixed with a script that has look-alike glyphs.
  if (/[a-z]/i.test(u.hostname) && /[Ѐ-ӿͰ-Ͽ]/.test(u.hostname)) out.push('confusable')
  return out
}
