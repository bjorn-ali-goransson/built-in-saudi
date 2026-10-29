// Message text formatting: the WhatsApp-style marks people already type —
// *bold*, _italic_, ~strike~, `code`, ```block``` — plus links and @mentions.
//
// It produces TOKENS, never HTML. The text came from somebody else's device; a
// renderer that turns it into markup is an injection waiting for the first
// message containing `<img onerror>`. React renders tokens as text nodes, and a
// link's href is only ever an http(s) URL this function built itself.

export type Tok =
  | { t: 'text'; v: string }
  | { t: 'b' | 'i' | 's'; kids: Tok[] }
  | { t: 'code'; v: string }
  | { t: 'pre'; v: string }
  | { t: 'link'; href: string; v: string }
  | { t: 'mention'; v: string; code?: string }
  | { t: 'br' }

const URL_RE = /\b((?:https?:\/\/|www\.)[^\s<>"']+[^\s<>"'.,;:!?)\]}»”’])/i
const MARKS: Record<string, 'b' | 'i' | 's'> = { '*': 'b', _: 'i', '~': 's' }

export function safeHref(u: string): string | null {
  const s = u.startsWith('www.') ? `https://${u}` : u
  try {
    const url = new URL(s)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null
  } catch { return null }
}

/** Parse message text. `names` maps a lowercased display name to a code, for @mentions. */
export function parseMessage(text: string, names: Map<string, string> = new Map()): Tok[] {
  const out: Tok[] = []
  // Fenced blocks first: nothing inside them is formatted.
  const parts = text.split(/```/)
  parts.forEach((p, i) => {
    if (i % 2 === 1 && i < parts.length - 1) { out.push({ t: 'pre', v: p.replace(/^\n/, '').replace(/\n$/, '') }); return }
    const chunk = i % 2 === 1 ? '```' + p : p
    const lines = chunk.split('\n')
    lines.forEach((line, li) => {
      if (li > 0) out.push({ t: 'br' })
      out.push(...inline(line, names))
    })
  })
  return merge(out)
}

function inline(s: string, names: Map<string, string>): Tok[] {
  const out: Tok[] = []
  let i = 0
  let buf = ''
  const flush = () => { if (buf) { out.push({ t: 'text', v: buf }); buf = '' } }
  while (i < s.length) {
    const ch = s[i]
    // Inline code: verbatim.
    if (ch === '`') {
      const e = s.indexOf('`', i + 1)
      if (e > i + 1) { flush(); out.push({ t: 'code', v: s.slice(i + 1, e) }); i = e + 1; continue }
    }
    // Links.
    if ((ch === 'h' || ch === 'H' || ch === 'w' || ch === 'W') && (i === 0 || /\W/.test(s[i - 1]))) {
      const m = URL_RE.exec(s.slice(i))
      if (m && m.index === 0) {
        const href = safeHref(m[1])
        if (href) { flush(); out.push({ t: 'link', href, v: m[1] }); i += m[1].length; continue }
      }
    }
    // Mentions: @ followed by a known name (longest match), or a bare word.
    if (ch === '@' && (i === 0 || /\s/.test(s[i - 1]))) {
      const rest = s.slice(i + 1)
      let best = ''
      for (const n of names.keys()) if (n && rest.toLowerCase().startsWith(n) && n.length > best.length && (rest.length === n.length || /[\s.,!?؟،]/.test(rest[n.length]))) best = n
      if (best) { flush(); out.push({ t: 'mention', v: '@' + rest.slice(0, best.length), code: names.get(best) }); i += 1 + best.length; continue }
    }
    // Emphasis: an opening mark at a word start with a matching close at a word end.
    const kind = MARKS[ch]
    if (kind && (i === 0 || /[\s([{"'«]/.test(s[i - 1])) && s[i + 1] && !/\s/.test(s[i + 1])) {
      let e = i + 1
      let found = -1
      while ((e = s.indexOf(ch, e)) > 0) {
        if (!/\s/.test(s[e - 1]) && (e + 1 >= s.length || /[\s.,!?;:)\]}"'»؟،]/.test(s[e + 1]))) { found = e; break }
        e++
      }
      if (found > i + 1) { flush(); out.push({ t: kind, kids: inline(s.slice(i + 1, found), names) }); i = found + 1; continue }
    }
    buf += ch
    i++
  }
  flush()
  return out
}

function merge(toks: Tok[]): Tok[] {
  const out: Tok[] = []
  for (const t of toks) {
    const last = out[out.length - 1]
    if (t.t === 'text' && last && last.t === 'text') last.v += t.v
    else out.push(t)
  }
  return out
}

/** Codes mentioned in a message, for notifications that fire even when a group is muted. */
export function mentionedCodes(text: string, names: Map<string, string>): string[] {
  const out = new Set<string>()
  const walk = (ts: Tok[]) => { for (const t of ts) { if (t.t === 'mention' && t.code) out.add(t.code); if ('kids' in t) walk(t.kids) } }
  walk(parseMessage(text, names))
  return [...out]
}

/** A message made only of 1–3 emoji is shown large, as every messenger does. */
export function isJumboEmoji(text: string): boolean {
  const s = text.trim()
  if (!s || s.length > 24) return false
  const seg = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? [...new (Intl as unknown as { Segmenter: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string }> } }).Segmenter(undefined, { granularity: 'grapheme' }).segment(s)].map((x) => x.segment).filter((g) => g.trim()) : [...s]
  return seg.length > 0 && seg.length <= 3 && seg.every((g) => /\p{Extended_Pictographic}/u.test(g))
}

/** First http(s) URL in a message — for a link card. */
export function firstLink(text: string): string | null {
  const m = URL_RE.exec(text)
  return m ? safeHref(m[1]) : null
}

/** Plain text of a message for quoting, search and notifications (marks removed). */
export function plain(text: string): string {
  const walk = (ts: Tok[]): string => ts.map((t) => (t.t === 'text' || t.t === 'code' || t.t === 'pre' || t.t === 'link' || t.t === 'mention' ? t.v : t.t === 'br' ? ' ' : walk(t.kids))).join('')
  return walk(parseMessage(text)).replace(/\s+/g, ' ').trim()
}
