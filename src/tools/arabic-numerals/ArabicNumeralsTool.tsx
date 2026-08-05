import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, ShareIcon, ExchangeIcon } from '../../components/icons'
import { Button, Textarea, Stack, Seg, SegButton, Check } from '../../components/ui'
import { convert, detect, countDigits, suggestTarget, type Script } from './convert'

const STR = {
  en: {
    placeholder: 'Paste text with numbers in it…',
    hint: 'Paste anything — a sentence, a table, a whole document. Only the digits change; every other character is left exactly as it was.',
    to: 'Convert digits to',
    western: 'Western 0123', arabic: 'Arabic ٠١٢٣', persian: 'Persian ۰۱۲۳',
    seps: 'Also convert decimal and thousands marks (. , ↔ ٫ ٬)',
    out: 'Result', copy: 'Copy', copied: 'Copied!', share: 'Share', swap: 'Flip',
    found: (n: number, names: string) => `${n} digit${n === 1 ? '' : 's'} found — currently ${names}.`,
    none: 'No digits found in this text yet.',
    names: { western: 'Western', arabic: 'Arabic-Indic', persian: 'Persian' } as Record<Script, string>,
  },
  ar: {
    placeholder: 'الصق نصًا يحتوي على أرقام…',
    hint: 'الصق أي شيء — جملة أو جدولًا أو مستندًا كاملًا. تتغيّر الأرقام فقط، ويبقى كل حرف آخر كما هو تمامًا.',
    to: 'حوّل الأرقام إلى',
    western: 'إنجليزية 0123', arabic: 'هندية ٠١٢٣', persian: 'فارسية ۰۱۲۳',
    seps: 'حوّل أيضًا علامتَي العشرية والآلاف (. , ↔ ٫ ٬)',
    out: 'الناتج', copy: 'نسخ', copied: 'تم النسخ!', share: 'مشاركة', swap: 'اقلب',
    found: (n: number, names: string) => `${n.toLocaleString('ar')} رقمًا — حاليًا ${names}.`,
    none: 'لا توجد أرقام في هذا النص بعد.',
    names: { western: 'إنجليزية', arabic: 'هندية', persian: 'فارسية' } as Record<Script, string>,
  },
}

// The Arabic UI names the scripts the way Saudi users do: the 0123 shapes are
// called "Arabic numerals" and the ٠١٢٣ shapes "Indian numerals" (أرقام هندية),
// which is the opposite of the Unicode names. Labelling them by code-point name
// would be technically right and practically confusing.
const SCRIPTS: Script[] = ['western', 'arabic', 'persian']

export default function ArabicNumeralsTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [target, setTarget] = useState<Script | null>(null)
  const [seps, setSeps] = useState(true)
  const [copied, setCopied] = useState(false)

  const present = useMemo(() => detect(text), [text])
  const digits = useMemo(() => countDigits(text), [text])
  const to = target ?? suggestTarget(text)
  const output = useMemo(() => convert(text, to, seps), [text, to, seps])

  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  async function share() {
    if (!output) return
    if (navigator.share) { try { await navigator.share({ text: output }); return } catch { /* cancelled */ } }
    copy()
  }
  function flip() {
    setText(output)
    setTarget(to === 'western' ? 'arabic' : 'western')
  }

  return (
    <Stack data-testid="arabic-numerals">
      <Textarea className="min-h-[8rem]" data-testid="num-input" dir="auto"
        placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.to}</span>
        <Seg>
          {SCRIPTS.map((sc) => (
            <SegButton key={sc} data-testid={`num-to-${sc}`} active={to === sc} aria-pressed={to === sc} onClick={() => setTarget(sc)}>
              {s[sc]}
            </SegButton>
          ))}
        </Seg>
      </div>
      <Check>
        <input type="checkbox" checked={seps} data-testid="num-seps" onChange={(e) => setSeps(e.target.checked)} /> {s.seps}
      </Check>

      <p className="text-[0.9rem] text-ink-faint" data-testid="num-detected">
        {digits === 0 ? s.none : s.found(digits, present.map((p) => s.names[p]).join(' + '))}
      </p>

      {text.trim() !== '' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.out}</span>
            <Button className="flex-none px-3" onClick={flip} data-testid="num-flip"><ExchangeIcon /> {s.swap}</Button>
            <Button className="flex-none px-3" onClick={share} data-testid="num-share"><ShareIcon /> {s.share}</Button>
            <Button className="flex-none px-3" onClick={copy} data-testid="num-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly dir="auto" className="min-h-[8rem]" data-testid="num-output" value={output} onFocus={(e) => e.currentTarget.select()} />
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.hint}</p>
      )}
    </Stack>
  )
}
