import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, FieldLabel } from '../../components/ui'

const STR = {
  en: {
    title: 'Enter a value in any field', bin: 'Binary', oct: 'Octal', dec: 'Decimal', hex: 'Hexadecimal',
    custom: 'Custom base', base: 'Base', invalid: 'Not a valid number for this base.',
    privacy: 'Converted in your browser — nothing is uploaded.',
  },
  ar: {
    title: 'أدخل قيمة في أي حقل', bin: 'ثنائي', oct: 'ثماني', dec: 'عشري', hex: 'ست عشري',
    custom: 'أساس مخصّص', base: 'الأساس', invalid: 'ليس عددًا صالحًا لهذا الأساس.',
    privacy: 'يُحوَّل في متصفحك — لا يُرفع أي شيء.',
  },
}

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'

function parseIn(str: string, base: number): bigint | null {
  const s = str.trim().toLowerCase().replace(/^0[box]/, '')
  if (!s) return null
  let neg = false, body = s
  if (body[0] === '-') { neg = true; body = body.slice(1) }
  let v = 0n
  const b = BigInt(base)
  for (const ch of body) {
    const d = DIGITS.indexOf(ch)
    if (d < 0 || d >= base) return null
    v = v * b + BigInt(d)
  }
  return neg ? -v : v
}

function toBase(v: bigint, base: number): string {
  if (v === 0n) return '0'
  const neg = v < 0n
  let n = neg ? -v : v
  const b = BigInt(base)
  let out = ''
  while (n > 0n) { out = DIGITS[Number(n % b)] + out; n /= b }
  return (neg ? '-' : '') + out
}

export default function BaseConverterTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [value, setValue] = useState<bigint | null>(255n)
  const [errBase, setErrBase] = useState<number | null>(null)
  const [customBase, setCustomBase] = useState(36)

  function edit(str: string, base: number) {
    if (str.trim() === '') { setValue(null); setErrBase(null); return }
    const v = parseIn(str, base)
    if (v === null) { setErrBase(base) } else { setValue(v); setErrBase(null) }
  }

  const fields = useMemo(() => [
    { base: 2, label: s.bin, id: 'bin' },
    { base: 8, label: s.oct, id: 'oct' },
    { base: 10, label: s.dec, id: 'dec' },
    { base: 16, label: s.hex, id: 'hex' },
  ], [s])

  return (
    <Stack data-testid="base-converter">
      <p className="text-[0.9rem] text-ink-soft">{s.title}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <label key={f.id} className="flex flex-col gap-[0.4rem]">
            <FieldLabel>{f.label} <span className="text-ink-faint font-normal">· base {f.base}</span></FieldLabel>
            <Input dir="ltr" className="font-mono text-[1.05rem]" value={value === null ? '' : toBase(value, f.base)}
              onChange={(e) => edit(e.target.value, f.base)} data-testid={`base-${f.id}`} />
            {errBase === f.base && <span className="text-[color:var(--danger)] text-[0.75rem]">{s.invalid}</span>}
          </label>
        ))}
      </div>

      <div className="border-t border-[color:var(--line-soft)] pt-4 flex flex-col gap-[0.4rem]">
        <FieldLabel>{s.custom}</FieldLabel>
        <div className="flex items-end gap-3">
          <label className="flex flex-col gap-1 w-24"><span className="text-[0.75rem] text-ink-faint">{s.base} (2–36)</span>
            <Input type="number" min={2} max={36} value={customBase} onChange={(e) => setCustomBase(Math.min(36, Math.max(2, Number(e.target.value) || 2)))} className="font-mono" data-testid="base-custom-base" /></label>
          <Input dir="ltr" className="font-mono text-[1.05rem] flex-1" value={value === null ? '' : toBase(value, customBase)}
            onChange={(e) => edit(e.target.value, customBase)} data-testid="base-custom" />
        </div>
        {errBase === customBase && <span className="text-[color:var(--danger)] text-[0.75rem]">{s.invalid}</span>}
      </div>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
