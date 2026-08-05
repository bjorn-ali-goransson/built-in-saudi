import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { CopyIcon, ShareIcon } from '../../components/icons'
import { Button, Textarea, Stack } from '../../components/ui'
import { repair, looksDamaged, type Attempt } from './repair'

const SAMPLE = 'Ø§Ù„Ø³Ù„Ø§Ù… Ø¹Ù„ÙŠÙƒÙ…'

const STR = {
  en: {
    placeholder: 'Paste the garbled text…',
    hint: 'Paste text that came out as Ø§Ù„ or â€™ instead of readable characters. This works out which encoding mangled it and undoes the damage.',
    tryIt: 'Try it with a broken example',
    out: 'Repaired', copy: 'Copy', copied: 'Copied!', share: 'Share',
    best: 'Best match', other: 'Other readings',
    via: (cp: string, r: number) => `decoded as ${cp}${r > 1 ? ` × ${r}` : ''}`,
    nothing: 'This text already looks intact — nothing to repair.',
    failed: 'Could not recover this one. It may have been damaged in a way that destroyed the original bytes, in which case no tool can bring them back.',
    lossy: 'Heads up: if the text was saved after being mangled, some characters are genuinely gone and cannot be recovered — check the result before trusting it.',
  },
  ar: {
    placeholder: 'الصق النص المشوّه…',
    hint: 'الصق نصًا ظهر على شكل Ø§Ù„ أو â€™ بدل الحروف المقروءة. تكتشف الأداة الترميز الذي أفسده وتُلغي الضرر.',
    tryIt: 'جرّبها بمثال معطوب',
    out: 'النص المُصلَح', copy: 'نسخ', copied: 'تم النسخ!', share: 'مشاركة',
    best: 'أفضل تطابق', other: 'قراءات أخرى',
    via: (cp: string, r: number) => `قُرئ كـ ${cp}${r > 1 ? ` × ${r}` : ''}`,
    nothing: 'يبدو هذا النص سليمًا — لا شيء لإصلاحه.',
    failed: 'تعذّر استرجاع هذا النص. ربما أُتلف بطريقة دمّرت البايتات الأصلية، وعندها لا تستطيع أي أداة إعادتها.',
    lossy: 'تنبيه: إذا حُفظ النص بعد تشوّهه فقد ضاعت بعض الحروف فعلًا ولا يمكن استرجاعها — راجع الناتج قبل الاعتماد عليه.',
  },
}

export default function FixEncodingTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [pick, setPick] = useState(0)
  const [copied, setCopied] = useState(false)

  const attempts = useMemo(() => repair(text), [text])
  const damaged = useMemo(() => looksDamaged(text), [text])
  const chosen: Attempt | undefined = attempts[Math.min(pick, attempts.length - 1)]

  async function copy() {
    if (!chosen) return
    try { await navigator.clipboard.writeText(chosen.text); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }
  async function share() {
    if (!chosen) return
    if (navigator.share) { try { await navigator.share({ text: chosen.text }); return } catch { /* cancelled */ } }
    copy()
  }

  return (
    <Stack data-testid="fix-encoding">
      <Textarea className="min-h-[7rem]" dir="auto" data-testid="enc-input"
        placeholder={s.placeholder} value={text} onChange={(e) => { setText(e.target.value); setPick(0) }} />

      {text.trim() === '' && (
        <div className="flex flex-col gap-2">
          <p className="text-ink-faint text-[0.95rem]">{s.hint}</p>
          <Button className="self-start" data-testid="enc-sample" onClick={() => { setText(SAMPLE); setPick(0) }}>{s.tryIt}</Button>
        </div>
      )}

      {text.trim() !== '' && attempts.length === 0 && (
        <p className="text-[0.95rem] text-ink-soft" data-testid="enc-none">{damaged ? s.failed : s.nothing}</p>
      )}

      {chosen && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint flex-1">{s.out}</span>
            <Button className="flex-none px-3" onClick={share} data-testid="enc-share"><ShareIcon /> {s.share}</Button>
            <Button className="flex-none px-3" onClick={copy} data-testid="enc-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </div>
          <Textarea readOnly dir="auto" className="min-h-[7rem]" data-testid="enc-output" value={chosen.text} onFocus={(e) => e.currentTarget.select()} />
          <p className="text-[0.85rem] text-ink-faint font-mono" data-testid="enc-via">{s.via(chosen.cp, chosen.rounds)}</p>

          {attempts.length > 1 && (
            <div className="flex flex-col gap-1 mt-1">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.other}</span>
              <div className="flex flex-wrap gap-2">
                {attempts.map((a, i) => (
                  <button key={`${a.cp}-${a.rounds}`} data-testid={`enc-alt-${i}`} onClick={() => setPick(i)}
                    className={`text-start border rounded-sm px-2 py-1 max-w-[18rem] truncate text-[0.85rem] ${i === Math.min(pick, attempts.length - 1) ? 'border-green-600 bg-[color-mix(in_srgb,var(--color-green-400)_14%,transparent)] text-ink' : 'border-[color:var(--line)] bg-[var(--surface)] text-ink-soft'}`}>
                    <span dir="auto">{a.text.slice(0, 40)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <p className="text-[0.85rem] text-gold-500">{s.lossy}</p>
        </div>
      )}
    </Stack>
  )
}
