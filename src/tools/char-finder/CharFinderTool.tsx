import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { SearchIcon, CopyIcon } from '../../components/icons'
import { GROUPS, search, describeChar, type CharGroup } from './chars'

const STR = {
  en: {
    search: 'Search', placeholder: 'arrow, heart, dagger alef, ﷺ…',
    inspect: 'Inspect', inspectPh: 'Paste any character or text…',
    copy: 'Copy', copied: 'Copied!',
    results: (n: number) => `${n} character${n === 1 ? '' : 's'}`,
    none: 'Nothing matched. Try an English keyword — the names are the official Unicode ones.',
    codepoint: 'Code point', name: 'Name', html: 'HTML', css: 'CSS', js: 'JS', utf8: 'UTF-8 bytes',
    chars: 'Characters', inspectHint: 'Paste anything to see what each character actually is — useful when a document has a lookalike letter in it and nothing looks wrong.',
    hint: 'Find the character you need without hunting through a character map — arrows, maths, currency, Arabic marks, punctuation and the religious symbols that are hard to type.',
  },
  ar: {
    search: 'بحث', placeholder: 'سهم، قلب، ألف خنجرية، ﷺ…',
    inspect: 'فحص', inspectPh: 'الصق أي محرف أو نص…',
    copy: 'نسخ', copied: 'تم النسخ!',
    results: (n: number) => `${n.toLocaleString('ar')} محرفًا`,
    none: 'لا نتائج. جرّب كلمة إنجليزية — فالأسماء هي أسماء يونيكود الرسمية.',
    codepoint: 'النقطة الرمزية', name: 'الاسم', html: 'HTML', css: 'CSS', js: 'JS', utf8: 'بايتات UTF-8',
    chars: 'المحارف', inspectHint: 'الصق أي شيء لترى حقيقة كل محرف — مفيد حين يحوي مستند حرفًا شبيهًا ولا يبدو شيء خاطئًا.',
    hint: 'اعثر على المحرف الذي تريده دون التنقيب في خريطة المحارف — الأسهم والرياضيات والعملات والعلامات العربية وعلامات الترقيم والرموز الدينية التي يصعب كتابتها.',
  },
}

export default function CharFinderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [mode, setMode] = useState<'search' | 'inspect'>('search')
  const [query, setQuery] = useState('')
  const [paste, setPaste] = useState('')
  const [group, setGroup] = useState<CharGroup | 'all'>('all')
  const [copied, setCopied] = useState('')

  const results = useMemo(() => search(query, group), [query, group])
  const inspected = useMemo(() => [...paste].map((ch) => describeChar(ch)), [paste])

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1200) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="char-finder">
      <Seg>
        <SegButton active={mode === 'search'} data-testid="cf-mode-search" onClick={() => setMode('search')}>{s.search}</SegButton>
        <SegButton active={mode === 'inspect'} data-testid="cf-mode-inspect" onClick={() => setMode('inspect')}>{s.inspect}</SegButton>
      </Seg>

      {mode === 'search' ? (
        <>
          <Input dir="auto" className="text-[1.05rem]" data-testid="cf-query"
            placeholder={s.placeholder} value={query} onChange={(e) => setQuery(e.target.value)} />

          <div className="flex flex-wrap gap-1">
            {(['all', ...GROUPS] as const).map((g) => (
              <button key={g} data-testid={`cf-group-${g}`} onClick={() => setGroup(g as CharGroup | 'all')}
                className={`px-2 py-1 text-[0.8rem] rounded-sm border ${group === g ? 'border-green-600 bg-green-600 text-sand-100' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                {g}
              </button>
            ))}
          </div>

          {results.length === 0 ? (
            <p className="text-[0.95rem] text-ink-faint rtl:font-ar" data-testid="cf-none">{query ? s.none : s.hint}</p>
          ) : (
            <>
              <span className="text-[0.9rem] text-ink-faint" data-testid="cf-count">{s.results(results.length)}</span>
              <div className="grid gap-2 grid-cols-2 min-[560px]:grid-cols-4 min-[900px]:grid-cols-6" data-testid="cf-results">
                {results.map((c) => (
                  <button key={c.char} data-testid={`cf-char-${c.code}`} onClick={() => copy(c.char)}
                    className="flex flex-col items-center gap-1 border border-[color:var(--line)] rounded-md bg-[var(--surface)] p-2 hover:border-green-600">
                    <span className="text-[1.7rem] leading-none text-ink">{c.char}</span>
                    <span className="font-mono text-[0.65rem] text-ink-faint">{copied === c.char ? s.copied : `U+${c.code.toString(16).toUpperCase().padStart(4, '0')}`}</span>
                    <span className="text-[0.68rem] text-ink-faint text-center leading-tight line-clamp-2">{c.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <>
          <Input dir="auto" className="text-[1.05rem]" data-testid="cf-paste"
            placeholder={s.inspectPh} value={paste} onChange={(e) => setPaste(e.target.value)} />
          {inspected.length === 0 ? (
            <p className="text-[0.95rem] text-ink-faint rtl:font-ar">{s.inspectHint}</p>
          ) : (
            <div className="flex flex-col divide-y divide-[color:var(--line)] border border-[color:var(--line)] rounded-md overflow-hidden" data-testid="cf-inspected">
              {inspected.map((c, i) => (
                <div key={i} className="flex flex-wrap items-center gap-3 px-3 py-2 bg-[var(--surface)]">
                  <span className="text-[1.4rem] leading-none text-ink w-8 text-center">{c.printable ? c.char : '␣'}</span>
                  <span className="font-mono text-[0.85rem] text-ink w-24">U+{c.code.toString(16).toUpperCase().padStart(4, '0')}</span>
                  <span className="text-[0.85rem] text-ink-soft flex-1 min-w-[8rem]">{c.name}</span>
                  <span className="font-mono text-[0.75rem] text-ink-faint">{c.utf8}</span>
                  <Button className="px-2 py-1" onClick={() => copy(`\\u{${c.code.toString(16).toUpperCase()}}`)} aria-label={s.copy}>
                    <CopyIcon />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {mode === 'search' && results.length > 0 && (
        <Panel className="flex flex-col gap-1 text-[0.85rem]">
          <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{results[0].name}</span>
          <div className="flex flex-wrap gap-x-6 gap-y-1 font-mono text-ink-soft">
            <span>{s.html} <b className="text-ink">&amp;#{results[0].code};</b></span>
            <span>{s.css} <b className="text-ink">\{results[0].code.toString(16).toUpperCase()}</b></span>
            <span>{s.js} <b className="text-ink">{'\\u{' + results[0].code.toString(16).toUpperCase() + '}'}</b></span>
          </div>
        </Panel>
      )}

      <p className="text-[0.85rem] text-ink-faint rtl:font-ar flex items-center gap-2">
        <SearchIcon className="flex-none" /> {s.hint}
      </p>
    </Stack>
  )
}
