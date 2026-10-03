import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Field, Input, Panel, Stack } from '../../components/ui'
import { CogIcon, KebabIcon } from '../../components/icons'

/**
 * A quiet icon affordance. No border and no fill: the one filled button in
 * the row is the export, so anything else wearing chrome would compete with
 * the only thing on the row that produces a file.
 */
const ICON_BTN = 'grid size-10 shrink-0 cursor-pointer place-items-center rounded-md '
  + 'border-0 bg-transparent text-ink-soft hover:bg-sand-100 '
  + 'focus-visible:outline-2 focus-visible:outline-green-600'
import { Sheet, type SheetStrings } from './Sheet'
import { Drawer, type Editing } from './Drawer'
import { STR } from './strings'
import { iconFor, loadIconMemory, rememberIcon, type IconMemory } from './icons'
import {
  MIN_LEN, SCHOOL_WEEK, WEEK, clamp, emptySchedule, fitDay, fmt, isBlank, itemsOn,
  moveAcross, newId, nextSlot, parseTime, readShareHash, reorderDay, sequence,
  setDuration, shareLink, snap, troubles, type DayKey, type Item, type Schedule,
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
  const [qr, setQr] = useState<QrPlan | null>(null)
  const [editing, setEditing] = useState<Editing | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  /**
   * Read a shared sheet out of the hash — on arrival AND on `hashchange`.
   *
   * Decoding is asynchronous now that the payload is deflated, so it cannot be
   * the initial state and has to land in an effect. `hashchange` matters as
   * much as the first read: without it the QR is a link that works everywhere
   * except in the tab that already has the editor open.
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
   * on the one browser where people share links most.
   */
  const [link, setLink] = useState('')
  useEffect(() => {
    let live = true
    shareLink(schedule, window.location.origin, window.location.pathname)
      .then((url) => { if (live) setLink(url) })
    return () => { live = false }
  }, [schedule])

  const edited = editing?.kind === 'item'
    ? itemsOn(schedule, editing.day as DayKey).find((x) => x.id === editing.id) ?? null
    : null

  const patch = useCallback((day: DayKey, id: string, fn: (it: Item) => Item) => {
    setSchedule((prev) => ({
      ...prev,
      items: { ...prev.items, [day]: itemsOn(prev, day).map((it) => (it.id === id ? fn(it) : it)) },
    }))
  }, [])

  /**
   * The icon follows the name until somebody overrules it. Choosing by hand is
   * what TEACHES that, so the two directions differ: a name may replace a
   * suggested icon, and an icon never touches the name.
   */
  const onName = useCallback((name: string) => {
    if (editing?.kind !== 'item') return
    patch(editing.day as DayKey, editing.id, (it) => {
      const wasSuggested = !it.icon || it.icon === iconFor(it.name, mem)
      return { ...it, name, icon: wasSuggested ? iconFor(name, mem) : it.icon }
    })
  }, [editing, patch, mem])

  const onIcon = useCallback((icon: string) => {
    if (editing?.kind !== 'item') return
    patch(editing.day as DayKey, editing.id, (it) => ({ ...it, icon }))
    const name = edited?.name ?? ''
    if (name.trim()) setMem(rememberIcon(name, icon))
  }, [editing, patch, edited])

  /**
   * Dragging reorders, and may carry the lesson into another day.
   *
   * `start` is only where the finger is; what it MEANS is a place in a day's
   * order. A cross-day move is one edit to two days, so it is applied as one.
   */
  const onDrag = useCallback((from: DayKey, id: string, to: DayKey, index: number) => {
    setDragging(id)
    setSchedule((prev) => {
      if (from === to) {
        const items = itemsOn(prev, from)
        const next = reorderDay(items, id, index)
        return next === items ? prev : { ...prev, items: { ...prev.items, [from]: next } }
      }
      const moved = moveAcross(itemsOn(prev, from), itemsOn(prev, to), id, index, prev.from)
      if (!moved) return prev
      return { ...prev, items: { ...prev.items, [from]: moved.from, [to]: moved.to } }
    })
  }, [])

  const onStep = useCallback((day: DayKey, id: string, delta: -1 | 1) => {
    setSchedule((prev) => {
      const items = itemsOn(prev, day)
      const at = sequence(items).findIndex((x) => x.id === id)
      if (at < 0) return prev
      const next = reorderDay(items, id, at + delta)
      return next === items ? prev : { ...prev, items: { ...prev.items, [day]: next } }
    })
  }, [])

  const onResize = useCallback((day: DayKey, id: string, end: number) => {
    setSchedule((prev) => ({
      ...prev,
      items: { ...prev.items, [day]: setDuration(itemsOn(prev, day), id, end, prev.to) },
    }))
  }, [])

  const onRemove = useCallback(() => {
    if (editing?.kind !== 'item') return
    const { day, id } = editing
    setSchedule((prev) => ({
      ...prev,
      items: { ...prev.items, [day]: itemsOn(prev, day as DayKey).filter((it) => it.id !== id) },
    }))
    setEditing(null)
  }, [editing])

  /** A new activity opens its drawer: an unnamed block is not an edit yet. */
  const onAdd = useCallback((day: DayKey) => {
    const id = newId()
    setSchedule((prev) => {
      const slot = nextSlot(prev, day)
      const start = clamp(slot.start, prev.from, Math.max(prev.from, prev.to - MIN_LEN))
      const item: Item = {
        id, name: '', icon: '',
        start, end: clamp(Math.max(slot.end, start + MIN_LEN), start + MIN_LEN, prev.to),
      }
      return { ...prev, items: { ...prev.items, [day]: [...itemsOn(prev, day), item] } }
    })
    setEditing({ kind: 'item', day, id })
  }, [])

  /**
   * Copy one day across the week — four identical days and one that differs is
   * the ordinary school week, and without this the same eight activities get
   * placed five times.
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
  }, [])

  /** Moving the axis must not strand a day outside it. */
  const setBounds = (which: 'from' | 'to', raw: string) => {
    const minutes = parseTime(raw)
    if (minutes === null) return
    setSchedule((prev) => {
      const from = which === 'from' ? snap(minutes) : prev.from
      const to = which === 'to' ? snap(minutes) : prev.to
      if (to - from < 60) return prev
      const items: Schedule['items'] = {}
      for (const day of prev.days) items[day] = fitDay(itemsOn(prev, day), from, to)
      return { ...prev, from, to, items }
    })
  }

  const onText = (value: string) => {
    if (editing?.kind !== 'text') return
    setSchedule((p) => ({ ...p, [editing.field]: value }))
  }

  function open(x: Schedule) {
    setSchedule(x)
    setCurrentId(x.id)
    setFromLink(false)
    setEditing(null)
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
    activity: s.activity, time: s.time, move: s.move, trouble: s.trouble,
    addTo: s.addTo, copyDay: s.copyDay, editTitle: s.titleLabel, editNote: s.noteLabel,
    editGroup: s.groupLabel, hideArt: s.hideArt, untitled: s.untitled,
  }

  const textValue = editing?.kind === 'text' ? String(schedule[editing.field] ?? '') : ''

  return (
    <Stack data-testid="activity-schedule">
      {/* Somebody who followed a QR code is looking at their own schedule.
          They do not need to be told what this is, or that they followed a
          link — they were there. */}
      {!fromLink && <p data-testid="as-intro" className="text-ink-faint">{s.intro}</p>}

      {/* One row: two quiet icon affordances and the one action worth
          shouting about. A cog holds SETTINGS — things that change how the
          sheet is shaped — and the kebab holds DOCUMENTS and sharing, which
          are acts rather than settings. They were one "⋯ Settings" button
          holding both, which is why saving a schedule lived under a cog. */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          data-testid="as-settings"
          title={s.settings}
          aria-label={s.settings}
          onClick={() => setEditing({ kind: 'settings' })}
          className={ICON_BTN}
        >
          <CogIcon className="size-5" />
        </button>
        <button
          type="button"
          data-testid="as-menu"
          title={s.menu}
          aria-label={s.menu}
          onClick={() => setEditing({ kind: 'menu' })}
          className={ICON_BTN}
        >
          <KebabIcon className="size-5" />
        </button>
        <Button variant="primary" type="button" data-testid="as-download" disabled={busy} onClick={download}>
          {busy ? s.working : s.download}
        </Button>
      </div>

      {problems.length > 0 && (
        <Panel data-testid="as-clash">
          <p className="text-sm text-ink-faint" data-testid="as-clash-count">
            {s.clashCount(problems.length)}
          </p>
        </Panel>
      )}

      <Sheet
        schedule={schedule} locale={l} mem={mem} str={sheetStrings} dragging={dragging}
        onOpen={(day, id) => setEditing({ kind: 'item', day, id })}
        onEditText={(field) => setEditing({ kind: 'text', field })}
        onHideArt={() => setSchedule((p) => ({ ...p, art: false }))}
        onDrag={onDrag}
        onDragEnd={() => setDragging(null)}
        onStep={onStep}
        onResize={onResize}
        onAdd={onAdd}
        onCopyDay={onCopyDay}
      />

      {isBlank(schedule) && (
        <div data-testid="as-empty" className="grid gap-2">
          <p className="text-sm text-ink-faint">{s.empty}</p>
          <p className="text-sm text-ink-faint">{s.starters}</p>
          <div className="flex flex-wrap gap-2">
            {SAMPLES.map((x) => (
              <Button
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
              >
                {x.label[l]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {qr && !qr.ok && (
        <Panel data-testid="as-qr-problem" data-why={qr.reason}>
          <p className="text-sm text-ink-faint">
            {qr.reason === 'too-long' ? s.qrTooLong(qr.bytes) : s.qrTooDense(qr.modules)}
          </p>
        </Panel>
      )}

      {editing && (
        <Drawer
          editing={editing}
          item={edited}
          text={textValue}
          mem={mem}
          suggestions={suggestions}
          str={{
            activity: s.activity, iconLabel: s.iconLabel, clearIcon: s.clearIcon,
            remove: s.remove, longer: s.longer, shorter: s.shorter, done: s.done,
            suggestions: s.suggestionsLabel, titleLabel: s.titleLabel,
            noteLabel: s.noteLabel, groupLabel: s.groupLabel, settings: s.settings, menu: s.menu,
            groupName: (g) => (l === 'ar' ? g.groupAr : g.group),
          }}
          onName={onName}
          onIcon={onIcon}
          onText={onText}
          onResize={(end) => {
            if (editing.kind === 'item') onResize(editing.day as DayKey, editing.id, end)
          }}
          onRemove={onRemove}
          onClose={() => setEditing(null)}
        >
          <div className="grid gap-3">
            {editing.kind === 'menu' ? (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" data-testid="as-share" onClick={copyLink}>
                    {copied ? s.copied : s.share}
                  </Button>
                  <Button type="button" data-testid="as-save"
                    onClick={() => { setSaved(saveOne(schedule)); setCurrentId(schedule.id); setFromLink(false) }}>
                    {s.save}
                  </Button>
                  <Button type="button" data-testid="as-new"
                    onClick={() => {
                      setSchedule(emptySchedule(l))
                      setFromLink(false)
                      setEditing(null)
                      if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
                    }}>
                    {s.newOne}
                  </Button>
                </div>
                {saved.length > 0 && (
                  <div data-testid="as-saved" className="grid gap-1">
                    <div className="text-[0.74rem] font-semibold text-ink-faint">{s.mine}</div>
                    <ul className="grid gap-1">
                      {saved.map((x) => (
                        <li key={x.id} className="flex items-center gap-2 text-sm">
                          <button type="button" data-testid={`as-open-${x.id}`} onClick={() => open(x)}
                            className="flex-1 cursor-pointer border-0 bg-transparent text-start text-ink underline rtl:font-ar">
                            {x.title || s.untitled}
                          </button>
                          <button type="button" data-testid={`as-delete-${x.id}`}
                            onClick={() => setSaved(deleteOne(x.id))}
                            className="cursor-pointer rounded-sm border-0 bg-sand-100 px-2 py-[2px] text-[0.76rem] text-ink-soft rtl:font-ar">
                            {s.remove}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
            <>
            <Check>
              <input type="checkbox" data-testid="as-weekend" checked={schedule.days.length === 7}
                onChange={(e) => setSchedule((p) => ({ ...p, days: e.target.checked ? [...WEEK] : [...SCHOOL_WEEK] }))} />
              {s.weekend}
            </Check>
            {/* A BUTTON, not a checkbox: ticking a box that then disappears
                is not a setting, it is an action pretending to be one. The
                illustrations are removed by clicking them, so bringing them
                back is the one thing this has to offer. */}
            {!schedule.art && (
              <div>
                <Button type="button" data-testid="as-show-art"
                  onClick={() => setSchedule((p) => ({ ...p, art: true }))}>
                  {s.art}
                </Button>
              </div>
            )}
            <div className="flex gap-3">
              <Field label={s.dayStart} className="w-[7rem]">
                <Input defaultValue={fmt(schedule.from)} dir="ltr" data-testid="as-from"
                  key={`from-${schedule.from}`} onBlur={(e) => setBounds('from', e.target.value)} />
              </Field>
              <Field label={s.dayEnd} className="w-[7rem]">
                <Input defaultValue={fmt(schedule.to)} dir="ltr" data-testid="as-to"
                  key={`to-${schedule.to}`} onBlur={(e) => setBounds('to', e.target.value)} />
              </Field>
            </div>
            </>
            )}
          </div>
        </Drawer>
      )}
    </Stack>
  )
}
