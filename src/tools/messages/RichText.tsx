// Renders message tokens (format.ts) as React text nodes — never as HTML.
import { Fragment } from 'react'
import { parseMessage, type Tok } from './format'

export function RichText({ text, names, highlight }: { text: string; names?: Map<string, string>; highlight?: string }) {
  return <>{render(parseMessage(text, names), highlight)}</>
}

function mark(v: string, q?: string) {
  if (!q) return v
  const i = v.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return v
  return <>{v.slice(0, i)}<mark className="bg-[color-mix(in_srgb,var(--gold-400)_55%,transparent)] text-inherit rounded-sm">{v.slice(i, i + q.length)}</mark>{v.slice(i + q.length)}</>
}

function render(toks: Tok[], q?: string) {
  return toks.map((t, i) => {
    switch (t.t) {
      case 'text': return <Fragment key={i}>{mark(t.v, q)}</Fragment>
      case 'br': return <br key={i} />
      case 'b': return <strong key={i}>{render(t.kids, q)}</strong>
      case 'i': return <em key={i}>{render(t.kids, q)}</em>
      case 's': return <s key={i}>{render(t.kids, q)}</s>
      case 'code': return <code key={i} className="font-mono text-[0.86em] px-1 rounded-sm bg-[color-mix(in_srgb,currentColor_12%,transparent)]">{t.v}</code>
      case 'pre': return <pre key={i} dir="ltr" className="font-mono text-[0.82em] my-1 p-2 rounded-sm bg-[color-mix(in_srgb,currentColor_10%,transparent)] overflow-x-auto whitespace-pre">{t.v}</pre>
      case 'link': return <a key={i} href={t.href} target="_blank" rel="noopener noreferrer nofollow" className="underline break-all text-inherit" dir="ltr">{t.v}</a>
      case 'mention': return <span key={i} data-testid="mention" className="font-semibold text-[var(--gold-500)]">{t.v}</span>
    }
    return null
  })
}
