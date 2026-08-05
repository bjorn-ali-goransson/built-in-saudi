import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Check, Seg, SegButton, Panel } from '../../components/ui'
import { CopyIcon, DownloadIcon, RedactIcon } from '../../components/icons'
import { RULES, DEFAULT_ENABLED, anonymize, scan, type Kind, type Mode } from './patterns'

const SAMPLE = `name,email,phone,iban,id
Ahmed Al-Otaibi,ahmed@example.com,0501234567,SA0380000000608010167519,1023456789
Fatimah Noor,fatimah.n@example.org,+966 56 111 2222,SA4420000001234567891234,2098765432`

const STR = {
  en: {
    paste: 'Paste the data you are about to share…',
    hint: 'Before you send a spreadsheet to a colleague, a vendor or a chatbot, strip the parts that identify a person. Everything happens in this page — the data you paste never leaves it, which is rather the point.',
    sample: 'Try it with sample data',
    find: 'What to remove', mode: 'How',
    mask: 'Mask', redact: 'Redact', pseudonym: 'Replace with labels',
    keepTail: 'Keep the last 4 characters, so rows stay distinguishable',
    found: 'Found', nothing: 'No personal data matched — check the list above covers what this file holds.',
    copy: 'Copy', copied: 'Copied!', download: 'Download',
    result: 'Cleaned data',
    caveat: 'This finds patterns, not meaning. It will not catch a person’s name, a job title or a free-text note that identifies someone — read the result before you share it.',
    modeHint: {
      mask: 'Replaces the characters but keeps the shape, so a column still looks like a column.',
      redact: 'Replaces the whole value with [redacted]. Nothing survives, including how many distinct values there were.',
      pseudonym: 'The same value always becomes the same label, so the data still joins on itself without revealing anyone.',
    } as Record<Mode, string>,
  },
  ar: {
    paste: 'الصق البيانات التي تنوي مشاركتها…',
    hint: 'قبل أن ترسل جدولًا إلى زميل أو مورّد أو روبوت محادثة، أزل ما يدل على الأشخاص. كل شيء يجري داخل هذه الصفحة — ولا تغادرها البيانات التي تلصقها، وهذا هو المقصود.',
    sample: 'جرّبها ببيانات نموذجية',
    find: 'ما الذي يُزال', mode: 'الطريقة',
    mask: 'إخفاء', redact: 'حجب', pseudonym: 'استبدال بعلامات',
    keepTail: 'أبقِ آخر ٤ محارف ليبقى تمييز الصفوف ممكنًا',
    found: 'وُجد', nothing: 'لم تُطابق أي بيانات شخصية — تأكّد أن القائمة أعلاه تغطي ما في هذا الملف.',
    copy: 'نسخ', copied: 'تم النسخ!', download: 'تنزيل',
    result: 'البيانات بعد التنظيف',
    caveat: 'تبحث الأداة عن أنماط لا عن معانٍ. فلن تلتقط اسم شخص أو مسمّى وظيفيًا أو ملاحظة حرة تدل عليه — راجع الناتج قبل مشاركته.',
    modeHint: {
      mask: 'يستبدل المحارف مع الحفاظ على الشكل، فيبقى العمود شبيهًا بعمود.',
      redact: 'يستبدل القيمة كلها بـ[redacted]، فلا يبقى شيء، ولا حتى عدد القيم المختلفة.',
      pseudonym: 'تتحوّل القيمة نفسها دائمًا إلى العلامة نفسها، فتبقى البيانات قابلة للربط دون كشف أحد.',
    } as Record<Mode, string>,
  },
}

export default function DataAnonymizeTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [enabled, setEnabled] = useState<Record<Kind, boolean>>(DEFAULT_ENABLED)
  const [mode, setMode] = useState<Mode>('mask')
  const [keepTail, setKeepTail] = useState(true)
  const [copied, setCopied] = useState(false)

  const found = useMemo(() => (text.trim() ? scan(text) : null), [text])
  const result = useMemo(
    () => (text.trim() ? anonymize(text, { enabled, mode, keepTail }) : null),
    [text, enabled, mode, keepTail],
  )
  const totalFound = found ? Object.values(found).reduce((a, b) => a + b, 0) : 0

  async function copy() {
    if (!result) return
    try { await navigator.clipboard.writeText(result.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  function download() {
    if (!result) return
    const blob = new Blob(['﻿', result.text], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'anonymized.csv'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <Stack data-testid="data-anonymize">
      <Textarea className="min-h-[9rem] font-mono text-[0.85rem]" dir="ltr" data-testid="da-input"
        placeholder={s.paste} value={text} onChange={(e) => setText(e.target.value)} />

      {!text.trim() && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => setText(SAMPLE)} data-testid="da-sample">{s.sample}</Button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.find}</span>
        <div className="grid gap-x-5 gap-y-2 grid-cols-1 min-[560px]:grid-cols-2 min-[860px]:grid-cols-3">
          {RULES.map((r) => (
            <Check key={r.kind}>
              <input type="checkbox" checked={enabled[r.kind]} data-testid={`da-${r.kind}`}
                onChange={(e) => setEnabled({ ...enabled, [r.kind]: e.target.checked })} />
              <span className="rtl:font-ar">{locale === 'ar' ? r.ar : r.en}</span>
              {found && found[r.kind] > 0 && (
                <span className="font-mono text-[0.75rem] text-green-700">{found[r.kind]}</span>
              )}
            </Check>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.mode}</span>
        <Seg>
          <SegButton active={mode === 'mask'} data-testid="da-mask" onClick={() => setMode('mask')}>{s.mask}</SegButton>
          <SegButton active={mode === 'redact'} data-testid="da-redact" onClick={() => setMode('redact')}>{s.redact}</SegButton>
          <SegButton active={mode === 'pseudonym'} data-testid="da-pseudonym" onClick={() => setMode('pseudonym')}>{s.pseudonym}</SegButton>
        </Seg>
        {mode === 'mask' && (
          <Check>
            <input type="checkbox" checked={keepTail} data-testid="da-tail" onChange={(e) => setKeepTail(e.target.checked)} /> {s.keepTail}
          </Check>
        )}
      </div>
      <p className="text-[0.85rem] text-ink-faint rtl:font-ar" data-testid="da-modehint">{s.modeHint[mode]}</p>

      {result && (
        <>
          {totalFound === 0 ? (
            <p className="text-[0.95rem] text-ink-soft rtl:font-ar" data-testid="da-none">{s.nothing}</p>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.result}</span>
              <Button className="px-3 py-1" onClick={copy} data-testid="da-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
              <Button variant="primary" className="px-3 py-1" onClick={download} data-testid="da-download"><DownloadIcon /> {s.download}</Button>
            </div>
          )}
          <Textarea readOnly dir="ltr" className="min-h-[9rem] font-mono text-[0.85rem]"
            data-testid="da-output" value={result.text} onFocus={(e) => e.currentTarget.select()} />
        </>
      )}

      <Panel className="flex items-start gap-2">
        <RedactIcon className="text-gold-500 flex-none mt-0.5" />
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.caveat}</p>
      </Panel>
    </Stack>
  )
}
