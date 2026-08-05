import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, ShareIcon } from '../../components/icons'
import { Button, Textarea, Stack, Check } from '../../components/ui'
import { normalize, inspect, DEFAULTS, type Options } from './normalize'

type Key = keyof Options

const STR = {
  en: {
    placeholder: 'Paste Arabic text…',
    hint: 'Paste Arabic text to strip diacritics and unify the letter shapes that break search and comparison. Nothing is uploaded.',
    out: 'Result', copy: 'Copy', copied: 'Copied!', share: 'Share',
    removed: (n: number) => `${n} character${n === 1 ? '' : 's'} removed.`,
    unchanged: 'Nothing to normalise in this text.',
    found: 'Found in your text:',
    labels: {
      tashkeel: 'Remove diacritics (تَشْكِيل)',
      tatweel: 'Remove kashida stretching (ـــ)',
      alef: 'Unify alef: أ إ آ ٱ → ا',
      yaa: 'Unify yaa: ى → ي',
      taa: 'taa marbuta: ة → ه',
      hamza: 'Bare the hamza: ؤ ئ → ء',
      punctuation: 'Arabic punctuation → Latin (، ؛ ؟ → , ; ?)',
      spaces: 'Collapse extra spaces and blank lines',
      invisible: 'Strip invisible characters (ZWJ, marks, BOM)',
    } as Record<Key, string>,
    warn: 'Removing diacritics from a Quranic or poetic text changes it — keep that toggle off if the harakāt matter.',
  },
  ar: {
    placeholder: 'الصق نصًا عربيًا…',
    hint: 'الصق نصًا عربيًا لإزالة التشكيل وتوحيد أشكال الحروف التي تُفسد البحث والمقارنة. لا يُرفع أي شيء.',
    out: 'الناتج', copy: 'نسخ', copied: 'تم النسخ!', share: 'مشاركة',
    removed: (n: number) => `أُزيل ${n.toLocaleString('ar')} محرفًا.`,
    unchanged: 'لا شيء لتوحيده في هذا النص.',
    found: 'وُجد في نصك:',
    labels: {
      tashkeel: 'إزالة التشكيل (الحركات)',
      tatweel: 'إزالة التطويل (ـــ)',
      alef: 'توحيد الألف: أ إ آ ٱ ← ا',
      yaa: 'توحيد الياء: ى ← ي',
      taa: 'التاء المربوطة: ة ← ه',
      hamza: 'تجريد الهمزة: ؤ ئ ← ء',
      punctuation: 'ترقيم عربي ← لاتيني (، ؛ ؟ ← , ; ?)',
      spaces: 'دمج المسافات والأسطر الفارغة الزائدة',
      invisible: 'إزالة المحارف الخفية (ZWJ والعلامات وBOM)',
    } as Record<Key, string>,
    warn: 'إزالة التشكيل من نص قرآني أو شعري تُغيّره — أبقِ هذا الخيار مُطفأً إن كانت الحركات مهمة.',
  },
}

const ORDER: Key[] = ['tashkeel', 'tatweel', 'alef', 'yaa', 'taa', 'hamza', 'punctuation', 'spaces', 'invisible']
const FOUND_LABEL: Record<string, string> = {
  tashkeel: 'تشكيل', tatweel: 'ـــ', alef: 'أ إ آ', yaa: 'ى', taa: 'ة', hamza: 'ؤ ئ', invisible: '⌫',
}

export default function ArabicNormalizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [opts, setOpts] = useState<Options>(DEFAULTS)
  const [copied, setCopied] = useState(false)

  const { text: output, removed } = useMemo(() => normalize(text, opts), [text, opts])
  const found = useMemo(() => inspect(text), [text])
  const foundEntries = Object.entries(found).filter(([, n]) => n > 0)

  function toggle(k: Key) { setOpts((o) => ({ ...o, [k]: !o[k] })) }
  async function copy() {
    if (!output) return
    try { await navigator.clipboard.writeText(output); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  async function share() {
    if (!output) return
    if (navigator.share) { try { await navigator.share({ text: output }); return } catch { /* cancelled */ } }
    copy()
  }

  return (
    <Stack data-testid="arabic-normalize">
      <Textarea className="min-h-[8rem] font-ar" dir="rtl" data-testid="norm-input"
        placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />

      <div className="grid gap-x-5 gap-y-2 grid-cols-1 min-[640px]:grid-cols-2">
        {ORDER.map((k) => (
          <Check key={k}>
            <input type="checkbox" checked={opts[k]} data-testid={`norm-${k}`} onChange={() => toggle(k)} />
            <span className="rtl:font-ar">{s.labels[k]}</span>
          </Check>
        ))}
      </div>
      {opts.tashkeel && <p className="text-[0.85rem] text-gold-500 rtl:font-ar">{s.warn}</p>}

      {foundEntries.length > 0 && (
        <p className="text-[0.9rem] text-ink-faint flex flex-wrap gap-2 items-center" data-testid="norm-found">
          <span>{s.found}</span>
          {foundEntries.map(([k, n]) => (
            <span key={k} className="font-mono text-[0.8rem] border border-[color:var(--line)] rounded-sm px-[0.4rem] py-[0.1rem]">
              <span className="font-ar">{FOUND_LABEL[k] ?? k}</span> {n}
            </span>
          ))}
        </p>
      )}

      {text.trim() !== '' ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.out}</span>
            <Button className="flex-none px-3" onClick={share} data-testid="norm-share"><ShareIcon /> {s.share}</Button>
            <Button className="flex-none px-3" onClick={copy} data-testid="norm-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly dir="rtl" className="min-h-[8rem] font-ar" data-testid="norm-output" value={output} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-[0.9rem] text-green-700 rtl:font-ar" data-testid="norm-message">
            {removed > 0 ? s.removed(removed) : output !== text ? '' : s.unchanged}
          </p>
        </div>
      ) : (
        <p className="text-ink-faint text-[0.95rem]">{s.hint}</p>
      )}
    </Stack>
  )
}
