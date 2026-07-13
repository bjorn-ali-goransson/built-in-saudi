import { useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Button, Check, Seg, SegButton, Field, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const FIRST = ['Sara', 'Omar', 'Fahad', 'Noura', 'Khalid', 'Lina', 'Yousef', 'Maha', 'Turki', 'Reem', 'Sami', 'Hala', 'Nasser', 'Dana', 'Bandar', 'Aisha']
const LAST = ['Al-Otaibi', 'Al-Qahtani', 'Al-Harbi', 'Al-Ghamdi', 'Al-Dossari', 'Al-Shammari', 'Al-Zahrani', 'Al-Mutairi', 'Al-Rashid', 'Al-Subaie']
const CITY = ['Riyadh', 'Jeddah', 'Dammam', 'Mecca', 'Medina', 'Khobar', 'Abha', 'Tabuk', 'Buraidah', 'Taif']
const COMPANY = ['Najd Tech', 'Sahara Labs', 'Falcon Systems', 'Oasis Digital', 'Dunes Co', 'Palm Works', 'Sadu Studio', 'Rawabi Soft']

const FIELDS = ['id', 'name', 'email', 'phone', 'city', 'company', 'date'] as const
type FieldK = typeof FIELDS[number]

const STR = {
  en: { count: 'How many rows', fields: 'Fields', format: 'Format', generate: 'Generate', output: 'Output', copy: 'Copy', copied: 'Copied!', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { count: 'عدد الصفوف', fields: 'الحقول', format: 'الصيغة', generate: 'ولّد', output: 'المخرج', copy: 'نسخ', copied: 'تم النسخ!', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

const rnd = (n: number) => crypto.getRandomValues(new Uint32Array(1))[0] % n
const pick = <T,>(a: T[]) => a[rnd(a.length)]

function row(i: number): Record<FieldK, string> {
  const first = pick(FIRST), last = pick(LAST)
  const name = `${first} ${last}`
  return {
    id: String(1000 + i),
    name,
    email: `${first.toLowerCase()}.${last.replace(/[^a-z]/gi, '').toLowerCase()}@example.com`,
    phone: `+9665${rnd(10)}${String(rnd(10000000)).padStart(7, '0')}`,
    city: pick(CITY),
    company: pick(COMPANY),
    date: `202${rnd(6)}-${String(1 + rnd(12)).padStart(2, '0')}-${String(1 + rnd(28)).padStart(2, '0')}`,
  }
}

export default function FakeDataTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [count, setCount] = useState(10)
  const [sel, setSel] = useState<Set<FieldK>>(new Set(['id', 'name', 'email', 'city']))
  const [format, setFormat] = useState<'json' | 'csv'>('json')
  const [out, setOut] = useState('')
  const [copied, setCopied] = useState(false)

  function generate() {
    const cols = FIELDS.filter((f) => sel.has(f))
    const rows = Array.from({ length: Math.min(1000, Math.max(1, count)) }, (_, i) => row(i))
    if (format === 'json') {
      setOut(JSON.stringify(rows.map((r) => Object.fromEntries(cols.map((c) => [c, r[c]]))), null, 2))
    } else {
      const esc = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
      setOut([cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n'))
    }
  }

  async function copy() { try { await navigator.clipboard.writeText(out); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }
  const toggle = (f: FieldK) => setSel((cur) => { const n = new Set(cur); n.has(f) ? n.delete(f) : n.add(f); return n })

  return (
    <Stack data-testid="fake-data">
      <div className="flex flex-wrap items-end gap-4">
        <Field label={s.count} className="w-28"><Input type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Math.min(1000, Math.max(1, Number(e.target.value) || 1)))} className="font-mono" data-testid="fd-count" /></Field>
        <div className="flex flex-col gap-1"><FieldLabel>{s.format}</FieldLabel>
          <Seg><SegButton active={format === 'json'} onClick={() => setFormat('json')}>JSON</SegButton>
            <SegButton active={format === 'csv'} onClick={() => setFormat('csv')}>CSV</SegButton></Seg></div>
      </div>
      <div>
        <FieldLabel>{s.fields}</FieldLabel>
        <div className="flex flex-wrap gap-x-4 gap-y-2 mt-1">
          {FIELDS.map((f) => <Check key={f}><input type="checkbox" checked={sel.has(f)} onChange={() => toggle(f)} data-testid={`fd-field-${f}`} /> {f}</Check>)}
        </div>
      </div>
      <Button variant="primary" onClick={generate} disabled={!sel.size} className="self-start" data-testid="fd-generate">{s.generate}</Button>
      {out && (
        <>
          <div className="flex items-center justify-between"><FieldLabel>{s.output}</FieldLabel>
            <Button onClick={copy} data-testid="fd-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button></div>
          <pre className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-3 font-mono text-[0.8rem] overflow-x-auto max-h-[40vh]" dir="ltr" data-testid="fd-output">{out}</pre>
        </>
      )}
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
