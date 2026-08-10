import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Textarea, Select, Field, Check, Stack, Panel, Seg, SegButton, CodeOut } from '../../components/ui'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import { DEFAULTS, buildIcs, parseIcs, type EventInput, type Repeat } from '../../lib/ics'

const STR = {
  en: {
    tabMake: 'Make a file', tabRead: 'Read a file',
    summary: 'Title', summaryPh: 'Team meeting',
    date: 'Date', start: 'Start', end: 'End', endDate: 'End date',
    allDay: 'All day',
    location: 'Location', locationPh: 'Riyadh, or a meeting link',
    description: 'Description', url: 'Link', organizer: 'Organiser email',
    repeat: 'Repeats', repeats: { none: 'Never', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly', yearly: 'Yearly' } as Record<Repeat, string>,
    times: 'Number of times', timesHint: 'Leave 0 for no end',
    alarm: 'Reminder', alarmNone: 'None', alarmMin: (n: number) => `${n} minutes before`,
    download: 'Download .ics', copy: 'Copy', copied: 'Copied!',
    output: 'The file',
    paste: 'Paste an .ics file, or choose one',
    found: (n: number) => `${n} event${n === 1 ? '' : 's'}`,
    none: 'No events found in that text.',
    tz: (z: string) => `Times are read in your timezone — ${z} — and written as UTC, so the moment is the same for everyone you send it to.`,
    allDayNote: 'An all-day event is written as a date with no time at all. Writing it as midnight-to-midnight instead is why so many all-day events show up on the wrong day for anyone in another timezone.',
    foldNote: 'Long lines are folded at 75 octets as the spec requires — the step most generators skip, and the reason a long description can make Outlook reject the file.',
    errors: {
      'no-date': 'Pick a date.',
      'bad-time': 'That start or end time could not be read.',
      'ends-before-start': 'The end is before the start.',
    } as Record<string, string>,
    colSummary: 'Title', colWhen: 'When', colWhere: 'Where',
  },
  ar: {
    tabMake: 'إنشاء ملف', tabRead: 'قراءة ملف',
    summary: 'العنوان', summaryPh: 'اجتماع الفريق',
    date: 'التاريخ', start: 'البداية', end: 'النهاية', endDate: 'تاريخ الانتهاء',
    allDay: 'يوم كامل',
    location: 'المكان', locationPh: 'الرياض، أو رابط اجتماع',
    description: 'الوصف', url: 'الرابط', organizer: 'بريد المنظِّم',
    repeat: 'التكرار', repeats: { none: 'بلا تكرار', daily: 'يوميًا', weekly: 'أسبوعيًا', monthly: 'شهريًا', yearly: 'سنويًا' } as Record<Repeat, string>,
    times: 'عدد المرات', timesHint: 'اترك ٠ لبلا نهاية',
    alarm: 'تذكير', alarmNone: 'بلا', alarmMin: (n: number) => `قبل ${n} دقيقة`,
    download: 'نزّل ملف ‎.ics‎', copy: 'نسخ', copied: 'تم النسخ!',
    output: 'الملف',
    paste: 'الصق ملف ‎.ics‎ أو اختر ملفًا',
    found: (n: number) => `${n} حدثًا`,
    none: 'لم يُعثر على أحداث في هذا النص.',
    tz: (z: string) => `تُقرأ الأوقات بتوقيتك — ${z} — وتُكتب بتوقيت UTC، فتكون اللحظة واحدة لدى كل من ترسل إليه.`,
    allDayNote: 'يُكتب حدث اليوم الكامل تاريخًا بلا وقت البتة. وكتابته من منتصف ليل إلى منتصف ليل هي سبب ظهور كثير من هذه الأحداث في اليوم الخطأ لمن كان في منطقة زمنية أخرى.',
    foldNote: 'تُطوى الأسطر الطويلة عند ٧٥ ثمانية كما يوجب المعيار — وهي الخطوة التي تتخطاها أغلب المولّدات، وسببُ رفض Outlook للملف حين يطول الوصف.',
    errors: {
      'no-date': 'اختر تاريخًا.',
      'bad-time': 'تعذّرت قراءة وقت البداية أو النهاية.',
      'ends-before-start': 'النهاية قبل البداية.',
    } as Record<string, string>,
    colSummary: 'العنوان', colWhen: 'الوقت', colWhere: 'المكان',
  },
}

const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export default function IcsBuilderTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [tab, setTab] = useState<'make' | 'read'>('make')
  const [ev, setEv] = useState<EventInput>({ ...DEFAULTS, date: today(), summary: '' })
  const [copied, setCopied] = useState(false)
  const [raw, setRaw] = useState('')

  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setEv((p) => ({ ...p, [k]: v }))
  const zone = useMemo(() => Intl.DateTimeFormat().resolvedOptions().timeZone, [])

  const built = useMemo(() => {
    try { return { text: buildIcs(ev), error: '' } } catch (e) {
      return { text: '', error: s.errors[e instanceof Error ? e.message : ''] ?? '' }
    }
  }, [ev, s])

  const parsed = useMemo(() => (raw.trim() ? parseIcs(raw) : []), [raw])

  async function copy() {
    try { await navigator.clipboard.writeText(built.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  function download() {
    const blob = new Blob([built.text], { type: 'text/calendar;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${(ev.summary || 'event').replace(/[^\w؀-ۿ-]+/g, '-').slice(0, 40)}.ics`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  const fmt = (d: Date | null, allDay: boolean) => {
    if (!d) return '—'
    return allDay
      ? d.toLocaleDateString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium' })
      : d.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' })
  }

  return (
    <Stack data-testid="ics-builder">
      <Seg data-testid="ics-tabs">
        <SegButton active={tab === 'make'} onClick={() => setTab('make')} data-testid="ics-tab-make">{s.tabMake}</SegButton>
        <SegButton active={tab === 'read'} onClick={() => setTab('read')} data-testid="ics-tab-read">{s.tabRead}</SegButton>
      </Seg>

      {tab === 'make' ? (
        <>
          <Panel>
            <Field label={s.summary}>
              <Input value={ev.summary} placeholder={s.summaryPh} data-testid="ics-summary"
                onChange={(e) => set('summary', e.target.value)} />
            </Field>

            <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
              <Field label={s.date}>
                <Input type="date" value={ev.date} data-testid="ics-date" onChange={(e) => set('date', e.target.value)} />
              </Field>
              {!ev.allDay && (
                <>
                  <Field label={s.start}>
                    <Input type="time" value={ev.start} data-testid="ics-start" onChange={(e) => set('start', e.target.value)} />
                  </Field>
                  <Field label={s.end}>
                    <Input type="time" value={ev.end} data-testid="ics-end" onChange={(e) => set('end', e.target.value)} />
                  </Field>
                </>
              )}
              {ev.allDay && (
                <Field label={s.endDate}>
                  <Input type="date" value={ev.endDate} data-testid="ics-end-date" onChange={(e) => set('endDate', e.target.value)} />
                </Field>
              )}
              <div className="flex items-end">
                <Check><input type="checkbox" checked={ev.allDay} data-testid="ics-all-day"
                  onChange={(e) => set('allDay', e.target.checked)} /> {s.allDay}</Check>
              </div>
            </div>

            <Field label={s.location}>
              <Input value={ev.location} placeholder={s.locationPh} data-testid="ics-location"
                onChange={(e) => set('location', e.target.value)} />
            </Field>
            <Field label={s.description}>
              <Textarea rows={3} value={ev.description} data-testid="ics-description"
                onChange={(e) => set('description', e.target.value)} />
            </Field>

            <div className="grid gap-3 grid-cols-2 min-[620px]:grid-cols-4">
              <Field label={s.repeat}>
                <Select value={ev.repeat} data-testid="ics-repeat" onChange={(e) => set('repeat', e.target.value as Repeat)}>
                  {(Object.keys(s.repeats) as Repeat[]).map((k) => <option key={k} value={k}>{s.repeats[k]}</option>)}
                </Select>
              </Field>
              {ev.repeat !== 'none' && (
                <Field label={s.times}>
                  <Input type="number" min={0} max={999} value={ev.repeatCount} data-testid="ics-count"
                    onChange={(e) => set('repeatCount', Math.max(0, Number(e.target.value) || 0))} />
                </Field>
              )}
              <Field label={s.alarm}>
                <Select value={ev.alarm} data-testid="ics-alarm" onChange={(e) => set('alarm', Number(e.target.value))}>
                  <option value={0}>{s.alarmNone}</option>
                  {[5, 10, 15, 30, 60, 1440].map((m) => <option key={m} value={m}>{s.alarmMin(m)}</option>)}
                </Select>
              </Field>
              <Field label={s.organizer}>
                <Input type="email" value={ev.organizer} data-testid="ics-organizer"
                  onChange={(e) => set('organizer', e.target.value)} />
              </Field>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button variant="primary" onClick={download} disabled={!built.text} data-testid="ics-download">
                <DownloadIcon /> {s.download}
              </Button>
              <Button onClick={copy} disabled={!built.text} data-testid="ics-copy">
                <CopyIcon /> {copied ? s.copied : s.copy}
              </Button>
              {built.error && <span className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="ics-error">{built.error}</span>}
            </div>
          </Panel>

          {built.text && (
            <section className="flex flex-col gap-2">
              <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.output}</h2>
              <pre className="overflow-x-auto rounded-md border border-[color:var(--line)] bg-[var(--surface)] p-3" data-testid="ics-output">
                <CodeOut>{built.text}</CodeOut>
              </pre>
            </section>
          )}

          <Panel className="gap-1">
            <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{ev.allDay ? s.allDayNote : s.tz(zone)}</p>
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.foldNote}</p>
          </Panel>
        </>
      ) : (
        <>
          <Field label={s.paste}>
            <Textarea rows={8} value={raw} data-testid="ics-raw" className="font-mono text-[0.85rem]"
              onChange={(e) => setRaw(e.target.value)} />
          </Field>
          <label className="inline-flex items-center gap-2 self-start px-3 py-1.5 rounded-md border border-[color:var(--line)] bg-[var(--surface)] text-[0.9rem] cursor-pointer">
            {s.tabRead}
            <input type="file" className="hidden" data-testid="ics-file"
              onChange={async (e) => { const f = e.target.files?.[0]; if (f) setRaw(await f.text()) }} />
          </label>

          {raw.trim() && (
            parsed.length ? (
              <section className="flex flex-col gap-2">
                <span className="text-[0.85rem] text-ink-faint" data-testid="ics-found">{s.found(parsed.length)}</span>
                <div className="overflow-x-auto border border-[color:var(--line)] rounded-md bg-[var(--surface)]">
                  <table className="w-full text-[0.85rem] border-collapse" data-testid="ics-events">
                    <thead>
                      <tr className="text-ink-faint text-[0.72rem] uppercase tracking-[0.05em]">
                        <th className="text-start px-3 py-2 font-body">{s.colSummary}</th>
                        <th className="text-start px-3 py-2 font-body">{s.colWhen}</th>
                        <th className="text-start px-3 py-2 font-body">{s.colWhere}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.map((p, i) => (
                        <tr key={i} className="border-t border-[color:var(--line-soft)]" data-testid={`ics-event-${i}`}>
                          <td className="px-3 py-1.5 text-ink">{p.summary || '—'}</td>
                          <td className="px-3 py-1.5 whitespace-nowrap">
                            {fmt(p.start, p.allDay)}{p.end ? ` → ${fmt(p.end, p.allDay)}` : ''}
                            {p.rrule && <span className="text-ink-faint font-mono"> · {p.rrule}</span>}
                          </td>
                          <td className="px-3 py-1.5 text-ink-soft">{p.location || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : (
              <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="ics-none">{s.none}</p>
            )
          )}
        </>
      )}
    </Stack>
  )
}
