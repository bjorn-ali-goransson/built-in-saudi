import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, RefreshIcon } from '../../components/icons'
import {
  generatePassword, generatePassphrase, passwordEntropy, phraseEntropy,
  strength, type Strength,
} from './build'
import { WORDS } from './words'
import { Button, Seg, SegButton, Field, Select, Check } from '../../components/ui'

type Mode = 'password' | 'passphrase'

const STR = {
  en: {
    password: 'Password', passphrase: 'Passphrase',
    length: 'Length', lowercase: 'Lowercase', uppercase: 'Uppercase',
    digits: 'Digits', symbols: 'Symbols', excludeAmbiguous: 'Exclude look-alikes (I l 1 O 0 o)',
    words: 'Words', separator: 'Separator', capitalize: 'Capitalize', addNumber: 'Add a number',
    copy: 'Copy', copied: 'Copied!', regenerate: 'Regenerate', regenerateAria: 'Generate a new password',
    strength: 'Strength', bits: (n: number) => `${n} bits`,
    levels: { weak: 'Weak', fair: 'Fair', strong: 'Strong', excellent: 'Excellent' } as Record<Strength, string>,
    output: 'Generated password', empty: 'Select at least one character set.',
    privacy: 'Generated locally — never sent anywhere.',
    sepDash: 'Dash (-)', sepSpace: 'Space', sepDot: 'Dot (.)',
  },
  ar: {
    password: 'كلمة مرور', passphrase: 'عبارة مرور',
    length: 'الطول', lowercase: 'أحرف صغيرة', uppercase: 'أحرف كبيرة',
    digits: 'أرقام', symbols: 'رموز', excludeAmbiguous: 'استبعاد المتشابهة (I l 1 O 0 o)',
    words: 'عدد الكلمات', separator: 'الفاصل', capitalize: 'حرف أول كبير', addNumber: 'إضافة رقم',
    copy: 'نسخ', copied: 'تم النسخ!', regenerate: 'إعادة توليد', regenerateAria: 'توليد كلمة مرور جديدة',
    strength: 'القوة', bits: (n: number) => `${n} بت`,
    levels: { weak: 'ضعيفة', fair: 'متوسطة', strong: 'قوية', excellent: 'ممتازة' } as Record<Strength, string>,
    output: 'كلمة المرور المُولّدة', empty: 'اختر مجموعة أحرف واحدة على الأقل.',
    privacy: 'تُنشأ محليًا — لا تُرسل إلى أي مكان.',
    sepDash: 'شرطة (-)', sepSpace: 'مسافة', sepDot: 'نقطة (.)',
  },
}

export default function PasswordGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]

  const [mode, setMode] = useState<Mode>('password')
  const [length, setLength] = useState(16)
  const [lower, setLower] = useState(true)
  const [upper, setUpper] = useState(true)
  const [digits, setDigits] = useState(true)
  const [symbols, setSymbols] = useState(true)
  const [excludeAmbiguous, setExcludeAmbiguous] = useState(false)

  const [words, setWords] = useState(4)
  const [separator, setSeparator] = useState('-')
  const [capitalize, setCapitalize] = useState(true)
  const [addNumber, setAddNumber] = useState(true)

  const [value, setValue] = useState('')
  const [bits, setBits] = useState(0)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  const pwOpts = { length, lower, upper, digits, symbols, excludeAmbiguous }
  const phraseOpts = { words, separator, capitalize, number: addNumber }
  const noSet = mode === 'password' && !lower && !upper && !digits && !symbols

  const regenerate = useCallback(() => {
    if (mode === 'password') {
      setValue(generatePassword(pwOpts))
      setBits(passwordEntropy(pwOpts))
    } else {
      setValue(generatePassphrase(phraseOpts, WORDS))
      setBits(phraseEntropy(phraseOpts, WORDS.length))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, length, lower, upper, digits, symbols, excludeAmbiguous, words, separator, capitalize, addNumber])

  useEffect(() => { regenerate() }, [regenerate])
  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.clearTimeout(copyTimer.current)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1600)
    } catch { /* ignore */ }
  }

  const level = strength(bits)
  const st = STRENGTH[level]

  return (
    <div className="flex flex-col gap-[1.3rem]" data-testid="password-generator">
      <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md p-[1.2rem]" data-testid="pw-output-wrap">
        <label className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]" htmlFor="pw-output">{s.output}</label>
        <div className="flex gap-[0.6rem] items-stretch mt-[0.4rem] flex-wrap">
          <output id="pw-output" className="flex-1 min-w-[12rem] flex items-center font-mono text-[1.15rem] break-all px-[0.9rem] py-[0.7rem] bg-sand-100 border border-[color:var(--line-soft)] rounded-[5px] text-ink" data-testid="pw-output" dir="ltr">
            {noSet ? <span className="text-[color:var(--danger)] font-body text-[0.95rem]">{s.empty}</span> : value}
          </output>
        </div>
        <div className="flex gap-[0.6rem] mt-[0.6rem]">
          <Button className="flex-none px-[0.8rem]" onClick={regenerate} disabled={noSet}
            aria-label={s.regenerateAria} title={s.regenerate} data-testid="pw-regenerate">
            <RefreshIcon /> {s.regenerate}
          </Button>
          <Button variant="primary" className="flex-1 justify-center" onClick={copy} disabled={noSet || !value}
            aria-label={s.copy} data-testid="pw-copy">
            <CopyIcon /> {copied ? s.copied : s.copy}
          </Button>
        </div>
        {!noSet && (
          <div className="flex items-center gap-[0.7rem] mt-[0.9rem]" data-testid="pw-strength"
            role="status" aria-label={`${s.strength}: ${s.levels[level]}`}>
            <span className="flex-1 h-[7px] rounded-full bg-sand-200 overflow-hidden">
              <span className="block h-full rounded-full transition-[width,background] duration-[250ms]" style={{ width: st.w, background: st.bar }} />
            </span>
            <span className={`text-[0.82rem] font-semibold font-mono whitespace-nowrap rtl:font-ar ${st.label}`}>{s.levels[level]} · {s.bits(bits)}</span>
          </div>
        )}
      </div>

      <div className="bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-lg shadow-[var(--shadow-sm)] p-[1.3rem] grid gap-[1.1rem]">
        <Seg role="group" aria-label={s.strength}>
          {(['password', 'passphrase'] as Mode[]).map((m) => (
            <SegButton key={m} active={mode === m}
              aria-pressed={mode === m} data-testid={`pw-mode-${m}`}
              onClick={() => setMode(m)}>{s[m]}</SegButton>
          ))}
        </Seg>

        {mode === 'password' ? (
          <>
            <div className={CONTROL}>
              <label htmlFor="pw-length">{s.length} <span className="text-ink-faint font-medium">{length}</span></label>
              <input id="pw-length" type="range" min={6} max={64} value={length}
                data-testid="pw-length" aria-label={s.length}
                onChange={(e) => setLength(Number(e.target.value))} />
            </div>
            <div className={CHECKS}>
              <Toggle label={s.lowercase} checked={lower} onChange={setLower} testid="pw-lower" />
              <Toggle label={s.uppercase} checked={upper} onChange={setUpper} testid="pw-upper" />
              <Toggle label={s.digits} checked={digits} onChange={setDigits} testid="pw-digits" />
              <Toggle label={s.symbols} checked={symbols} onChange={setSymbols} testid="pw-symbols" />
              <Toggle label={s.excludeAmbiguous} checked={excludeAmbiguous} onChange={setExcludeAmbiguous} testid="pw-ambiguous" />
            </div>
          </>
        ) : (
          <>
            <div className={CONTROL}>
              <label htmlFor="pw-words">{s.words} <span className="text-ink-faint font-medium">{words}</span></label>
              <input id="pw-words" type="range" min={3} max={8} value={words}
                data-testid="pw-words" aria-label={s.words}
                onChange={(e) => setWords(Number(e.target.value))} />
            </div>
            <Field label={s.separator}>
              <Select value={separator} data-testid="pw-separator"
                aria-label={s.separator} onChange={(e) => setSeparator(e.target.value)}>
                <option value="-">{s.sepDash}</option>
                <option value=" ">{s.sepSpace}</option>
                <option value=".">{s.sepDot}</option>
              </Select>
            </Field>
            <div className={CHECKS}>
              <Toggle label={s.capitalize} checked={capitalize} onChange={setCapitalize} testid="pw-capitalize" />
              <Toggle label={s.addNumber} checked={addNumber} onChange={setAddNumber} testid="pw-number" />
            </div>
          </>
        )}
      </div>

      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}

const CONTROL = 'grid gap-[0.5rem] [&>label]:text-[0.82rem] [&>label]:font-semibold [&>label]:text-ink-soft [&>label]:flex [&>label]:justify-between'
const CHECKS = 'grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[0.6rem_1rem]'
const STRENGTH: Record<Strength, { w: string; bar: string; label: string }> = {
  weak: { w: '25%', bar: 'var(--danger)', label: 'text-[color:var(--danger)]' },
  fair: { w: '50%', bar: 'var(--gold-500)', label: 'text-gold-500' },
  strong: { w: '78%', bar: 'var(--green-500)', label: 'text-green-600' },
  excellent: { w: '100%', bar: 'var(--green-600)', label: 'text-green-600' },
}

function Toggle({ label, checked, onChange, testid }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; testid: string
}) {
  return (
    <Check>
      <input type="checkbox" checked={checked} data-testid={testid}
        onChange={(e) => onChange(e.target.checked)} />
      {label}
    </Check>
  )
}
