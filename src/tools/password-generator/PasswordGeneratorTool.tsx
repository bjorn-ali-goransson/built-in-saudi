import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, DownloadIcon } from '../../components/icons'
import {
  generatePassword, generatePassphrase, passwordEntropy, phraseEntropy,
  strength, type Strength,
} from './build'
import { WORDS } from './words'

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

  return (
    <div className="pw" data-testid="password-generator">
      <div className="pw__out" data-testid="pw-output-wrap">
        <label className="field__label" htmlFor="pw-output">{s.output}</label>
        <div className="pw__out-row">
          <output id="pw-output" className="pw__value" data-testid="pw-output" dir="ltr">
            {noSet ? <span className="pw__empty">{s.empty}</span> : value}
          </output>
          <button className="btn pw__regen" onClick={regenerate} disabled={noSet}
            aria-label={s.regenerateAria} title={s.regenerate} data-testid="pw-regenerate">
            <DownloadIcon className="pw__regen-icon" />
          </button>
          <button className="btn btn--primary" onClick={copy} disabled={noSet || !value}
            aria-label={s.copy} data-testid="pw-copy">
            <CopyIcon /> {copied ? s.copied : s.copy}
          </button>
        </div>
        {!noSet && (
          <div className={`pw__strength pw__strength--${level}`} data-testid="pw-strength"
            role="status" aria-label={`${s.strength}: ${s.levels[level]}`}>
            <span className="pw__strength-bar"><span /></span>
            <span className="pw__strength-label">{s.levels[level]} · {s.bits(bits)}</span>
          </div>
        )}
      </div>

      <div className="pw__panel">
        <div className="seg" role="group" aria-label={s.strength}>
          {(['password', 'passphrase'] as Mode[]).map((m) => (
            <button key={m} className={`seg__btn ${mode === m ? 'is-active' : ''}`}
              aria-pressed={mode === m} data-testid={`pw-mode-${m}`}
              onClick={() => setMode(m)}>{s[m]}</button>
          ))}
        </div>

        {mode === 'password' ? (
          <>
            <div className="qr__control">
              <label htmlFor="pw-length">{s.length} <span className="muted">{length}</span></label>
              <input id="pw-length" type="range" min={6} max={64} value={length}
                data-testid="pw-length" aria-label={s.length}
                onChange={(e) => setLength(Number(e.target.value))} />
            </div>
            <div className="pw__checks">
              <Toggle label={s.lowercase} checked={lower} onChange={setLower} testid="pw-lower" />
              <Toggle label={s.uppercase} checked={upper} onChange={setUpper} testid="pw-upper" />
              <Toggle label={s.digits} checked={digits} onChange={setDigits} testid="pw-digits" />
              <Toggle label={s.symbols} checked={symbols} onChange={setSymbols} testid="pw-symbols" />
              <Toggle label={s.excludeAmbiguous} checked={excludeAmbiguous} onChange={setExcludeAmbiguous} testid="pw-ambiguous" />
            </div>
          </>
        ) : (
          <>
            <div className="qr__control">
              <label htmlFor="pw-words">{s.words} <span className="muted">{words}</span></label>
              <input id="pw-words" type="range" min={3} max={8} value={words}
                data-testid="pw-words" aria-label={s.words}
                onChange={(e) => setWords(Number(e.target.value))} />
            </div>
            <label className="field">
              <span className="field__label">{s.separator}</span>
              <select className="input" value={separator} data-testid="pw-separator"
                aria-label={s.separator} onChange={(e) => setSeparator(e.target.value)}>
                <option value="-">{s.sepDash}</option>
                <option value=" ">{s.sepSpace}</option>
                <option value=".">{s.sepDot}</option>
              </select>
            </label>
            <div className="pw__checks">
              <Toggle label={s.capitalize} checked={capitalize} onChange={setCapitalize} testid="pw-capitalize" />
              <Toggle label={s.addNumber} checked={addNumber} onChange={setAddNumber} testid="pw-number" />
            </div>
          </>
        )}
      </div>

      <p className="qr__privacy"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </div>
  )
}

function Toggle({ label, checked, onChange, testid }: {
  label: string; checked: boolean; onChange: (v: boolean) => void; testid: string
}) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} data-testid={testid}
        onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
