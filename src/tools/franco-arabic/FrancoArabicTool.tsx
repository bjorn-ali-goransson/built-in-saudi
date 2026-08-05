import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Seg, SegButton, Panel } from '../../components/ui'
import { CopyIcon, ExchangeIcon } from '../../components/icons'
import { toArabic, toFranco, looksFranco } from './translit'

const SAMPLE = 'ya 3ammi wesh a5barak? el7amdulillah kolo tamam, shukran 7abibi'

const STR = {
  en: {
    toAr: 'Franco → Arabic', toFr: 'Arabic → Franco',
    placeholder: 'ya 3ammi wesh a5barak…',
    placeholderAr: 'اكتب نصًا عربيًا…',
    hint: 'Franco-Arabic — the chat alphabet where 3 is ع, 7 is ح and 5 is خ — turned into real Arabic script, and back again.',
    sample: 'Try an example',
    out: 'Result', copy: 'Copy', copied: 'Copied!', swap: 'Swap direction',
    ambiguous: 'Letters worth checking',
    ambiguousNote: 'Franco is ambiguous by design: s can be س or ص, t can be ت or ط. The common reading is used here — read the result before sending it.',
    key: 'The digit letters',
  },
  ar: {
    toAr: 'فرانكو ← عربي', toFr: 'عربي ← فرانكو',
    placeholder: 'ya 3ammi wesh a5barak…',
    placeholderAr: 'اكتب نصًا عربيًا…',
    hint: 'الفرانكو — أبجدية الدردشة حيث ٣ تعني ع و٧ تعني ح و٥ تعني خ — تتحوّل إلى حروف عربية حقيقية، والعكس.',
    sample: 'جرّب مثالًا',
    out: 'الناتج', copy: 'نسخ', copied: 'تم النسخ!', swap: 'اعكس الاتجاه',
    ambiguous: 'حروف تستحق المراجعة',
    ambiguousNote: 'الفرانكو ملتبس بطبيعته: s قد تكون س أو ص، وt قد تكون ت أو ط. تُستخدم هنا القراءة الشائعة — راجع الناتج قبل إرساله.',
    key: 'حروف الأرقام',
  },
}

const KEY: [string, string][] = [
  ['2', 'ء'], ['3', 'ع'], ["3'", 'غ'], ['5', 'خ'], ['6', 'ط'],
  ["6'", 'ظ'], ['7', 'ح'], ['8', 'ق'], ['9', 'ص'], ["9'", 'ض'],
]

export default function FrancoArabicTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [dir, setDir] = useState<'toAr' | 'toFr'>('toAr')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => {
    if (!text.trim()) return { text: '', ambiguous: [] as string[] }
    return dir === 'toAr' ? toArabic(text) : { text: toFranco(text), ambiguous: [] }
  }, [text, dir])

  // If the input is plainly the other script, offer the flip rather than
  // producing nonsense.
  const wrongWay = text.trim() !== '' && (dir === 'toAr' ? !looksFranco(text) : looksFranco(text))

  async function copy() {
    if (!result.text) return
    try { await navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function swap() {
    setDir(dir === 'toAr' ? 'toFr' : 'toAr')
    setText(result.text || text)
  }

  return (
    <Stack data-testid="franco-arabic">
      <Seg>
        <SegButton active={dir === 'toAr'} data-testid="fa-toar" onClick={() => setDir('toAr')}>{s.toAr}</SegButton>
        <SegButton active={dir === 'toFr'} data-testid="fa-tofr" onClick={() => setDir('toFr')}>{s.toFr}</SegButton>
      </Seg>

      <Textarea className={`min-h-[7rem] ${dir === 'toFr' ? 'font-ar' : 'font-mono'}`}
        dir={dir === 'toFr' ? 'rtl' : 'ltr'} data-testid="fa-input"
        placeholder={dir === 'toAr' ? s.placeholder : s.placeholderAr}
        value={text} onChange={(e) => setText(e.target.value)} />

      {!text.trim() && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => { setDir('toAr'); setText(SAMPLE) }} data-testid="fa-sample">{s.sample}</Button>
        </div>
      )}

      {wrongWay && (
        <Button className="self-start" onClick={swap} data-testid="fa-swap"><ExchangeIcon /> {s.swap}</Button>
      )}

      {result.text && (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.out}</span>
            <Button className="px-3 py-1" onClick={swap} data-testid="fa-swap2"><ExchangeIcon /> {s.swap}</Button>
            <Button className="px-3 py-1" onClick={copy} data-testid="fa-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly className={`min-h-[7rem] ${dir === 'toAr' ? 'font-ar text-[1.15rem]' : 'font-mono'}`}
            dir={dir === 'toAr' ? 'rtl' : 'ltr'} data-testid="fa-output"
            value={result.text} onFocus={(e) => e.currentTarget.select()} />

          {result.ambiguous.length > 0 && (
            <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="fa-ambiguous">
              <span className="text-ink-faint">{s.ambiguous}: </span>
              <span className="font-mono">{result.ambiguous.join(' · ')}</span>
            </p>
          )}
          <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.ambiguousNote}</p></Panel>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.key}</h2>
        <div className="flex flex-wrap gap-2" data-testid="fa-key">
          {KEY.map(([digit, letter]) => (
            <span key={digit} className="flex items-center gap-1.5 border border-[color:var(--line)] rounded-sm px-2 py-1 bg-[var(--surface)]">
              <span className="font-mono text-[0.9rem] text-ink-faint">{digit}</span>
              <span className="text-ink-faint">=</span>
              <span className="font-ar text-[1.1rem] text-ink">{letter}</span>
            </span>
          ))}
        </div>
      </section>
    </Stack>
  )
}
