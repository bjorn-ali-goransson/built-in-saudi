import { useEffect, useState } from 'react'
import { Input, Textarea } from '../../components/ui'
import { formatTime, type Cue, type Format } from './subtitles'

// The timestamp fields keep their own draft string. A fully-controlled input
// reformatted from the number on every keystroke is impossible to type in — the
// caret jumps and a half-deleted stamp snaps back. So: edit freely, commit only
// a complete stamp, and re-sync when the cue changes underneath (a shift, a
// frame-rate fix, or Undo).
function parseStamp(v: string): number | null {
  const m = v.trim().match(/^(\d{1,3}):([0-5]\d):([0-5]\d)[.,](\d{1,3})$/)
  if (!m) return null
  return +m[1] * 3600 + +m[2] * 60 + +m[3] + +m[4].padEnd(3, '0') / 1000
}

function Stamp({ value, format, onCommit, testId }: {
  value: number; format: Format; onCommit: (n: number) => void; testId: string
}) {
  const canonical = formatTime(value, format)
  const [draft, setDraft] = useState(canonical)
  useEffect(() => { setDraft(canonical) }, [canonical])
  const valid = parseStamp(draft) !== null
  return (
    <Input
      dir="ltr"
      data-testid={testId}
      className={`w-[8.5rem] font-mono text-[0.8rem] py-1${valid ? '' : ' !border-gold-500'}`}
      value={draft}
      onChange={(e) => {
        setDraft(e.target.value)
        const n = parseStamp(e.target.value)
        if (n !== null) onCommit(n)
      }}
      onBlur={() => { if (parseStamp(draft) === null) setDraft(canonical) }}
    />
  )
}

export function CueRow({ cue, index, format, onChange }: {
  cue: Cue; index: number; format: Format; onChange: (patch: Partial<Cue>) => void
}) {
  return (
    <div className="flex flex-col gap-1 border-b border-[color:var(--line)] last:border-b-0 pb-2 last:pb-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-mono text-[0.72rem] text-ink-faint w-8">{index + 1}</span>
        <Stamp value={cue.start} format={format} testId={`sub-start-${index}`} onCommit={(start) => onChange({ start })} />
        <span className="text-ink-faint">→</span>
        <Stamp value={cue.end} format={format} testId={`sub-end-${index}`} onCommit={(end) => onChange({ end })} />
      </div>
      <Textarea
        rows={Math.min(4, cue.text.split('\n').length)}
        dir="auto"
        className="text-[0.9rem] py-1"
        data-testid={`sub-text-${index}`}
        value={cue.text}
        onChange={(e) => onChange({ text: e.target.value })}
      />
    </div>
  )
}
