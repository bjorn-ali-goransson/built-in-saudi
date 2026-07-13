import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Textarea, Button, Check, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

type Op = 'trim' | 'dedupe' | 'removeEmpty' | 'sortAsc' | 'sortDesc' | 'sortNum' | 'reverse' | 'shuffle' | 'lower' | 'upper'

const STR = {
  en: {
    input: 'Your list (one item per line)', output: 'Result', copy: 'Copy', copied: 'Copied!',
    trim: 'Trim spaces', dedupe: 'Remove duplicates', removeEmpty: 'Remove empty lines', sortAsc: 'Sort A→Z', sortDesc: 'Sort Z→A',
    sortNum: 'Sort numeric', reverse: 'Reverse', shuffle: 'Shuffle', lower: 'lowercase', upper: 'UPPERCASE',
    stats: 'items', privacy: 'Processed in your browser — nothing is uploaded.',
  },
  ar: {
    input: 'قائمتك (عنصر في كل سطر)', output: 'النتيجة', copy: 'نسخ', copied: 'تم النسخ!',
    trim: 'شذّب المسافات', dedupe: 'أزل المكرّرات', removeEmpty: 'أزل الأسطر الفارغة', sortAsc: 'رتّب أ→ي', sortDesc: 'رتّب ي→أ',
    sortNum: 'ترتيب رقمي', reverse: 'اعكس', shuffle: 'اخلط', lower: 'أحرف صغيرة', upper: 'أحرف كبيرة',
    stats: 'عناصر', privacy: 'تُعالَج في متصفحك — لا يُرفع أي شيء.',
  },
}

const OPS: Op[] = ['trim', 'removeEmpty', 'dedupe', 'sortAsc', 'sortDesc', 'sortNum', 'reverse', 'shuffle', 'lower', 'upper']

function shuffle<T>(a: T[]): T[] {
  const r = [...a]
  const rand = crypto.getRandomValues(new Uint32Array(r.length))
  for (let i = r.length - 1; i > 0; i--) { const j = rand[i] % (i + 1);[r[i], r[j]] = [r[j], r[i]] }
  return r
}

export default function ListToolsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [input, setInput] = useState('')
  const [ops, setOps] = useState<Set<Op>>(new Set(['trim', 'removeEmpty', 'dedupe', 'sortAsc']))
  const [copied, setCopied] = useState(false)

  const toggle = (op: Op) => setOps((cur) => { const n = new Set(cur); n.has(op) ? n.delete(op) : n.add(op); return n })

  const output = useMemo(() => {
    let lines = input.split('\n')
    if (ops.has('trim')) lines = lines.map((l) => l.trim())
    if (ops.has('lower')) lines = lines.map((l) => l.toLowerCase())
    if (ops.has('upper')) lines = lines.map((l) => l.toUpperCase())
    if (ops.has('removeEmpty')) lines = lines.filter((l) => l.trim() !== '')
    if (ops.has('dedupe')) lines = [...new Set(lines)]
    if (ops.has('sortNum')) lines = [...lines].sort((a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0))
    else if (ops.has('sortAsc')) lines = [...lines].sort((a, b) => a.localeCompare(b, locale))
    else if (ops.has('sortDesc')) lines = [...lines].sort((a, b) => b.localeCompare(a, locale))
    if (ops.has('reverse')) lines = [...lines].reverse()
    if (ops.has('shuffle')) lines = shuffle(lines)
    return lines.join('\n')
  }, [input, ops, locale])

  const inCount = input.trim() ? input.split('\n').filter((l) => l.trim()).length : 0
  const outCount = output.trim() ? output.split('\n').filter((l) => l.trim()).length : 0

  async function copy() { try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="list-tools">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[0.5rem_1rem]">
        {OPS.map((op) => (
          <Check key={op}><input type="checkbox" checked={ops.has(op)} onChange={() => toggle(op)} data-testid={`list-${op}`} /> {s[op]}</Check>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input} <span className="text-ink-faint font-normal">· {inCount} {s.stats}</span></FieldLabel>
          <Textarea value={input} onChange={(e) => setInput(e.target.value)} rows={10} className="font-mono text-[0.85rem]" data-testid="list-input" /></label>
        <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.output} <span className="text-ink-faint font-normal">· {outCount} {s.stats}</span></FieldLabel>
          <Textarea value={output} readOnly rows={10} className="font-mono text-[0.85rem]" data-testid="list-output" /></label>
      </div>
      <Button onClick={copy} disabled={!output.trim()} className="self-start" data-testid="list-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
