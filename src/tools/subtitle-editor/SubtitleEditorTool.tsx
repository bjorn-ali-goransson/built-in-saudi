import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { DownloadIcon, UploadIcon, CopyIcon } from '../../components/icons'
import { Button, Input, Textarea, Stack, Seg, SegButton, Panel, FileError } from '../../components/ui'
import { setWorkInProgress } from '../../lib/workInProgress'
import { CueRow } from './CueRow'
import {
  parse, serialize, shift, scale, formatTime, problems, totalDuration,
  FRAME_RATES, type Cue, type Format,
} from './subtitles'

const STR = {
  en: {
    drop: 'Choose an .srt or .vtt file', or: 'or paste the subtitles below',
    paste: 'Paste subtitle text…',
    cues: (n: number) => `${n} cue${n === 1 ? '' : 's'}`,
    runtime: 'Runs to', skipped: (n: number) => `${n} block${n === 1 ? '' : 's'} skipped — no readable timing.`,
    shift: 'Shift all timings', seconds: 'seconds', apply: 'Apply',
    earlier: 'Earlier', later: 'Later',
    rate: 'Frame rate fix', from: 'From', to: 'To',
    rateHint: 'Use this when the subtitles start in sync but drift further out as the film goes on.',
    format: 'Save as', download: 'Download', copy: 'Copy', copied: 'Copied!',
    empty: 'Nothing loaded yet.',
    issues: 'Timing issues', reversed: 'ends before it starts', overlap: 'overlaps the previous cue', emptyCue: 'no text',
    at: 'at', reset: 'Undo all changes',
    unreadable: 'That file did not contain any readable subtitle cues.',
    editHint: 'Edit any line below — the text and both timestamps are editable.',
  },
  ar: {
    drop: 'اختر ملف ‎.srt أو ‎.vtt', or: 'أو الصق الترجمة أدناه',
    paste: 'الصق نص الترجمة…',
    cues: (n: number) => `${n.toLocaleString('ar')} مقطعًا`,
    runtime: 'حتى', skipped: (n: number) => `تُخطّي ${n.toLocaleString('ar')} كتلة — بلا توقيت مقروء.`,
    shift: 'إزاحة كل التوقيتات', seconds: 'ثانية', apply: 'طبّق',
    earlier: 'أبكر', later: 'أمتأخر',
    rate: 'تصحيح معدّل الإطارات', from: 'من', to: 'إلى',
    rateHint: 'استخدم هذا حين تبدأ الترجمة متزامنة ثم تنحرف أكثر فأكثر مع تقدّم الفيلم.',
    format: 'احفظ بصيغة', download: 'تنزيل', copy: 'نسخ', copied: 'تم النسخ!',
    empty: 'لم يُحمَّل شيء بعد.',
    issues: 'مشاكل التوقيت', reversed: 'ينتهي قبل أن يبدأ', overlap: 'يتداخل مع المقطع السابق', emptyCue: 'بلا نص',
    at: 'عند', reset: 'تراجع عن كل التعديلات',
    unreadable: 'لم يحتوِ هذا الملف على أي مقاطع ترجمة مقروءة.',
    editHint: 'عدّل أي سطر أدناه — النص وكلا التوقيتين قابلة للتحرير.',
  },
}

export default function SubtitleEditorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [raw, setRaw] = useState('')
  const [cues, setCues] = useState<Cue[]>([])
  const [original, setOriginal] = useState<Cue[]>([])
  const [format, setFormat] = useState<Format>('srt')
  const [skipped, setSkipped] = useState(0)
  const [error, setError] = useState('')
  const [offset, setOffset] = useState('1')
  const [fromRate, setFromRate] = useState(25)
  const [toRate, setToRate] = useState(23.976)
  const [name, setName] = useState('subtitles')
  const [copied, setCopied] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Leaving the tool clears the hold, or the deploy check would never reload again.
  useEffect(() => () => setWorkInProgress('subtitle-editor', false), [])

  function load(text: string, fileName?: string) {
    const r = parse(text)
    if (r.cues.length === 0) { setError(s.unreadable); return }
    setError('')
    setCues(r.cues)
    setOriginal(r.cues)
    setFormat(r.format)
    setSkipped(r.skipped)
    if (fileName) setName(fileName.replace(/\.(srt|vtt)$/i, ''))
    // Holding parsed-and-edited cues counts as work: a deploy reload would lose them.
    setWorkInProgress('subtitle-editor', true)
  }

  async function pick(f: File | undefined) {
    if (!f) return
    setRaw('')
    try { load(await f.text(), f.name) } catch { setError(s.unreadable) }
  }

  const out = useMemo(() => (cues.length ? serialize(cues, format) : ''), [cues, format])
  const issues = useMemo(() => problems(cues), [cues])
  const dirty = cues !== original

  function applyShift(sign: 1 | -1) {
    const n = parseFloat(offset.replace(',', '.'))
    if (!Number.isFinite(n)) return
    setCues((c) => shift(c, sign * n))
  }
  function applyRate() {
    if (!fromRate || !toRate) return
    setCues((c) => scale(c, fromRate / toRate))
  }
  function editCue(i: number, patch: Partial<Cue>) {
    setCues((c) => c.map((cue, j) => (j === i ? { ...cue, ...patch } : cue)))
  }
  function download() {
    const blob = new Blob([out], { type: format === 'srt' ? 'application/x-subrip' : 'text/vtt' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${name || 'subtitles'}.${format}`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function copy() {
    try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="subtitle-editor">
      <div className="flex flex-wrap gap-2 items-center">
        {/* No accept filter: Android's gallery picker hides files it hasn't indexed. */}
        <input ref={fileRef} type="file" className="hidden" data-testid="sub-file"
          onChange={(e) => pick(e.target.files?.[0])} />
        <Button onClick={() => fileRef.current?.click()} data-testid="sub-pick"><UploadIcon /> {s.drop}</Button>
        <span className="text-[0.9rem] text-ink-faint">{s.or}</span>
      </div>
      <Textarea className="min-h-[6rem] font-mono text-[0.85rem]" dir="ltr" data-testid="sub-paste"
        placeholder={s.paste} value={raw}
        onChange={(e) => { setRaw(e.target.value); if (e.target.value.trim()) load(e.target.value) }} />
      {error && <FileError message={error} />}

      {cues.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-[0.9rem]">
            <span className="font-semibold text-ink" data-testid="sub-count">{s.cues(cues.length)}</span>
            <span className="text-ink-faint font-mono">{s.runtime} {formatTime(totalDuration(cues), 'srt').slice(0, 8)}</span>
            {skipped > 0 && <span className="text-gold-500">{s.skipped(skipped)}</span>}
            {dirty && <Button className="px-2 py-1" onClick={() => setCues(original)} data-testid="sub-reset">{s.reset}</Button>}
          </div>

          <Panel className="flex flex-col gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint w-full">{s.shift}</span>
              <Input type="number" step="0.1" dir="ltr" className="w-24 font-mono" data-testid="sub-offset"
                value={offset} onChange={(e) => setOffset(e.target.value)} />
              <span className="text-[0.9rem] text-ink-faint self-center">{s.seconds}</span>
              <Button onClick={() => applyShift(-1)} data-testid="sub-earlier">← {s.earlier}</Button>
              <Button onClick={() => applyShift(1)} data-testid="sub-later">{s.later} →</Button>
            </div>

            <div className="flex flex-wrap items-end gap-2 border-t border-[color:var(--line)] pt-3">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint w-full">{s.rate}</span>
              <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
                {s.from}
                <select className="border border-[color:var(--line)] bg-[var(--surface)] text-ink rounded-sm px-2 py-1 font-mono text-[0.9rem]"
                  data-testid="sub-from" value={fromRate} onChange={(e) => setFromRate(+e.target.value)}>
                  {FRAME_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
                {s.to}
                <select className="border border-[color:var(--line)] bg-[var(--surface)] text-ink rounded-sm px-2 py-1 font-mono text-[0.9rem]"
                  data-testid="sub-to" value={toRate} onChange={(e) => setToRate(+e.target.value)}>
                  {FRAME_RATES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <Button onClick={applyRate} data-testid="sub-rate">{s.apply}</Button>
              <p className="text-[0.82rem] text-ink-faint w-full rtl:font-ar">{s.rateHint}</p>
            </div>
          </Panel>

          {issues.length > 0 && (
            <p className="text-[0.88rem] text-gold-500 rtl:font-ar" data-testid="sub-issues">
              {s.issues}: {issues.slice(0, 4).map((p) => `#${p.index + 1} ${p.kind === 'reversed' ? s.reversed : p.kind === 'overlap' ? s.overlap : s.emptyCue}`).join(' · ')}
              {issues.length > 4 ? ` (+${issues.length - 4})` : ''}
            </p>
          )}

          <div className="flex flex-col gap-2">
            <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.editHint}</p>
            <div className="flex flex-col gap-2 max-h-[26rem] overflow-y-auto border border-[color:var(--line)] rounded-md p-2" data-testid="sub-list">
              {cues.map((c, i) => (
                <CueRow key={i} cue={c} index={i} format={format} onChange={(patch) => editCue(i, patch)} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.format}</span>
            <Seg>
              <SegButton active={format === 'srt'} data-testid="sub-fmt-srt" onClick={() => setFormat('srt')}>SRT</SegButton>
              <SegButton active={format === 'vtt'} data-testid="sub-fmt-vtt" onClick={() => setFormat('vtt')}>VTT</SegButton>
            </Seg>
            <Input className="w-40" data-testid="sub-name" value={name} onChange={(e) => setName(e.target.value)} />
            <Button variant="primary" onClick={download} data-testid="sub-download"><DownloadIcon /> {s.download}</Button>
            <Button onClick={copy} data-testid="sub-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
        </>
      )}
    </Stack>
  )
}

