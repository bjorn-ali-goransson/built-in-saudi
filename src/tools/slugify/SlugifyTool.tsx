import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Stack, Input, Button, Seg, SegButton, Check, FieldLabel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'

const AR_MAP: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'i', آ: 'aa', ب: 'b', ت: 't', ث: 'th', ج: 'j', ح: 'h', خ: 'kh', د: 'd', ذ: 'dh', ر: 'r', ز: 'z', س: 's', ش: 'sh', ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh', ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n', ه: 'h', و: 'w', ي: 'y', ى: 'a', ة: 'h', ء: '', ئ: 'y', ؤ: 'w',
}

const STR = {
  en: { input: 'Text', output: 'Slug', sep: 'Separator', case: 'Case', lower: 'lower', upper: 'UPPER', dash: 'Hyphen -', underscore: 'Underscore _', translit: 'Transliterate Arabic', copy: 'Copy', copied: 'Copied!', privacy: 'Generated in your browser — nothing is uploaded.' },
  ar: { input: 'النص', output: 'السلَگ', sep: 'الفاصل', case: 'الحالة', lower: 'صغيرة', upper: 'كبيرة', dash: 'شرطة -', underscore: 'شرطة سفلية _', translit: 'تحويل العربية', copy: 'نسخ', copied: 'تم النسخ!', privacy: 'يُولَّد في متصفحك — لا يُرفع أي شيء.' },
}

export default function SlugifyTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('The Quick Brown Fox — نصٌّ عربي')
  const [sep, setSep] = useState('-')
  const [upper, setUpper] = useState(false)
  const [translit, setTranslit] = useState(true)
  const [copied, setCopied] = useState(false)

  const slug = useMemo(() => {
    let t = text
    if (translit) t = [...t].map((ch) => (AR_MAP[ch] !== undefined ? AR_MAP[ch] : ch)).join('')
    t = t.normalize('NFD').replace(/[̀-ͯ]/g, '') // strip Latin diacritics
    t = t.replace(/[ً-ْ]/g, '') // strip Arabic harakat
    t = t.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, sep).replace(new RegExp(`\\${sep}{2,}`, 'g'), sep).replace(new RegExp(`^\\${sep}|\\${sep}$`, 'g'), '')
    return upper ? t.toUpperCase() : t
  }, [text, sep, upper, translit])

  async function copy() { try { await navigator.clipboard.writeText(slug); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* */ } }

  return (
    <Stack data-testid="slugify">
      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.input}</FieldLabel>
        <Input value={text} onChange={(e) => setText(e.target.value)} className="text-[1.05rem]" data-testid="sl-input" /></label>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex flex-col gap-1"><FieldLabel>{s.sep}</FieldLabel>
          <Seg><SegButton active={sep === '-'} onClick={() => setSep('-')}>{s.dash}</SegButton>
            <SegButton active={sep === '_'} onClick={() => setSep('_')}>{s.underscore}</SegButton></Seg></div>
        <div className="flex flex-col gap-2 pt-5">
          <Check><input type="checkbox" checked={upper} onChange={(e) => setUpper(e.target.checked)} /> {s.upper}</Check>
          <Check><input type="checkbox" checked={translit} onChange={(e) => setTranslit(e.target.checked)} data-testid="sl-translit" /> {s.translit}</Check>
        </div>
      </div>

      <label className="flex flex-col gap-[0.4rem]"><FieldLabel>{s.output}</FieldLabel>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-[1.05rem] bg-[var(--surface)] border border-[color:var(--line-soft)] rounded-md px-3 py-2 break-all" dir="ltr" data-testid="sl-output">{slug || '—'}</code>
          <Button onClick={copy} disabled={!slug} data-testid="sl-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
        </div></label>
      <p className="text-[0.8rem] text-ink-faint flex items-center gap-[0.4rem]"><span aria-hidden="true">🔒</span> {s.privacy}</p>
    </Stack>
  )
}
