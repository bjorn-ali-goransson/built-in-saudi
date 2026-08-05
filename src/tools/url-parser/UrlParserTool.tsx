import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Panel, CodeOut } from '../../components/ui'
import { CopyIcon, TrashIcon, LinkIcon } from '../../components/icons'

interface Param { key: string; value: string }

const TRACKERS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'utm_id',
  'gclid', 'fbclid', 'msclkid', 'mc_cid', 'mc_eid', 'igshid', 'ref_src', 'ref_url', '_ga', 'yclid', 'twclid']

const STR = {
  en: {
    url: 'URL', placeholder: 'https://example.com/path?a=1&b=two#section',
    invalid: 'That is not a URL your browser can parse. A scheme like https:// is required.',
    parts: 'Its parts',
    scheme: 'Scheme', host: 'Host', port: 'Port', path: 'Path', hash: 'Fragment', user: 'Credentials',
    params: 'Query parameters', add: 'Add a parameter', none: 'No query parameters.',
    key: 'name', value: 'value',
    rebuilt: 'Rebuilt URL', copy: 'Copy', copied: 'Copied!',
    stripTrackers: 'Remove tracking parameters',
    strippedN: (n: number) => `${n} tracking parameter${n === 1 ? '' : 's'} found — utm_*, gclid, fbclid and friends.`,
    decoded: 'Decoded value',
    punycode: 'This hostname contains non-ASCII characters. Browsers show it as ',
    hint: 'Pull a URL apart, edit its query string, and put it back together — without hand-counting ampersands or guessing at percent-encoding.',
  },
  ar: {
    url: 'الرابط', placeholder: 'https://example.com/path?a=1&b=two#section',
    invalid: 'ليس رابطًا يستطيع متصفحك تحليله. لا بد من بادئة مثل ‎https://‎.',
    parts: 'أجزاؤه',
    scheme: 'البروتوكول', host: 'المضيف', port: 'المنفذ', path: 'المسار', hash: 'الجزء', user: 'بيانات الدخول',
    params: 'معاملات الاستعلام', add: 'أضف معاملًا', none: 'لا توجد معاملات.',
    key: 'الاسم', value: 'القيمة',
    rebuilt: 'الرابط بعد البناء', copy: 'نسخ', copied: 'تم النسخ!',
    stripTrackers: 'أزل معاملات التتبّع',
    strippedN: (n: number) => `وُجد ${n.toLocaleString('ar')} معامل تتبّع — ‎utm_*‎ وgclid وfbclid وأمثالها.`,
    decoded: 'القيمة بعد فك الترميز',
    punycode: 'يحتوي اسم المضيف على محارف غير لاتينية. تعرضه المتصفحات كـ',
    hint: 'فكّك رابطًا وعدّل معاملاته ثم أعد بناءه — دون عدّ علامات & يدويًا أو التخمين في ترميز النسبة المئوية.',
  },
}

export default function UrlParserTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('https://example.com/products?id=42&utm_source=newsletter&q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6')
  const [overrides, setOverrides] = useState<Param[] | null>(null)
  const [copied, setCopied] = useState(false)

  const url = useMemo(() => {
    try { return new URL(raw.trim()) } catch { return null }
  }, [raw])

  // Params are read from the URL until the user edits them, after which their
  // edits win — otherwise typing in a value box would be undone on every keystroke.
  const params = useMemo<Param[]>(() => {
    if (overrides) return overrides
    if (!url) return []
    return [...url.searchParams.entries()].map(([key, value]) => ({ key, value }))
  }, [url, overrides])

  const trackerCount = params.filter((p) => TRACKERS.includes(p.key.toLowerCase())).length

  const rebuilt = useMemo(() => {
    if (!url) return ''
    const next = new URL(url.toString())
    next.search = ''
    for (const p of params) if (p.key) next.searchParams.append(p.key, p.value)
    return next.toString()
  }, [url, params])

  function edit(i: number, patch: Partial<Param>) {
    setOverrides(params.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }
  async function copy() {
    try { await navigator.clipboard.writeText(rebuilt); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const rows: [string, string][] = url ? [
    [s.scheme, url.protocol.replace(':', '')],
    [s.host, url.hostname],
    [s.port, url.port || '—'],
    [s.path, url.pathname],
    [s.hash, url.hash || '—'],
    ...(url.username ? [[s.user, `${url.username}${url.password ? ':•••' : ''}`] as [string, string]] : []),
  ] : []

  return (
    <Stack data-testid="url-parser">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.url}
        <Input dir="ltr" className="font-mono" data-testid="up-input" placeholder={s.placeholder}
          value={raw} onChange={(e) => { setRaw(e.target.value); setOverrides(null) }} />
      </label>

      {!url ? (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="up-invalid">{raw.trim() ? s.invalid : s.hint}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.parts}</h2>
            <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="up-parts">
              {rows.map(([label, value]) => (
                <div key={label} className="flex items-center gap-3 px-3 py-1.5 bg-[var(--surface)]">
                  <span className="text-[0.8rem] text-ink-faint w-24 rtl:font-ar">{label}</span>
                  <span className="font-mono text-[0.9rem] text-ink break-all">{value}</span>
                </div>
              ))}
            </div>
            {/[^\x00-\x7F]/.test(url.hostname) && (
              <p className="text-[0.85rem] text-gold-500" data-testid="up-punycode">
                {s.punycode}<code className="font-mono">{url.hostname}</code>
              </p>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.params}</h2>
              {trackerCount > 0 && (
                <Button className="px-3 py-1" data-testid="up-strip"
                  onClick={() => setOverrides(params.filter((p) => !TRACKERS.includes(p.key.toLowerCase())))}>
                  <TrashIcon /> {s.stripTrackers}
                </Button>
              )}
            </div>
            {trackerCount > 0 && <p className="text-[0.85rem] text-gold-500 rtl:font-ar" data-testid="up-trackers">{s.strippedN(trackerCount)}</p>}

            {params.length === 0 ? (
              <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="up-noparams">{s.none}</p>
            ) : (
              <div className="flex flex-col gap-2" data-testid="up-params">
                {params.map((p, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <Input dir="ltr" className="w-40 font-mono text-[0.85rem]" data-testid={`up-key-${i}`}
                      placeholder={s.key} value={p.key} onChange={(e) => edit(i, { key: e.target.value })} />
                    <Input dir="ltr" className="flex-1 min-w-[10rem] font-mono text-[0.85rem]" data-testid={`up-value-${i}`}
                      placeholder={s.value} value={p.value} onChange={(e) => edit(i, { value: e.target.value })} />
                    <Button className="px-2 py-1" aria-label="remove" data-testid={`up-del-${i}`}
                      onClick={() => setOverrides(params.filter((_, j) => j !== i))}><TrashIcon /></Button>
                  </div>
                ))}
              </div>
            )}
            <Button className="self-start px-3 py-1" data-testid="up-add"
              onClick={() => setOverrides([...params, { key: '', value: '' }])}>{s.add}</Button>
          </section>

          <Panel className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <LinkIcon className="text-ink-faint" />
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.rebuilt}</span>
              <Button className="px-3 py-1" onClick={copy} data-testid="up-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
            </div>
            <CodeOut data-testid="up-rebuilt">{rebuilt}</CodeOut>
          </Panel>
        </>
      )}
    </Stack>
  )
}
