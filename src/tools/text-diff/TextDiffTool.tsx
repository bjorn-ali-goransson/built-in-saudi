import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, FieldLabel, Check } from '../../components/ui'
import { diffRows } from './rows'

const STR = {
  en: {
    a: 'Original', b: 'Changed', result: 'Diff', added: 'added', removed: 'removed', same: 'unchanged',
    ignoreWs: 'Ignore leading/trailing whitespace', identical: 'The two texts are identical.',
    privacy: 'Compared in your browser — nothing is uploaded.',
  },
  ar: {
    a: 'الأصل', b: 'المعدّل', result: 'الفرق', added: 'مُضاف', removed: 'محذوف', same: 'دون تغيير',
    ignoreWs: 'تجاهل المسافات الطرفية', identical: 'النصّان متطابقان.',
    privacy: 'تجري المقارنة في متصفحك — لا يُرفع أي شيء.',
  },
}

export default function TextDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [ignoreWs, setIgnoreWs] = useState(false)

  const rows = useMemo(() => (!a && !b ? [] : diffRows(a, b, ignoreWs)), [a, b, ignoreWs])

  const added = rows.filter((r) => r.t === 'add').length
  const removed = rows.filter((r) => r.t === 'del').length

  return (
    <Stack data-testid="text-diff">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.a}</FieldLabel>
          <Textarea value={a} onChange={(e) => setA(e.target.value)} rows={8} className="font-mono text-[0.85rem]" data-testid="diff-a" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.b}</FieldLabel>
          <Textarea value={b} onChange={(e) => setB(e.target.value)} rows={8} className="font-mono text-[0.85rem]" data-testid="diff-b" /></label>
      </div>
      <Check><input type="checkbox" checked={ignoreWs} onChange={(e) => setIgnoreWs(e.target.checked)} data-testid="diff-ignorews" /> {s.ignoreWs}</Check>

      {rows.length > 0 && (
        <>
          <p className="text-[0.85rem] text-ink-soft flex gap-3">
            <span className="text-green-700 font-semibold">+{added} {s.added}</span>
            <span className="text-[color:var(--danger)] font-semibold">−{removed} {s.removed}</span>
          </p>
          {added === 0 && removed === 0
            ? <p className="text-[0.9rem] text-ink-soft">{s.identical}</p>
            : (
              <div className="border border-[color:var(--line-soft)] rounded-md overflow-hidden font-mono text-[0.85rem]" dir="ltr" data-testid="diff-output">
                {rows.map((r, i) => (
                  <div key={i} data-testid={`diff-row-${i}`} data-kind={r.t}
                    className={`px-3 py-[2px] whitespace-pre-wrap break-words ${r.t === 'add' ? 'bg-[color-mix(in_srgb,var(--color-green-400)_10%,transparent)] text-green-800' : r.t === 'del' ? 'bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] text-[color:var(--danger)]' : 'text-ink-soft'}`}>
                    <span className="select-none text-ink-faint me-2">{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' '}</span>
                    {/* The row keeps its line identity; the emphasis moves to the
                        words that actually differ. A row with no partner to compare
                        against has one part and reads exactly as it always did. */}
                    {r.parts.map((p, k) => (
                      <span key={k} data-changed={p.changed && r.t !== 'eq' ? 'yes' : 'no'}
                        className={p.changed && r.t !== 'eq'
                          ? `rounded-[3px] px-[2px] font-semibold ${r.t === 'add' ? 'bg-[color-mix(in_srgb,var(--color-green-400)_38%,transparent)]' : 'bg-[color-mix(in_srgb,var(--danger)_26%,transparent)]'}`
                          : undefined}>
                        {k > 0 ? ' ' : ''}{p.text}
                      </span>
                    ))}
                    {r.text ? null : ' '}
                  </div>
                ))}
              </div>
            )}
        </>
      )}

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
