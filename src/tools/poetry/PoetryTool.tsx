import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon } from '../../components/icons'
import { BUHUR } from './data'

const STR = {
  en: {
    meters: 'The metres', format: 'Format verses',
    metersLede: 'The sixteen classical Arabic metres (buḥūr) of al-Khalīl, each with its tafʿīlāt and, where famous, an example bayt.',
    tafila: 'Feet', example: 'Example',
    formatLede: 'Paste poetry and it lays each bayt out in the traditional two-hemistich form. Put each hemistich on its own line, or separate the two with … / *** / a tab.',
    placeholder: 'Paste your verses here…',
    copy: 'Copy', copied: 'Copied!', empty: 'Paste some verses to format them.',
  },
  ar: {
    meters: 'البحور', format: 'تنسيق الأبيات',
    metersLede: 'بحور الشعر العربي الستة عشر عند الخليل بن أحمد، كلٌّ بتفعيلاته وبمثالٍ من الشعر حيث اشتُهر.',
    tafila: 'التفعيلات', example: 'مثال',
    formatLede: 'الصق الشعر فيُنسَّق كل بيتٍ في صورته العمودية (صدر وعجز). اجعل كل شطرٍ في سطر، أو افصل بين الشطرين بـ … أو *** أو مسافة كبيرة.',
    placeholder: 'الصق الأبيات هنا…',
    copy: 'نسخ', copied: 'تم النسخ!', empty: 'الصق أبياتًا لتنسيقها.',
  },
}

const SEP = /\s*(?:\.{3,}|…|\*{2,}|\t|\s{3,})\s*/

function parseAbyat(text: string): { sadr: string; ajz: string }[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return []
  if (lines.every((l) => SEP.test(l))) {
    return lines.map((l) => { const p = l.split(SEP).filter(Boolean); return { sadr: p[0] || '', ajz: p.slice(1).join(' ') } })
  }
  const out: { sadr: string; ajz: string }[] = []
  for (let i = 0; i < lines.length; i += 2) out.push({ sadr: lines[i], ajz: lines[i + 1] || '' })
  return out
}

function Bayt({ sadr, ajz }: { sadr: string; ajz: string }) {
  return (
    <div dir="rtl" className="grid grid-cols-2 gap-4 sm:gap-10 font-ar text-center text-[1.15rem] sm:text-[1.35rem] leading-[2.1] text-ink">
      <span className="min-w-0 break-words">{sadr}</span>
      <span className="min-w-0 break-words">{ajz}</span>
    </div>
  )
}

export default function PoetryTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [tab, setTab] = useState<'meters' | 'format'>('meters')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const abyat = useMemo(() => parseAbyat(text), [text])

  async function copy() {
    const out = abyat.map((b) => (b.ajz ? `${b.sadr} … ${b.ajz}` : b.sadr)).join('\n')
    if (!out) return
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <div className="stack" data-testid="poetry">
      <div className="seg self-start" role="group">
        {(['meters', 'format'] as const).map((tb) => (
          <button key={tb} className={`seg__btn ${tab === tb ? 'is-active' : ''}`} aria-pressed={tab === tb}
            data-testid={`poetry-tab-${tb}`} onClick={() => setTab(tb)}>{s[tb]}</button>
        ))}
      </div>

      {tab === 'meters' ? (
        <div className="flex flex-col gap-3">
          <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.metersLede}</p>
          {BUHUR.map((b) => (
            <div key={b.id} className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4 flex flex-col gap-2" data-testid={`bahr-${b.id}`}>
              <h3 dir="rtl" className="font-ar text-[1.3rem] font-bold text-green-700">{b.name}</h3>
              <p dir="rtl" className="font-ar text-[1.05rem] text-ink-soft tracking-wide"><span className="text-[0.72rem] text-ink-faint uppercase tracking-[0.06em] block mb-1 font-body">{s.tafila}</span>{b.tafila}</p>
              {b.example && (
                <div className="mt-1 pt-3 border-t border-[color:var(--line-soft)]">
                  <Bayt sadr={b.example.sadr} ajz={b.example.ajz} />
                  <p dir="rtl" className="font-ar text-[0.85rem] text-ink-faint text-center mt-2">— {b.example.poet}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[0.95rem] text-ink-soft leading-relaxed">{s.formatLede}</p>
          <textarea className="input input--area font-ar text-[1.1rem] min-h-[8rem]" dir="rtl" data-testid="poetry-input"
            placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
          {abyat.length ? (
            <>
              <div className="border border-[color:var(--line-soft)] rounded-md bg-[var(--surface)] p-4 sm:p-6 flex flex-col gap-4" data-testid="poetry-output">
                {abyat.map((b, i) => <Bayt key={i} sadr={b.sadr} ajz={b.ajz} />)}
              </div>
              <button className="btn self-start" onClick={copy}><CopyIcon /> {copied ? s.copied : s.copy}</button>
            </>
          ) : (
            <p className="text-ink-faint text-[0.95rem]">{s.empty}</p>
          )}
        </div>
      )}
    </div>
  )
}
