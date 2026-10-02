import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Check, Field, Input, Panel, Stack } from '../../components/ui'
import { Sheet, type SheetStrings } from './Sheet'
import { STR } from './strings'
import { iconFor, loadIconMemory, rememberIcon, type IconMemory } from './icons'
import {
  MIN_LEN, SCHOOL_WEEK, WEEK, clamp, emptySchedule, fmt, isBlank, itemsOn,
  magnets, moveTo, newId, nextSlot, parseTime, readShareHash, resizeTo, shareLink,
  snap, snapWith, troubles, type DayKey, type Item, type Schedule,
} from './schedule'
import {
  deleteOne, loadAll, loadDraft, saveDraft, saveOne, setCurrentId, vocabulary,
} from './store'
import { SAMPLES, sampleSchedule } from './samples'
import type { QrPlan } from './qr'

export default function ActivityScheduleTool() {
  const { locale } = useLocale()
  const l = locale === 'ar' ? 'ar' : 'en'
  const s = STR[l]

  const [schedule, setSchedule] = useState<Schedule>(() => loadDraft() ?? emptySchedule(l))
  const [fromLink, setFromLink] = useState(false)
  const [saved, setSaved] = useState<Schedule[]>(() => loadAll())
  const [mem, setMem] = useState<IconMemory>(() => loadIconMemory())
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [note, setNote] = useState('')
  const [qr, setQr] = useState<QrPlan | null>(null)

  /**
   * Read a shared sheet out of the hash — on arrival AND on `hashchange`.
   *
   * Decoding is asynchronous now that the payload is deflated, so it cannot be
   * the initial state and has to land in an effect. `hashchange` matters as
   * much as the first read: without it the QR is a link that works everywhere
   * except in the tab that already has the editor open, which is exactly where
   * somebody testing their own sheet will try it.
   */
  useEffect(() => {
    let live = true
    const read = () => {
      readShareHash(window.location.hash, l).then((shared) => {
        if (live && shared) { setSchedule(shared); setFromLink(true) }
      })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => { live = false; window.removeEventListener('hashchange', read) }
  }, [l])

  useEffect(() => { saveDraft(schedule) }, [schedule])
  useEffect(() => { setCopied(false); setQr(null) }, [schedule])

  const suggestions = useMemo(() => vocabulary(saved, schedule), [saved, schedule])
  const problems = useMemo(() => troubles(schedule), [schedule])

  /**
   * The share link is kept in state, not built when the button is pressed.
   *
   * Compressing is asynchronous, and `navigator.clipboard.writeText` after an
   * `await` has lost its user activation in Safari — the copy silently fails
   * on the one browser where people share links most. Having the link ready
   * means the click does nothing but write.
   */
  const [link, setLink] = useState('')
  useEffect(() => {
    let live = true
    shareLink(schedule, window.location.origin, window.location.pathname)
      .then((url) => { if (live) setLink(url) })
    return () => { live = false }
  }, [schedule])

  /** Replace one activity, leaving everything else alone. */
  const patch = useCallback((day: DayKey, id: string, fn: (it: Item) => Item) => {
    setSchedule((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [day]: itemsOn(prev, day).map((it) => (it.id === id ? fn(it) : it)),
      },
    }))
  }, [])

  /**
   * The icon follows the name until somebody overrules it.
   *
   * A name used before brings back the icon it was given, in this schedule or
   * any other. Choosing by hand is what TEACHES that, so the two directions
   * differ: a name may replace a suggested icon, and an icon never touches the
   * name.
   */
  const onName = useCallback((day: DayKey, id: string, name: string) => {
    patch(day, id, (it) => {
      const wasSuggested = !it.icon || it.icon === iconFor(it.name, mem)
      return { ...it, name, icon: wasSuggested ? iconFor(name, mem) : it.icon }
    })
  }, [patch, mem])

  const onIcon = useCallback((day: DayKey, id: string, icon: string, name: string) => {
    patch(day, id, (it) => ({ ...it, icon }))
    if (name.trim()) setMem(rememberIcon(name, icon))
  }, [patch])

  /**
   * Moving snaps to a neighbouring day's edge first, and to the quarter hour
   * otherwise — which is what makes a tidy week the default without locking
   * the days together. See `magnets` in `schedule.ts`.
   */
  const onMove = useCallback((day: DayKey, id: string, start: number, precise?: boolean) => {
    setSchedule((prev) => {
      const to = precise ? snap(start) : snapWith(start, magnets(prev, day))
      return {
        ...prev,
        items: {
          ...prev.items,
          [day]: itemsOn(prev, day).map((it) => (it.id === id ? moveTo(prev, it, to) : it)),
        },
      }
    })
  }, [])

  const onResize = useCallback((day: DayKey, id: string, end: number, precise?: boolean) => {
    setSchedule((prev) => {
      const to = precise ? snap(end) : snapWith(end, magnets(prev, day))
      return {
        ...prev,
        items: {
          ...prev.items,
          [day]: itemsOn(prev, day).map((it) => (it.id === id ? resizeTo(prev, it, to) : it)),
        },
      }
    })
  }, [])

  const onRemove = useCallback((day: DayKey, id: string) => {
    setSchedule((prev) => ({
      ...prev,
      items: { ...prev.items, [day]: itemsOn(prev, day).filter((it) => it.id !== id) },
    }))
  }, [])

  /** `after` is the activity Enter was pressed in; the new one follows it. */
  const onAdd = useCallback((day: DayKey, after?: Item) => {
    setSchedule((prev) => {
      const slot = after
        ? { start: after.end, end: Math.min(after.end + (after.end - after.start), prev.to) }
        : nextSlot(prev, day)
      const start = clamp(slot.start, prev.from, Math.max(prev.from, prev.to - MIN_LEN))
      const item: Item = {
        id: newId(), name: '', icon: '',
        start, end: clamp(Math.max(slot.end, start + MIN_LEN), start + MIN_LEN, prev.to),
      }
      return { ...prev, items: { ...prev.items, [day]: [...itemsOn(prev, day), item] } }
    })
  }, [])

  /**
   * Copy one day across the week.
   *
   * The ordinary school week is four identical days and one that differs, so
   * without this the axis would be a worse tool for the common case than the
   * grid it replaced: you would place the same eight activities five times.
   * With it, you build one day and then change the day that is different —
   * which is also the order a timetable is actually written in.
   */
  const onCopyDay = useCallback((day: DayKey) => {
    setSchedule((prev) => {
      const source = itemsOn(prev, day)
      const items = { ...prev.items }
      for (const other of prev.days) {
        if (other === day) continue
        items[other] = source.map((it) => ({ ...it, id: newId() }))
      }
      return { ...prev, items }
    })
    setNote(s.copiedDay)
  }, [s.copiedDay])

  /** Moving the axis must not strand activities outside it. */
  const setBounds = (which: 'from' | 'to', raw: string) => {
    const minutes = parseTime(raw)
    if (minutes === null) return
    setSchedule((prev) => {
      const from = which === 'from' ? snap(minutes) : prev.from
      const to = which === 'to' ? snap(minutes) : prev.to
      if (to - from < 60) return prev
      const items: Schedule['items'] = {}
      for (const day of prev.days) {
        items[day] = itemsOn(prev, day).map((it) => {
          const len = Math.min(it.end - it.start, to - from)
          const start = clamp(it.start, from, to - len)
          return { ...it, start, end: start + len }
        })
      }
      return { ...prev, from, to, items }
    })
  }

  function save() {
    setSaved(saveOne(schedule))
    setCurrentId(schedule.id)
    setFromLink(false)
  }

  function open(x: Schedule) {
    setSchedule(x)
    setCurrentId(x.id)
    setFromLink(false)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }

  function startNew() {
    setSchedule(emptySchedule(l))
    setFromLink(false)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
    } catch { /* the link is still in the QR either way */ }
    const { planQr } = await import('./qr')
    setQr(planQr(link))
  }

  async function download() {
    setBusy(true)
    try {
      const { schedulePdf } = await import('./draw')
      const { blob, qr: plan } = await schedulePdf(schedule, l, link, { scanToEdit: s.scanToEdit })
      setQr(plan)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${(schedule.title || 'schedule').replace(/[^\w؀-ۿ-]+/g, '-').slice(0, 40)}.pdf`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  const sheetStrings: SheetStrings = {
    activity: s.activity, time: s.time, iconLabel: s.iconLabel, clearIcon: s.clearIcon,
    move: s.move, resize: s.resize, remove: s.remove,
    addTo: s.addTo, copyDay: s.copyDay, trouble: s.trouble,
  }

  return (
    <Stack data-testid="activity-schedule">
      <p className="text-ink-faint">{s.intro}</p>

      {fromLink && (
        <Panel data-testid="as-from-link">
          <h3 className="font-display text-lg">{s.fromLinkTitle}</h3>
          <p className="text-sm text-ink-faint">{s.fromLinkBody}</p>
        </Panel>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <Field label={s.titleLabel} className="min-w-[12rem] flex-1">
          <Input value={schedule.title} data-testid="as-title"
            onChange={(e) => setSchedule((p) => ({ ...p, title: e.target.value }))} />
        </Field>
        <Field label={s.noteLabel} className="min-w-[12rem] flex-1">
          <Input value={schedule.note} data-testid="as-note"
            onChange={(e) => setSchedule((p) => ({ ...p, note: e.target.value }))} />
        </Field>
        <Field label={s.groupLabel} className="w-[9rem]">
          <Input value={schedule.group} data-testid="as-group"
            onChange={(e) => setSchedule((p) => ({ ...p, group: e.target.value }))} />
        </Field>
        <Field label={s.dayStart} className="w-[7rem]">
          <Input defaultValue={fmt(schedule.from)} dir="ltr" data-testid="as-from"
            key={`from-${schedule.from}`}
            onBlur={(e) => setBounds('from', e.target.value)} />
        </Field>
        <Field label={s.dayEnd} className="w-[7rem]">
          <Input defaultValue={fmt(schedule.to)} dir="ltr" data-testid="as-to"
            key={`to-${schedule.to}`}
            onBlur={(e) => setBounds('to', e.target.value)} />
        </Field>
        <div className="flex flex-col gap-2">
          <Check>
            <input type="checkbox" data-testid="as-weekend" checked={schedule.days.length === 7}
              onChange={(e) => setSchedule((p) => ({ ...p, days: e.target.checked ? [...WEEK] : [...SCHOOL_WEEK] }))} />
            {s.weekend}
          </Check>
          <Check>
            <input type="checkbox" data-testid="as-art" checked={schedule.art}
              onChange={(e) => setSchedule((p) => ({ ...p, art: e.target.checked }))} />
            {s.art}
          </Check>
        </div>
      </div>

      {problems.length > 0 && (
        <Panel data-testid="as-clash">
          <h3 className="font-display text-lg">{s.clashTitle}</h3>
          <p className="text-sm text-ink-faint" data-testid="as-clash-count">
            {s.clashCount(problems.length)}
          </p>
        </Panel>
      )}

      <Sheet
        schedule={schedule} locale={l} mem={mem} suggestions={suggestions} str={sheetStrings}
        onName={onName} onIcon={onIcon} onMove={onMove} onResize={onResize}
        onRemove={onRemove} onAdd={onAdd} onCopyDay={onCopyDay}
      />

      {note && <p className="text-sm text-ink-faint" data-testid="as-note-line">{note}</p>}

      <div className="flex flex-wrap gap-3">
        <Button type="button" data-testid="as-save" onClick={save}>{s.save}</Button>
        <Button type="button" data-testid="as-new" onClick={startNew}>{s.newOne}</Button>
        <Button type="button" data-testid="as-share" onClick={copyLink}>
          {copied ? s.copied : s.share}
        </Button>
        <Button variant="primary" type="button" data-testid="as-download" disabled={busy} onClick={download}>
          {busy ? s.working : s.download}
        </Button>
      </div>

      {isBlank(schedule) && (
        <div data-testid="as-empty" className="grid gap-2">
          <p className="text-sm text-ink-faint">{s.empty}</p>
          {/*
            The starters are offered HERE and not only at a URL. A sheet you can
            only reach by typing its name is a sheet nobody finds — the failure
            this repo records for the collections, one level down. They show on
            an empty sheet only: once there is something on the axis, a row of
            buttons that would replace it is a trap rather than a shortcut.
          */}
          <p className="text-sm text-ink-faint">{s.starters}</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((x) => (
              <button
                key={x.id}
                type="button"
                data-testid={`as-sample-${x.id}`}
                onClick={() => {
                  const made = sampleSchedule(x.id, l)
                  if (!made) return
                  setSchedule(made)
                  setFromLink(false)
                  if (window.location.hash) {
                    window.history.replaceState(null, '', window.location.pathname)
                  }
                }}
                className="cursor-pointer rounded-md border border-[color:var(--line)] bg-[var(--surface)] px-3 py-2 text-sm text-ink rtl:font-ar"
              >
                {x.label[l]}
              </button>
            ))}
          </div>
        </div>
      )}

      {qr && !qr.ok && (
        <Panel data-testid="as-qr-problem" data-why={qr.reason}>
          <h3 className="font-display text-lg">{s.qrProblemTitle}</h3>
          <p className="text-sm text-ink-faint">
            {qr.reason === 'too-long' ? s.qrTooLong(qr.bytes) : s.qrTooDense(qr.modules)}
          </p>
        </Panel>
      )}

      {saved.length > 0 && (
        <Panel data-testid="as-saved">
          <h3 className="font-display text-lg">{s.mine}</h3>
          <ul className="grid gap-1">
            {saved.map((x) => (
              <li key={x.id} className="flex items-center gap-2 text-sm">
                <button type="button" data-testid={`as-open-${x.id}`} onClick={() => open(x)}
                  className="flex-1 cursor-pointer border-0 bg-transparent text-start text-ink underline rtl:font-ar">
                  {x.title || s.untitled}
                </button>
                <span className="text-ink-faint">{new Date(x.updated).toLocaleDateString(l === 'ar' ? 'ar-SA' : 'en-GB')}</span>
                <button type="button" data-testid={`as-delete-${x.id}`}
                  onClick={() => setSaved(deleteOne(x.id))}
                  className="cursor-pointer rounded-sm border border-[color:var(--line)] bg-transparent px-2 py-[2px] text-[0.76rem] text-ink-soft rtl:font-ar">
                  {s.remove}
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <Panel>
        <h3 className="font-display text-lg">{s.whyAxisTitle}</h3>
        <p className="text-sm text-ink-faint" data-testid="as-why-axis">{s.whyAxisBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.whyIconTitle}</h3>
        <p className="text-sm text-ink-faint" data-testid="as-why-icon">{s.whyIconBody}</p>
      </Panel>

      <Panel>
        <h3 className="font-display text-lg">{s.whyShareTitle}</h3>
        <p className="text-sm text-ink-faint" data-testid="as-why-share">{s.whyShareBody}</p>
      </Panel>

      <p className="text-sm">
        <a href={localePath(locale, '/apps/timetable')}>{s.related}</a>
      </p>
    </Stack>
  )
}
