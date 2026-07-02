import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { SearchIcon } from '../../components/icons'
import { HISN } from './data'

const STR = {
  en: {
    search: 'Search chapters…',
    back: 'All chapters',
    count: (n: number) => `${n} chapters`,
    empty: 'No chapter matches that.',
    entries: (n: number) => `${n} ${n === 1 ? 'supplication' : 'supplications'}`,
    attribution: 'From Ḥiṣn al-Muslim, compiled by Saʿīd b. Wahf al-Qaḥṭānī.',
    note: 'The adhkār are the Qur’ān/Sunnah text (Arabic). Grouped for reading; verify references before relying on them.',
  },
  ar: {
    search: 'ابحث في الأبواب…',
    back: 'كل الأبواب',
    count: (n: number) => `${n} بابًا`,
    empty: 'لا يوجد باب مطابق.',
    entries: (n: number) => `${n} ${n === 1 ? 'ذِكر' : 'أذكار'}`,
    attribution: 'من «حصن المسلم» — جمع سعيد بن وهف القحطاني.',
    note: 'الأذكار من نصوص القرآن والسنة. جُمعت للقراءة؛ تحقّق من التخريج قبل الاعتماد.',
  },
}

export default function HisnAlMuslimTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [query, setQuery] = useState('')
  const [selId, setSelId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    // Strip Arabic diacritics (tashkīl) so a plain query matches vocalized titles.
    const strip = (t: string) => t.replace(/[ً-ْٰـ]/g, '')
    const q = strip(query.trim())
    if (!q) return HISN
    return HISN.filter((c) => strip(c.title).includes(q))
  }, [query])

  const selected = useMemo(() => HISN.find((c) => c.id === selId) || null, [selId])

  if (selected) {
    return (
      <div className="flex flex-col gap-4 max-w-[46rem] mx-auto" data-testid="hisn">
        <button className="pill self-start" data-testid="hisn-back" onClick={() => setSelId(null)}>‹ {s.back}</button>
        <h2 dir="rtl" lang="ar" className="font-ar text-[1.5rem] font-bold text-green-700 text-center leading-snug">{selected.title}</h2>
        <ol className="flex flex-col gap-3">
          {selected.entries.map((e, i) => (
            <li key={i} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4 flex gap-3">
              <span className="flex-none font-mono text-[0.75rem] text-ink-faint mt-1">{i + 1}</span>
              <p dir="rtl" lang="ar" className="font-ar text-[1.35rem] leading-[2.05] text-ink">{e}</p>
            </li>
          ))}
        </ol>
        <p className="text-[0.78rem] text-ink-faint">{s.attribution} {s.note}</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4 max-w-[46rem] mx-auto" data-testid="hisn">
      <div className="tool-search relative flex items-center gap-[0.6rem] py-[0.15rem] px-[0.9rem] bg-[var(--surface)] border border-[color:var(--line)] rounded-full shadow-[var(--shadow-sm)] focus-within:border-green-500">
        <SearchIcon className="w-5 h-5 text-ink-faint flex-none" />
        <input
          type="search" dir="auto" data-testid="hisn-search"
          className="flex-1 border-none bg-transparent outline-none font-body text-[1rem] text-ink py-[0.6rem] placeholder:text-ink-faint"
          placeholder={s.search} value={query} onChange={(e) => setQuery(e.target.value)} aria-label={s.search}
        />
      </div>
      <p className="text-[0.82rem] text-ink-faint">{s.count(filtered.length)}</p>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-ink-soft">{s.empty}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <button
                onClick={() => { setSelId(c.id); window.scrollTo(0, 0) }}
                data-testid={`hisn-ch-${c.id}`}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] hover:border-green-500 transition-[border-color] duration-150 text-start"
              >
                <span dir="rtl" lang="ar" className="font-ar text-[1.05rem] text-ink">{c.title}</span>
                <span className="flex-none text-[0.75rem] text-ink-faint tabular-nums">{c.entries.length}</span>
              </button>
            </li>
          ))}
        </ol>
      )}
      <p className="text-[0.78rem] text-ink-faint">{s.attribution}</p>
    </div>
  )
}
