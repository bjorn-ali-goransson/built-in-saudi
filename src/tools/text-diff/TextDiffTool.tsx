import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, FieldLabel, Check } from '../../components/ui'

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

type Row = { t: 'add' | 'del' | 'eq'; text: string }

// Classic LCS over lines → add/del/eq rows.
function diffLines(aLines: string[], bLines: string[]): Row[] {
  const n = aLines.length, m = bLines.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      dp[i][j] = aLines[i] === bLines[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
  const rows: Row[] = []
  let i = 0, j = 0
  while (i < n && j < m) {
    if (aLines[i] === bLines[j]) { rows.push({ t: 'eq', text: aLines[i] }); i++; j++ }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { rows.push({ t: 'del', text: aLines[i] }); i++ }
    else { rows.push({ t: 'add', text: bLines[j] }); j++ }
  }
  while (i < n) rows.push({ t: 'del', text: aLines[i++] })
  while (j < m) rows.push({ t: 'add', text: bLines[j++] })
  return rows
}

export default function TextDiffTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [ignoreWs, setIgnoreWs] = useState(false)

  const rows = useMemo(() => {
    if (!a && !b) return []
    const prep = (t: string) => t.split('\n').map((l) => (ignoreWs ? l.trim() : l))
    return diffLines(prep(a), prep(b))
  }, [a, b, ignoreWs])

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
                  <div key={i} className={`px-3 py-[2px] whitespace-pre-wrap break-words ${r.t === 'add' ? 'bg-[color-mix(in_srgb,var(--color-green-400)_16%,transparent)] text-green-800' : r.t === 'del' ? 'bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] text-[color:var(--danger)]' : 'text-ink-soft'}`}>
                    <span className="select-none text-ink-faint me-2">{r.t === 'add' ? '+' : r.t === 'del' ? '−' : ' '}</span>{r.text || ' '}
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
