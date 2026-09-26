import { useCallback, useEffect, useMemo, useState } from 'react'
import { useLocale, localePath } from '../../i18n'
import { Button, Check, Field, Input, Panel, Stack } from '../../components/ui'
import { Sheet, type SheetStrings } from './Sheet'
import { STR } from './strings'
import { iconFor, loadIconMemory, rememberIcon, type IconMemory } from './icons'
import {
  SCHOOL_WEEK, WEEK, alignRow, emptySchedule, isBlank, readShareHash, shareLink,
  troubles, type Cell, type DayKey, type Schedule,
} from './schedule'
import {
  deleteOne, loadAll, loadDraft, saveDraft, saveOne, setCurrentId,
  timeVocabulary, vocabulary,
} from './store'
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
      readShareHash(window.location.hash).then((shared) => {
        if (live && shared) { setSchedule(shared); setFromLink(true) }
      })
    }
    read()
    window.addEventListener('hashchange', read)
    return () => { live = false; window.removeEventListener('hashchange', read) }
  }, [])

  useEffect(() => { saveDraft(schedule) }, [schedule])
  useEffect(() => { setCopied(false); setQr(null) }, [schedule])

  const suggestions = useMemo(() => vocabulary(saved, schedule), [saved, schedule])
  const times = useMemo(() => timeVocabulary(saved, schedule), [saved, schedule])
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

  /**
   * Writing one cell.
   *
   * Two rules beyond "store what was typed", and both exist to stop the
   * harmony check firing on work the tool could have done itself:
   *
   * **A time spreads down its row while the row still agrees.** Setting the
   * period once is the normal case, so typing it into any day fills the rest
   * — and a cell typed later inherits it too, because people set the times
   * first as often as they set the activities first. Once a day has been
   * deliberately given its own time the row is no longer bare and nothing is
   * overwritten.
   *
   * **The icon follows the name until somebody overrules it.** A name used
   * before brings back the icon it was given, in this schedule or any other.
   * Choosing by hand is what TEACHES that, so the two directions differ: a
   * name may replace a suggested icon, and an icon never touches the name.
   */
  const setCell = useCallback((row: number, day: DayKey, patch: Partial<Cell>) => {
    setSchedule((prev) => {
      const rows = prev.rows.map((r, i) => {
        if (i !== row) return r
        const before: Cell = r.cells[day] ?? { name: '', icon: '', time: '' }
        const next: Cell = { ...before, ...patch }

        if (patch.name !== undefined && patch.icon === undefined) {
          const wasSuggested = !before.icon || before.icon === iconFor(before.name, mem)
          if (wasSuggested) next.icon = iconFor(next.name, mem)
        }

        const cells = { ...r.cells, [day]: next }
        const others = prev.days.filter((d) => d !== day)
        const otherTimes = others.map((d) => (cells[d]?.time ?? '').trim()).filter(Boolean)

        if (patch.time !== undefined && next.time.trim() && otherTimes.length === 0) {
          for (const d of others) {
            const c = cells[d]
            if (c && (c.name.trim() || c.icon)) cells[d] = { ...c, time: next.time.trim() }
          }
        } else if (patch.name !== undefined && !next.time.trim() && otherTimes.length) {
          const agreed = otherTimes.every((t) => t === otherTimes[0]) ? otherTimes[0] : ''
          if (agreed) next.time = agreed
        }

        return { ...r, cells }
      })
      return { ...prev, rows }
    })
  }, [mem])

  /** Choosing an icon by hand is the only thing that writes the memory. */
  const setIcon = useCallback((row: number, day: DayKey, icon: string, name: string) => {
    setCell(row, day, { icon })
    if (name.trim()) setMem(rememberIcon(name, icon))
  }, [setCell])

  const onAlign = (row: number) =>
    setSchedule((p) => ({ ...p, rows: p.rows.map((r, i) => (i === row ? alignRow(r, p.days) : r)) }))

  const alignAll = () =>
    setSchedule((p) => ({ ...p, rows: p.rows.map((r) => alignRow(r, p.days)) }))

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
    } catch { /* the field below is selectable either way */ }
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
    fix: s.fix, alignRow: s.alignRow, trouble: s.trouble,
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
        <Field label={s.titleLabel} className="min-w-[14rem] flex-1">
          <Input value={schedule.title} data-testid="as-title"
            onChange={(e) => setSchedule((p) => ({ ...p, title: e.target.value }))} />
        </Field>
        <Field label={s.noteLabel} className="min-w-[14rem] flex-1">
          <Input value={schedule.note} data-testid="as-note"
            onChange={(e) => setSchedule((p) => ({ ...p, note: e.target.value }))} />
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
        <Panel data-testid="as-harmony">
          <h3 className="font-display text-lg">{s.harmonyTitle}</h3>
          <p className="text-sm text-ink-faint" data-testid="as-harmony-count">
            {s.harmonyCount(problems.length)}
          </p>
          <div>
            <Button type="button" data-testid="as-align-all" onClick={alignAll}>{s.alignAll}</Button>
          </div>
        </Panel>
      )}

      <Sheet
        schedule={schedule} locale={l} mem={mem} suggestions={suggestions} times={times}
        str={sheetStrings} onCell={setCell} onIcon={setIcon} onAlign={onAlign}
      />

      <div className="flex flex-wrap gap-3">
        <Button type="button" data-testid="as-add-row"
          onClick={() => setSchedule((p) => ({ ...p, rows: [...p.rows, { cells: {} }] }))}>
          {s.addRow}
        </Button>
        <Button type="button" data-testid="as-remove-row" disabled={schedule.rows.length <= 1}
          onClick={() => setSchedule((p) => ({ ...p, rows: p.rows.slice(0, -1) }))}>
          {s.removeRow}
        </Button>
        <Button type="button" data-testid="as-save" onClick={save}>{s.save}</Button>
        <Button type="button" data-testid="as-new" onClick={startNew}>{s.newOne}</Button>
        <Button type="button" data-testid="as-share" onClick={copyLink}>
          {copied ? s.copied : s.share}
        </Button>
        <Button variant="primary" type="button" data-testid="as-download" disabled={busy} onClick={download}>
          {busy ? s.working : s.download}
        </Button>
      </div>

      {isBlank(schedule) && <p className="text-sm text-ink-faint" data-testid="as-empty">{s.empty}</p>}

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
        <h3 className="font-display text-lg">{s.whyHarmonyTitle}</h3>
        <p className="text-sm text-ink-faint" data-testid="as-why-harmony">{s.whyHarmonyBody}</p>
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
