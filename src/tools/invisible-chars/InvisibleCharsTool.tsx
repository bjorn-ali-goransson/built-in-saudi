import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Check, Panel } from '../../components/ui'
import { CopyIcon, SearchIcon } from '../../components/icons'
import { inspect, strip, DEFAULT_STRIP, CATEGORY_LABEL, hex, type StripOptions, type Category } from './detect'

const SAMPLE = 'Hello​there world‎ — paste‍me'

const STR = {
  en: {
    paste: 'Paste the text you suspect…',
    hint: 'Text copied from a web page, a PDF or a chatbot often carries characters you cannot see. They break exact matching, search and diffs in ways that look like a bug in your code rather than a problem with the string.',
    sample: 'Try it with a sample',
    clean: 'Nothing invisible in this text.',
    found: (n: number) => `${n} invisible character${n === 1 ? '' : 's'} found`,
    map: 'Where they are',
    remove: 'Remove', result: 'Cleaned text', copy: 'Copy', copied: 'Copied!',
    opts: {
      zeroWidth: 'Zero-width characters',
      bidi: 'Direction controls (RTL/LTR marks)',
      control: 'Control characters',
      lineSep: 'Line/paragraph separators → newline',
      normalizeSpaces: 'Unusual spaces → a normal space',
      variation: 'Variation selectors (changes how emoji render)',
    } as Record<keyof StripOptions, string>,
    note: 'Direction marks are not always junk — Arabic text mixed with Latin legitimately uses them to keep the order readable. Check the result before removing them from prose.',
    legend: 'Each marker below is one hidden character, in the position it occupies.',
  },
  ar: {
    paste: 'الصق النص المشبوه…',
    hint: 'النص المنسوخ من صفحة ويب أو ملف PDF أو روبوت محادثة يحمل غالبًا محارف لا تراها. وهي تُفسد المطابقة الدقيقة والبحث والمقارنة بطريقة تبدو كخلل في كودك لا كمشكلة في النص.',
    sample: 'جرّبها بمثال',
    clean: 'لا يوجد شيء خفي في هذا النص.',
    found: (n: number) => `وُجد ${n.toLocaleString('ar')} محرفًا خفيًا`,
    map: 'أين توجد',
    remove: 'أزل', result: 'النص بعد التنظيف', copy: 'نسخ', copied: 'تم النسخ!',
    opts: {
      zeroWidth: 'المحارف بعرض صفري',
      bidi: 'علامات الاتجاه (RTL/LTR)',
      control: 'محارف التحكّم',
      lineSep: 'فواصل السطر والفقرة ← سطر جديد',
      normalizeSpaces: 'المسافات غير العادية ← مسافة عادية',
      variation: 'محدّدات الشكل (تغيّر عرض الإيموجي)',
    } as Record<keyof StripOptions, string>,
    note: 'علامات الاتجاه ليست دائمًا زائدة — فالنص العربي المخلوط باللاتيني يستخدمها فعلًا ليبقى الترتيب مقروءًا. راجع الناتج قبل إزالتها من نص منثور.',
    legend: 'كل علامة أدناه محرف خفي واحد في موضعه.',
  },
}

const TONE: Record<Category, string> = {
  zeroWidth: 'bg-gold-500 text-white',
  bidi: 'bg-green-600 text-sand-100',
  space: 'bg-[color-mix(in_srgb,var(--color-ink)_18%,transparent)] text-ink',
  control: 'bg-gold-500 text-white',
  variation: 'bg-[color-mix(in_srgb,var(--color-green-400)_35%,transparent)] text-ink',
  lineSep: 'bg-[color-mix(in_srgb,var(--color-ink)_18%,transparent)] text-ink',
}

const KEYS: (keyof StripOptions)[] = ['zeroWidth', 'bidi', 'control', 'lineSep', 'normalizeSpaces', 'variation']

export default function InvisibleCharsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [o, setO] = useState<StripOptions>(DEFAULT_STRIP)
  const [copied, setCopied] = useState(false)

  const findings = useMemo(() => inspect(text), [text])
  const cleaned = useMemo(() => strip(text, o), [text, o])

  // Group by code so the summary is "3 × zero-width space", not three rows.
  const grouped = useMemo(() => {
    const m = new Map<number, { name: string; category: Category; count: number }>()
    for (const f of findings) {
      const cur = m.get(f.code)
      if (cur) cur.count++
      else m.set(f.code, { name: f.name, category: f.category, count: 1 })
    }
    return [...m.entries()].sort((a, b) => b[1].count - a[1].count)
  }, [findings])

  async function copy() {
    try { await navigator.clipboard.writeText(cleaned); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="invisible-chars">
      <Textarea className="min-h-[7rem]" dir="auto" data-testid="ic-input"
        placeholder={s.paste} value={text} onChange={(e) => setText(e.target.value)} />

      {!text && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => setText(SAMPLE)} data-testid="ic-sample">{s.sample}</Button>
        </div>
      )}

      {text && findings.length === 0 && (
        <p className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="ic-clean">{s.clean}</p>
      )}

      {findings.length > 0 && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <SearchIcon className="text-gold-500" />
            <span className="text-[0.95rem] font-semibold text-ink rtl:font-ar" data-testid="ic-count">{s.found(findings.length)}</span>
          </div>

          <ul className="flex flex-col gap-1" data-testid="ic-list">
            {grouped.map(([code, g]) => (
              <li key={code} className="flex items-center gap-3 text-[0.9rem]">
                <span className={`font-mono text-[0.72rem] px-[0.4rem] py-[0.1rem] rounded-sm ${TONE[g.category]}`}>{hex(code)}</span>
                <span className="text-ink flex-1">{g.name}</span>
                <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{CATEGORY_LABEL[g.category][locale]}</span>
                <span className="font-mono text-[0.85rem] text-ink-faint">× {g.count}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col gap-1">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.map}</span>
            <p className="text-[0.8rem] text-ink-faint rtl:font-ar">{s.legend}</p>
            <div className="font-mono text-[0.85rem] leading-relaxed break-all border border-[color:var(--line)] rounded-md bg-[var(--surface)] p-3" data-testid="ic-map" dir="ltr">
              {[...text].map((ch, i) => {
                const f = findings.find((x) => x.index === i)
                if (!f) return <span key={i}>{ch === '\n' ? '⏎\n' : ch}</span>
                return (
                  <span key={i} title={`${hex(f.code)} ${f.name}`}
                    className={`inline-block px-[0.25rem] mx-[0.05rem] rounded-sm text-[0.7rem] ${TONE[f.category]}`}>
                    {hex(f.code).replace('U+', '')}
                  </span>
                )
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.remove}</span>
            <div className="grid gap-x-5 gap-y-2 grid-cols-1 min-[640px]:grid-cols-2">
              {KEYS.map((k) => (
                <Check key={k}>
                  <input type="checkbox" checked={o[k]} data-testid={`ic-${k}`} onChange={() => setO({ ...o, [k]: !o[k] })} />
                  <span className="rtl:font-ar">{s.opts[k]}</span>
                </Check>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
            <Button className="px-3 py-1" onClick={copy} data-testid="ic-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly dir="auto" className="min-h-[6rem]" data-testid="ic-output" value={cleaned} onFocus={(e) => e.currentTarget.select()} />

          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.note}</p></Panel>
        </>
      )}
    </Stack>
  )
}
