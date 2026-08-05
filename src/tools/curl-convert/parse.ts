// Parse a curl command the way a shell would, then re-emit it as code.
//
// "Copy as cURL" in devtools is how most people move a request between tools, so
// the input is almost always machine-generated and long: many -H flags, a JSON
// -d body, and shell line continuations. Getting the QUOTING right is the whole
// job — a naive split on spaces breaks the moment a header value contains one.

export interface Request {
  method: string
  url: string
  headers: [string, string][]
  body: string | null
  /** Cookies given via -b, kept separate so they can be emitted properly. */
  cookies: string | null
  insecure: boolean
  auth: string | null
}

/** Split a command line into argv, honouring quotes and backslash continuations. */
export function tokenize(input: string): string[] {
  const out: string[] = []
  let cur = ''
  let quote: '"' | "'" | null = null
  let started = false
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (ch === quote) { quote = null; continue }
      // Inside single quotes a backslash is literal, as in a real shell.
      if (ch === '\\' && quote === '"' && i + 1 < input.length) { cur += input[++i]; continue }
      cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; started = true; continue }
    if (ch === '\\' && (input[i + 1] === '\n' || input[i + 1] === '\r')) {
      // Line continuation: skip the backslash and the newline that follows.
      i++
      if (input[i] === '\r' && input[i + 1] === '\n') i++
      continue
    }
    if (ch === '^' && (input[i + 1] === '\n' || input[i + 1] === '\r')) { i++; continue } // cmd.exe style
    if (/\s/.test(ch)) {
      if (cur || started) { out.push(cur); cur = ''; started = false }
      continue
    }
    cur += ch
  }
  if (cur || started) out.push(cur)
  return out
}

/** A scheme, a dotted hostname, or localhost — anything else is a stray word. */
function looksLikeUrl(value: string): boolean {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return true
  if (/^localhost(:\d+)?(\/|$)/i.test(value)) return true
  return /^[\w-]+(\.[\w-]+)+(:\d+)?(\/|\?|$)/.test(value)
}

export function parseCurl(input: string): Request | null {
  const tokens = tokenize(input.trim())
  if (!tokens.length) return null
  // Tolerate a leading prompt character or a missing "curl".
  let i = 0
  while (i < tokens.length && (tokens[i] === '$' || tokens[i] === '>' || tokens[i] === 'curl')) i++
  if (i === 0 && tokens[0] !== 'curl') i = 0

  const req: Request = { method: '', url: '', headers: [], body: null, cookies: null, insecure: false, auth: null }
  const dataParts: string[] = []

  for (; i < tokens.length; i++) {
    const t = tokens[i]
    const next = () => tokens[++i] ?? ''
    if (t === '-X' || t === '--request') { req.method = next().toUpperCase(); continue }
    if (t === '-H' || t === '--header') {
      const raw = next()
      const idx = raw.indexOf(':')
      if (idx > 0) req.headers.push([raw.slice(0, idx).trim(), raw.slice(idx + 1).trim()])
      continue
    }
    if (t === '-d' || t === '--data' || t === '--data-raw' || t === '--data-binary' || t === '--data-ascii') {
      dataParts.push(next()); continue
    }
    if (t === '--data-urlencode') { dataParts.push(next()); continue }
    if (t === '-b' || t === '--cookie') { req.cookies = next(); continue }
    if (t === '-u' || t === '--user') { req.auth = next(); continue }
    if (t === '-k' || t === '--insecure') { req.insecure = true; continue }
    if (t === '-F' || t === '--form') { dataParts.push(next()); continue }
    if (t === '--url') { req.url = next(); continue }
    if (t === '-L' || t === '--location' || t === '-s' || t === '--silent'
      || t === '-i' || t === '--include' || t === '-v' || t === '--verbose'
      || t === '--compressed' || t === '-g') continue
    if (t.startsWith('-')) {
      // Unknown flag: skip it, and its value if the next token is not a flag.
      if (tokens[i + 1] && !tokens[i + 1].startsWith('-')) i++
      continue
    }
    if (!req.url) req.url = t
  }

  // A bare word is not a URL. Without this, "just some words" parses happily
  // into a request to `just` and the tool emits confident nonsense.
  if (!req.url || !looksLikeUrl(req.url)) return null
  req.body = dataParts.length ? dataParts.join('&') : null
  if (!req.method) req.method = req.body ? 'POST' : 'GET'
  return req
}

// ── Emitters ────────────────────────────────────────────────────────────────
export type Target = 'fetch' | 'axios' | 'python' | 'node' | 'httpie'

const q = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
const qd = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`

function headerObject(req: Request, indent: string, quoteFn: (s: string) => string): string {
  const all = [...req.headers]
  if (req.cookies) all.push(['Cookie', req.cookies])
  if (req.auth) all.push(['Authorization', `Basic ${btoaSafe(req.auth)}`])
  if (!all.length) return ''
  return all.map(([k, v]) => `${indent}${quoteFn(k)}: ${quoteFn(v)},`).join('\n')
}

function btoaSafe(s: string): string {
  try { return btoa(s) } catch { return s }
}

/** Pretty-print a JSON body when it really is JSON, so the output is readable. */
function bodyLiteral(body: string): { isJson: boolean; text: string } {
  try {
    const parsed = JSON.parse(body)
    if (parsed && typeof parsed === 'object') {
      return { isJson: true, text: JSON.stringify(parsed, null, 2) }
    }
  } catch { /* not JSON */ }
  return { isJson: false, text: body }
}

export function emit(req: Request, target: Target): string {
  const body = req.body ? bodyLiteral(req.body) : null

  if (target === 'fetch') {
    const lines = [`const res = await fetch(${q(req.url)}, {`, `  method: ${q(req.method)},`]
    const h = headerObject(req, '    ', q)
    if (h) lines.push('  headers: {', h, '  },')
    if (body) {
      lines.push(body.isJson
        ? `  body: JSON.stringify(${body.text.split('\n').join('\n  ')}),`
        : `  body: ${q(body.text)},`)
    }
    lines.push('})', 'const data = await res.json()')
    return lines.join('\n')
  }

  if (target === 'axios') {
    const lines = ['const res = await axios({', `  method: ${q(req.method.toLowerCase())},`, `  url: ${q(req.url)},`]
    const h = headerObject(req, '    ', q)
    if (h) lines.push('  headers: {', h, '  },')
    if (body) lines.push(body.isJson ? `  data: ${body.text.split('\n').join('\n  ')},` : `  data: ${q(body.text)},`)
    lines.push('})')
    return lines.join('\n')
  }

  if (target === 'python') {
    const lines = ['import requests', '']
    const all = [...req.headers]
    if (req.cookies) all.push(['Cookie', req.cookies])
    if (all.length) {
      lines.push('headers = {')
      lines.push(...all.map(([k, v]) => `    ${qd(k)}: ${qd(v)},`))
      lines.push('}', '')
    }
    if (body?.isJson) lines.push(`payload = ${body.text.replace(/\btrue\b/g, 'True').replace(/\bfalse\b/g, 'False').replace(/\bnull\b/g, 'None')}`, '')
    else if (body) lines.push(`payload = ${qd(body.text)}`, '')
    const args = [qd(req.url)]
    if (all.length) args.push('headers=headers')
    if (body) args.push(body.isJson ? 'json=payload' : 'data=payload')
    if (req.auth) args.push(`auth=(${req.auth.split(':').map(qd).join(', ')})`)
    if (req.insecure) args.push('verify=False')
    lines.push(`res = requests.${req.method.toLowerCase()}(${args.join(', ')})`, 'print(res.json())')
    return lines.join('\n')
  }

  if (target === 'node') {
    const lines = [`const res = await fetch(${q(req.url)}, {`, `  method: ${q(req.method)},`]
    const h = headerObject(req, '    ', q)
    if (h) lines.push('  headers: {', h, '  },')
    if (body) lines.push(body.isJson ? `  body: JSON.stringify(${body.text.split('\n').join('\n  ')}),` : `  body: ${q(body.text)},`)
    lines.push('})', 'if (!res.ok) throw new Error(`HTTP ${res.status}`)', 'const data = await res.json()')
    return lines.join('\n')
  }

  // httpie
  const parts = ['http', req.method, req.url]
  for (const [k, v] of req.headers) parts.push(`${k}:${qd(v)}`)
  if (req.auth) parts.push(`-a ${qd(req.auth)}`)
  if (body) parts.push(`<<< ${qd(body.text)}`)
  return parts.join(' ')
}

export const TARGETS: { id: Target; label: string }[] = [
  { id: 'fetch', label: 'fetch' },
  { id: 'node', label: 'Node' },
  { id: 'axios', label: 'axios' },
  { id: 'python', label: 'Python' },
  { id: 'httpie', label: 'HTTPie' },
]
