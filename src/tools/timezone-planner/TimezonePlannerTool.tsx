import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Input, Select, Stack, Panel } from '../../components/ui'
import { TrashIcon } from '../../components/icons'
import { ZONES, rankSlots, offsetMinutes, type Quality } from './zones'

const STORE = 'bis-tz-zones'

const STR = {
  en: {
    add: 'Add a place', date: 'Date', anchor: 'Show hours in',
    best: 'Best times for everyone', noneGood: 'There is no hour that works for everyone — the spread is too wide. The rows below still show the least bad options.',
    grid: 'The whole day', remove: 'Remove',
    good: 'Working hours', edge: 'Early or late', bad: 'The middle of the night',
    yours: 'your device',
    offset: 'offset',
    hint: 'Pick the places your people are in, and see at a glance which hour is not the middle of the night for someone.',
    tooFew: 'Add at least two places.',
    dstNote: 'Offsets come from your browser’s own timezone data, so daylight saving on the chosen date is already accounted for — including places that change on a different weekend to yours.',
  },
  ar: {
    add: 'أضف مكانًا', date: 'التاريخ', anchor: 'اعرض الساعات بتوقيت',
    best: 'أفضل الأوقات للجميع', noneGood: 'لا توجد ساعة تناسب الجميع — الفارق واسع جدًا. وتعرض الصفوف أدناه أقل الخيارات سوءًا.',
    grid: 'اليوم كاملًا', remove: 'احذف',
    good: 'ساعات العمل', edge: 'مبكّر أو متأخّر', bad: 'منتصف الليل',
    yours: 'جهازك',
    offset: 'الفارق',
    hint: 'اختر أماكن فريقك، وشاهد بلمحة أي ساعة ليست منتصف الليل عند أحدهم.',
    tooFew: 'أضف مكانين على الأقل.',
    dstNote: 'تأتي الفوارق من بيانات المناطق الزمنية في متصفحك، فالتوقيت الصيفي في التاريخ المختار محسوب أصلًا — حتى للأماكن التي تغيّره في عطلة مختلفة عنك.',
  },
}

const TONE: Record<Quality, string> = {
  good: 'bg-green-600 text-sand-100',
  edge: 'bg-[color-mix(in_srgb,var(--color-gold-400)_40%,transparent)] text-ink',
  bad: 'bg-[color-mix(in_srgb,var(--color-ink)_12%,transparent)] text-ink-faint',
}

const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function TimezonePlannerTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const local = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Riyadh'
  const [zones, setZones] = useState<string[]>([])
  const [date, setDate] = useState(todayIso())
  const [anchor, setAnchor] = useState(local)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE)
      const saved = raw ? (JSON.parse(raw) as string[]) : null
      setZones(saved?.length ? saved : [local, 'Europe/London', 'America/New_York'])
    } catch { setZones([local, 'Europe/London', 'America/New_York']) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    if (zones.length) { try { localStorage.setItem(STORE, JSON.stringify(zones)) } catch { /* ignore */ } }
  }, [zones])

  const day = useMemo(() => {
    const [y, m, d] = date.split('-').map(Number)
    return new Date(y, (m || 1) - 1, d || 1)
  }, [date])

  const slots = useMemo(
    () => (zones.length ? rankSlots(zones, day, anchor) : []),
    [zones, day, anchor],
  )
  const best = useMemo(
    () => [...slots].sort((a, b) => b.score - a.score).slice(0, 3).filter((x) => x.score > 0),
    [slots],
  )

  const name = (id: string) => ZONES.find((z) => z.id === id)?.[locale === 'ar' ? 'ar' : 'en'] ?? id.split('/').pop()!.replace(/_/g, ' ')
  const fmtOffset = (id: string) => {
    const m = offsetMinutes(id, day)
    const sign = m < 0 ? '−' : '+'
    const abs = Math.abs(m)
    return `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, '0')}:${String(abs % 60).padStart(2, '0')}`
  }

  return (
    <Stack data-testid="timezone-planner">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.add}
          <Select className="min-w-[12rem]" data-testid="tz-add" value=""
            onChange={(e) => { if (e.target.value && !zones.includes(e.target.value)) setZones([...zones, e.target.value]) }}>
            <option value="">—</option>
            {ZONES.filter((z) => !zones.includes(z.id)).map((z) => (
              <option key={z.id} value={z.id}>{locale === 'ar' ? z.ar : z.en}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.date}
          <Input type="date" className="w-44" data-testid="tz-date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
          {s.anchor}
          <Select className="min-w-[11rem]" data-testid="tz-anchor" value={anchor} onChange={(e) => setAnchor(e.target.value)}>
            {zones.map((z) => <option key={z} value={z}>{name(z)}</option>)}
          </Select>
        </label>
      </div>

      {zones.length < 2 ? (
        <p className="text-ink-faint text-[0.95rem] rtl:font-ar" data-testid="tz-toofew">{zones.length ? s.tooFew : s.hint}</p>
      ) : (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.best}</h2>
            {best.length === 0 ? (
              <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="tz-nogood">{s.noneGood}</p>
            ) : (
              <div className="flex flex-col gap-2" data-testid="tz-best">
                {best.map((slot, i) => (
                  <Panel key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="font-display text-[1.1rem] text-ink font-mono">
                      {String(slot.hours[zones.indexOf(anchor)]?.hour ?? 0).padStart(2, '0')}:00
                    </span>
                    <span className="text-[0.8rem] text-ink-faint rtl:font-ar">{name(anchor)}</span>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 flex-1">
                      {slot.hours.map((h) => (
                        <span key={h.zone} className="text-[0.85rem]">
                          <span className="text-ink-faint rtl:font-ar">{name(h.zone)} </span>
                          <span className={`font-mono px-1 rounded-sm ${TONE[h.quality]}`}>{String(h.hour).padStart(2, '0')}:00</span>
                        </span>
                      ))}
                    </div>
                  </Panel>
                ))}
              </div>
            )}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.grid}</h2>
            <div className="overflow-x-auto" data-testid="tz-grid">
              <table className="border-collapse text-[0.78rem]">
                <tbody>
                  {zones.map((z) => (
                    <tr key={z}>
                      <th className="sticky start-0 bg-[var(--surface)] text-start pe-3 py-1 font-normal whitespace-nowrap border-e border-[color:var(--line)]">
                        <span className="text-ink rtl:font-ar">{name(z)}</span>
                        {z === local && <span className="text-ink-faint"> · {s.yours}</span>}
                        <span className="block font-mono text-[0.68rem] text-ink-faint">{fmtOffset(z)}</span>
                      </th>
                      {slots.map((slot, i) => {
                        const h = slot.hours.find((x) => x.zone === z)!
                        return (
                          <td key={i} className={`text-center font-mono w-9 py-1 border-e border-[color:var(--line)] ${TONE[h.quality]}`}>
                            {String(h.hour).padStart(2, '0')}
                          </td>
                        )
                      })}
                      <td className="ps-2">
                        <button onClick={() => setZones(zones.filter((x) => x !== z))} aria-label={s.remove}
                          data-testid={`tz-remove-${z}`} className="text-ink-faint hover:text-ink [&_svg]:size-4 border-0 bg-transparent p-1">
                          <TrashIcon />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-3 text-[0.8rem]">
              {(['good', 'edge', 'bad'] as Quality[]).map((q) => (
                <span key={q} className="flex items-center gap-1.5">
                  <span className={`inline-block w-4 h-3 rounded-sm ${TONE[q]}`} />
                  <span className="text-ink-faint rtl:font-ar">{s[q]}</span>
                </span>
              ))}
            </div>
          </section>

          <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.dstNote}</p>
        </>
      )}
    </Stack>
  )
}
