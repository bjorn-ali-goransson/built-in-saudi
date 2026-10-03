import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Check, Input, Panel, Stack } from '../../components/ui'
import { CogIcon, DownloadIcon, KebabIcon } from '../../components/icons'

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
  MIN_LEN, SCHOOL_WEEK, WEEK, clamp, emptySchedule, isBlank, itemsOn,
  moveAcross, newId, nextSlot, readShareHash, reorderDay, sequence, subjectsOf,
  teacherSheet, withAxis,
  setDuration, shareLink, troubles, type DayKey, type Item, type Schedule,
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

  const [raw, setSchedule] = useState<Schedule>(() => loadDraft() ?? emptySchedule(l))
  /**
   * The sheet everything downstream reads: the activities, plus the axis they
   * imply. Derived in ONE place rather than maintained at every edit, which is
   * how a start time and the activities under it come to disagree.
   */
  const schedule = useMemo(() => withAxis(raw), [raw])
  const [saved, setSaved] = useState<Schedule[]>(() => loadAll())
  const [mem, setMem] = useState<IconMemory>(() => loadIconMemory())
  const [busy, setBusy] = useState(false)
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
        if (live && shared) { setSchedule(shared) }
      })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => { live = false; window.removeEventListener('hashchange', read) }
  }, [l])

  useEffect(() => { saveDraft(schedule) }, [schedule])
  useEffect(() => { setQr(null) }, [schedule])

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
      const slot = nextSlot(withAxis(prev), day)
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

  const onText = (value: string) => {
    if (editing?.kind !== 'text') return
    setSchedule((p) => ({ ...p, [editing.field]: value }))
  }

  function open(x: Schedule) {
    setSchedule(x)
    setCurrentId(x.id)
    setEditing(null)
    if (window.location.hash) window.history.replaceState(null, '', window.location.pathname)
  }

  const fileName = (title: string, who?: string) =>
    `${[title || 'schedule', who].filter(Boolean).join('-').replace(/[^\w؀-ۿ-]+/g, '-').slice(0, 60)}.pdf`

  /**
   * Print a sheet. The whole schedule by default, or one teacher's own.
   *
   * A teacher's copy gets its OWN link in its own QR, so scanning it opens
   * that sheet rather than the full week — the code on a page should go where
   * the page says it goes.
   */
  async function download(who?: string) {
    setBusy(true)
    try {
      const sheet = who ? teacherSheet(schedule, who) : schedule
      const href = who
        ? await shareLink(sheet, window.location.origin, window.location.pathname)
        : link
      const { schedulePdf } = await import('./draw')
      const { blob, qr: plan } = await schedulePdf(
        sheet, l, href, { scanToEdit: s.scanToEdit }, { plain: !!who },
      )
      if (!who) setQr(plan)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName(schedule.title, who)
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } finally { setBusy(false) }
  }

  const sheetStrings: SheetStrings = {
    activity: s.activity, time: s.time, move: s.move, trouble: s.trouble,
    addTo: s.addTo, copyDay: s.copyDay, editTitle: s.titleLabel, editNote: s.noteLabel,
    editGroup: s.groupLabel, hideArt: s.hideArt, untitled: s.untitled,
  }

  const blank = isBlank(schedule)
  const subjects = useMemo(() => subjectsOf(schedule), [schedule])
  const textValue = editing?.kind === 'text' ? String(schedule[editing.field] ?? '') : ''

  return (
    <Stack data-testid="activity-schedule">
      {/* The blurb belongs to an EMPTY sheet and to nothing else. Hiding it
          only for a link was half the rule and missed the commonest case:
          open a shared sheet, come back later without the hash, and the draft
          loads with the explanation back on top of it. Once there is a
          schedule on screen — from a link, a starter, a draft or your own
          morning's work — a paragraph describing the tool is just something
          between the reader and the document. */}
      {blank && <p data-testid="as-intro" className="text-ink-faint">{s.intro}</p>}

      {/* Two quiet icon affordances, and nothing else above the sheet. A cog
          holds SETTINGS — the things that change how the sheet is shaped —
          and the kebab holds the DOCUMENT. They were one "⋯ Settings" button
          holding both, which is why saving a schedule lived under a cog. The
          export is not here: it is the LAST thing you do, so it is at the
          end, under the thing it prints. */}
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

      {blank && (
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

      {subjects.length > 0 && (
        <div data-testid="as-teachers" className="grid gap-2">
          <div className="text-[0.9rem] font-semibold text-ink">{s.teachers}</div>
          <p className="text-sm text-ink-faint">{s.teacherHint}</p>
          <ul className="grid gap-1.5">
            {subjects.map((name, i) => {
              const who = (schedule.teachers?.[name] ?? '').trim()
              return (
                <li key={name} data-subject={name} className="flex items-center gap-2">
                  <span className="w-[8rem] shrink-0 truncate text-sm text-ink font-ar">{name}</span>
                  <Input
                    value={schedule.teachers?.[name] ?? ''}
                    placeholder={s.teacherName}
                    data-testid={`as-teacher-${i}`}
                    className="font-ar"
                    onChange={(e) => setSchedule((p) => ({
                      ...p,
                      teachers: { ...(p.teachers ?? {}), [name]: e.target.value },
                    }))}
                  />
                  {/* Disabled until somebody is named, because the sheet is
                      grouped BY the name — with none there is no teacher to
                      print and nothing to call the file. */}
                  <button
                    type="button"
                    data-testid={`as-teacher-pdf-${i}`}
                    title={who ? s.teacherPdf(who) : s.teacherHint}
                    aria-label={who ? s.teacherPdf(who) : s.teacherHint}
                    disabled={!who || busy}
                    onClick={() => download(who)}
                    className={`${ICON_BTN} disabled:cursor-not-allowed disabled:opacity-35`}
                  >
                    <DownloadIcon className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* At the END, because printing is what you do once the sheet is right.
          It is the only filled button in the tool for the same reason: it is
          the only control that produces a file. */}
      <div>
        <Button variant="primary" type="button" data-testid="as-download" disabled={busy} onClick={() => download()}>
          {busy ? s.working : s.download}
        </Button>
      </div>

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
                  <Button type="button" data-testid="as-save"
                    onClick={() => { setSaved(saveOne(schedule)); setCurrentId(schedule.id) }}>
                    {s.save}
                  </Button>
                  <Button type="button" data-testid="as-new"
                    onClick={() => {
                      setSchedule(emptySchedule(l))
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
            </>
            )}
          </div>
        </Drawer>
      )}
    </Stack>
  )
}
