import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, DownloadIcon, RefreshIcon } from '../../components/icons'
import {
  generatePassword, generatePassphrase, passwordEntropy, phraseEntropy,
  strength, type Strength,
} from './build'
import { WORDS } from './words'
import { Button, Seg, SegButton, Field, Input, Select, Check } from '../../components/ui'

type Mode = 'password' | 'passphrase'

/** The most a batch may be. Ten thousand sixteen-character passwords is ~17ms
 *  of generation and ~200KB of text, so the ceiling is a product decision
 *  rather than a performance one — past this nobody is reading the list, they
 *  want a file, and they can press the button again. */
const MAX_COUNT = 10000

/** How many lines the preview shows. The rest is one tap away in the copy and
 *  the download; rendering ten thousand line boxes to reassure somebody that a
 *  list exists is work done for nobody, and on a phone it is the slow part of
 *  the whole feature. */
const PREVIEW = 100

const STR = {
  en: {
    password: 'Password', passphrase: 'Passphrase',
    length: 'Length', lowercase: 'Lowercase', uppercase: 'Uppercase',
    digits: 'Digits', symbols: 'Symbols', excludeAmbiguous: 'Exclude look-alikes (I l 1 O 0 o)',
    words: 'Words', separator: 'Separator', capitalize: 'Capitalize', addNumber: 'Add a number',
    copy: 'Copy', copyAll: 'Copy all', copied: 'Copied!',
    regenerate: 'Regenerate', regenerateAria: 'Generate a new password',
    generate: 'Generate', download: 'Download',
    strength: 'Strength', bits: (n: string) => `${n} bits`,
    levels: { weak: 'Weak', fair: 'Fair', strong: 'Strong', excellent: 'Excellent' } as Record<Strength, string>,
    output: 'Generated password', outputMany: 'Generated passwords',
    empty: 'Select at least one character set.',
    count: 'How many',
    notYet: 'Nothing generated yet.',
    showing: (shown: string, total: string) => `Showing the first ${shown} of ${total} — copy or download for all of them.`,
    allShown: (total: string) => `${total}, one per line.`,
    dupes: (n: string, total: string) =>
      `${n} of these are repeats. At these settings there are not enough possible passwords to give ${total} different ones — make them longer, or add a character set.`,
    privacy: 'Generated locally — never sent anywhere.',
    sepDash: 'Dash (-)', sepSpace: 'Space', sepDot: 'Dot (.)',
  },
  ar: {
    password: 'كلمة مرور', passphrase: 'عبارة مرور',
    length: 'الطول', lowercase: 'أحرف صغيرة', uppercase: 'أحرف كبيرة',
    digits: 'أرقام', symbols: 'رموز', excludeAmbiguous: 'استبعاد المتشابهة (I l 1 O 0 o)',
    words: 'عدد الكلمات', separator: 'الفاصل', capitalize: 'حرف أول كبير', addNumber: 'إضافة رقم',
    copy: 'نسخ', copyAll: 'نسخ الكل', copied: 'تم النسخ!',
    regenerate: 'إعادة توليد', regenerateAria: 'توليد كلمة مرور جديدة',
    generate: 'توليد', download: 'تنزيل',
    strength: 'القوة', bits: (n: string) => `${n} بت`,
    levels: { weak: 'ضعيفة', fair: 'متوسطة', strong: 'قوية', excellent: 'ممتازة' } as Record<Strength, string>,
    output: 'كلمة المرور المُولّدة', outputMany: 'كلمات المرور المُولّدة',
    empty: 'اختر مجموعة أحرف واحدة على الأقل.',
    count: 'العدد',
    notYet: 'لم يُولَّد شيء بعد.',
    showing: (shown: string, total: string) => `تُعرض أول ${shown} من ${total} — انسخها أو نزّلها كاملةً.`,
    allShown: (total: string) => `${total}، كل واحدة في سطر.`,
    dupes: (n: string, total: string) =>
      `${n} منها مكرّرة. بهذه الإعدادات لا يوجد عدد كافٍ من كلمات المرور الممكنة ليكون بينها ${total} مختلفة — أطِل الطول أو أضِف مجموعة أحرف.`,
    privacy: 'تُنشأ محليًا — لا تُرسل إلى أي مكان.',
    sepDash: 'شرطة (-)', sepSpace: 'مسافة', sepDot: 'نقطة (.)',
  },
}

export default function PasswordGeneratorTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  /** Arabic-Indic on the Arabic side. `toLocaleString` is the only thing that
   *  does this; a template literal prints Latin digits whatever the locale,
   *  which is the failure this repo has shipped and caught three times. */
  const num = useCallback(
    (n: number) => n.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-US'),
    [locale],
  )

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

  const [count, setCount] = useState(1)
  const [values, setValues] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  const pwOpts = { length, lower, upper, digits, symbols, excludeAmbiguous }
  const phraseOpts = { words, separator, capitalize, number: addNumber }
  const noSet = mode === 'password' && !lower && !upper && !digits && !symbols
  const many = count > 1

  /** Entropy is per password, so a batch of ten thousand is no stronger and no
   *  weaker than one. Derived rather than held in state, which is what keeps
   *  the bar from ever describing settings that have since changed. */
  const bits = mode === 'password'
    ? passwordEntropy(pwOpts)
    : phraseEntropy(phraseOpts, WORDS.length)

  const makeOne = useCallback(
    () => (mode === 'password'
      ? generatePassword(pwOpts)
      : generatePassphrase(phraseOpts, WORDS)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mode, length, lower, upper, digits, symbols, excludeAmbiguous, words, separator, capitalize, addNumber],
  )

  const generate = useCallback(() => {
    setValues(Array.from({ length: count }, makeOne))
  }, [makeOne, count])

  /**
   * ONE password regenerates as you touch the controls; a BATCH does not.
   *
   * Live regeneration is what makes the sliders feel like sliders, and it is
   * affordable for one password. For ten thousand it would run on every
   * `pointermove` of the length slider — and worse, the list under the copy
   * button would keep silently becoming a different list from the one somebody
   * was looking at.
   *
   * So changing anything CLEARS a batch rather than rebuilding it, which is the
   * same rule the image editor's export follows: the moment the settings stop
   * describing the output, the output goes and the button offers to make a new
   * one. A stale list of passwords is worse than no list, because you cannot
   * tell by looking.
   */
  useEffect(() => {
    setValues(count === 1 ? [makeOne()] : [])
  }, [makeOne, count])

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const text = useMemo(() => values.join('\n'), [values])

  /**
   * The file is built when the batch is, and revoked when it is replaced.
   *
   * An anchor with a real `href` rather than a click handler that mints and
   * revokes a URL inline: the lifetime is then the effect's to manage, and the
   * e2e can read the actual bytes off the button the way the image editor's
   * export case does, instead of trusting that a download happened.
   */
  const [fileUrl, setFileUrl] = useState('')
  useEffect(() => {
    if (values.length < 2) { setFileUrl(''); return }
    const url = URL.createObjectURL(new Blob([`${text}\n`], { type: 'text/plain' }))
    setFileUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [values, text])

  /**
   * How many of the batch are repeats.
   *
   * Worth saying out loud, because it is invisible and it is exactly what goes
   * wrong at scale: six digits is a million possible passwords, and by the
   * birthday bound ten thousand draws from it collide about fifty times. Handing
   * that list out as though every row were distinct is the defect; a generator
   * that stayed quiet about it would be the incumbent behaviour.
   */
  const dupes = values.length > 1 ? values.length - new Set(values).size : 0

  async function copy() {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
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
        <label className="text-[0.82rem] font-semibold text-ink-soft tracking-[0.01em]" htmlFor="pw-output">
          {many ? s.outputMany : s.output}
        </label>
        <div className="flex gap-[0.6rem] items-stretch mt-[0.4rem] flex-wrap">
          {many ? (
            <pre id="pw-output" data-testid="pw-list" dir="ltr"
              className="flex-1 min-w-[12rem] m-0 max-h-[16rem] overflow-auto font-mono text-[0.95rem] leading-[1.5] whitespace-pre px-[0.9rem] py-[0.7rem] bg-sand-100 border border-[color:var(--line-soft)] rounded-[5px] text-ink">
              {noSet
                ? ''
                : values.length
                  ? values.slice(0, PREVIEW).join('\n')
                  : ''}
            </pre>
          ) : (
            <output id="pw-output" className="flex-1 min-w-[12rem] flex items-center font-mono text-[1.15rem] break-all px-[0.9rem] py-[0.7rem] bg-sand-100 border border-[color:var(--line-soft)] rounded-[5px] text-ink" data-testid="pw-output" dir="ltr">
              {noSet ? <span className="text-[color:var(--danger)] font-body text-[0.95rem]">{s.empty}</span> : values[0]}
            </output>
          )}
        </div>

        {many && !noSet && (
          <p className="text-[0.8rem] text-ink-faint mt-[0.5rem] rtl:font-ar" data-testid="pw-count-note">
            {!values.length
              ? s.notYet
              : values.length > PREVIEW
                ? s.showing(num(PREVIEW), num(values.length))
                : s.allShown(num(values.length))}
          </p>
        )}
        {many && noSet && (
          <p className="text-[0.8rem] text-[color:var(--danger)] mt-[0.5rem] rtl:font-ar">{s.empty}</p>
        )}

        <div className="flex gap-[0.6rem] mt-[0.6rem] flex-wrap">
          <Button className="flex-none px-[0.8rem]" onClick={generate} disabled={noSet}
            aria-label={many ? s.generate : s.regenerateAria} title={many ? s.generate : s.regenerate}
            data-testid="pw-regenerate">
            <RefreshIcon /> {many ? s.generate : s.regenerate}
          </Button>
          <Button variant="primary" className="flex-1 justify-center" onClick={copy} disabled={noSet || !text}
            aria-label={many ? s.copyAll : s.copy} data-testid="pw-copy">
            <CopyIcon /> {copied ? s.copied : (many ? s.copyAll : s.copy)}
          </Button>
          {many && fileUrl && (
            <Button variant="primary" className="flex-none px-[0.9rem] no-underline"
              href={fileUrl} download={`${mode === 'password' ? 'passwords' : 'passphrases'}-${values.length}.txt`}
              aria-label={s.download} title={s.download} data-testid="pw-download">
              <DownloadIcon /> {s.download}
            </Button>
          )}
        </div>

        {dupes > 0 && (
          <p className="text-[0.8rem] text-gold-500 mt-[0.7rem] rtl:font-ar" data-testid="pw-dupes">
            {s.dupes(num(dupes), num(values.length))}
          </p>
        )}

        {!noSet && (
          <div className="flex items-center gap-[0.7rem] mt-[0.9rem]" data-testid="pw-strength"
            role="status" aria-label={`${s.strength}: ${s.levels[level]}`}>
            <span className="flex-1 h-[7px] rounded-full bg-sand-200 overflow-hidden">
              <span className="block h-full rounded-full transition-[width,background] duration-[250ms]" style={{ width: st.w, background: st.bar }} />
            </span>
            <span className={`text-[0.82rem] font-semibold font-mono whitespace-nowrap rtl:font-ar ${st.label}`}>{s.levels[level]} · {s.bits(num(bits))}</span>
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
              <label htmlFor="pw-length">{s.length} <span className="text-ink-faint font-medium">{num(length)}</span></label>
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
              <label htmlFor="pw-words">{s.words} <span className="text-ink-faint font-medium">{num(words)}</span></label>
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

        {/* A number field rather than a slider: the useful values here are 1,
            and then whatever somebody was actually asked for — 250 seats, 1,000
            vouchers — and no slider from 1 to 10,000 can be aimed at those. */}
        <Field label={s.count}>
          <Input type="number" inputMode="numeric" min={1} max={MAX_COUNT} value={count}
            data-testid="pw-count" aria-label={s.count}
            onChange={(e) => {
              // Clamped on the way in, not by the browser: `min`/`max` on a
              // number input are advisory when the value is typed, so 99999
              // reaches state unless it is caught here. An empty field means
              // somebody is mid-edit, which is 1 rather than NaN.
              const n = Math.floor(Number(e.target.value))
              setCount(Number.isFinite(n) && n > 0 ? Math.min(n, MAX_COUNT) : 1)
            }} />
        </Field>
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
