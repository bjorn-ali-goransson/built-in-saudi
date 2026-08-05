import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Panel } from '../../components/ui'
import { CopyIcon, ExternalLinkIcon } from '../../components/icons'

// The Saudi National Address short code: four letters then four digits, e.g.
// RRRD2929. The four letters narrow down region → branch → division → a unique
// code for the entrance; the four digits are the building number.
//
// This tool checks the FORMAT and explains the parts. It deliberately does not
// claim to resolve a code to a street: only Saudi Post holds that mapping, and
// a tool that guessed at it would be confidently wrong about where a delivery
// goes. What it can do — and what people actually get wrong — is catch a code
// typed in the wrong order, with a space, with a zero for an O, or four letters
// short.

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'

export type Issue =
  | 'empty' | 'too-short' | 'too-long' | 'order' | 'letters' | 'digits' | 'ok'

export interface Parsed {
  letters: string
  digits: string
  normalised: string
  issue: Issue
  /** Characters we corrected on the way in, worth showing rather than hiding. */
  fixed: string[]
}

// The confusions that actually happen when reading a code off a paper slip or a
// screenshot. Correcting them silently would be wrong; correcting them and
// SAYING SO is the useful behaviour.
const LETTER_FIXES: Record<string, string> = { '0': 'O', '1': 'I', '5': 'S', '8': 'B' }
const DIGIT_FIXES: Record<string, string> = { O: '0', o: '0', I: '1', l: '1', S: '5', B: '8' }

export function parseShortAddress(input: string): Parsed {
  const fixed: string[] = []
  // Arabic-Indic digits are common on Saudi paperwork.
  const raw = input.trim().replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)))
  const clean = raw.replace(/[\s-]/g, '').toUpperCase()

  if (!clean) return { letters: '', digits: '', normalised: '', issue: 'empty', fixed }
  if (clean.length < 8) return { letters: '', digits: '', normalised: clean, issue: 'too-short', fixed }
  if (clean.length > 8) return { letters: '', digits: '', normalised: clean, issue: 'too-long', fixed }

  const head = clean.slice(0, 4)
  const tail = clean.slice(4)

  // Digits first is the classic transposition — someone reads the building
  // number off the sign and types it before the code.
  if (/^\d{4}$/.test(head) && /^[A-Z]{4}$/.test(tail)) {
    return { letters: tail, digits: head, normalised: tail + head, issue: 'order', fixed }
  }

  let letters = ''
  for (const ch of head) {
    if (/[A-Z]/.test(ch)) { letters += ch; continue }
    const f = LETTER_FIXES[ch]
    if (f) { letters += f; fixed.push(`${ch}→${f}`); continue }
    return { letters: head, digits: tail, normalised: clean, issue: 'letters', fixed }
  }

  let digits = ''
  for (const ch of tail) {
    if (/\d/.test(ch)) { digits += ch; continue }
    const f = DIGIT_FIXES[ch]
    if (f) { digits += f; fixed.push(`${ch}→${f}`); continue }
    return { letters: head, digits: tail, normalised: clean, issue: 'digits', fixed }
  }

  return { letters, digits, normalised: letters + digits, issue: 'ok', fixed }
}

const STR = {
  en: {
    input: 'Short address', placeholder: 'RRRD2929',
    hint: 'Check a National Address short code before you put it on a shipment. Four letters then four digits — this catches the ways that goes wrong.',
    valid: 'Valid format',
    parts: 'What the parts mean',
    region: 'Region', branch: 'Branch', division: 'Division', unique: 'Entrance', building: 'Building number',
    copy: 'Copy', copied: 'Copied!',
    fixedLabel: 'Corrected as you typed:',
    lookup: 'Look it up at Saudi Post',
    cannotResolve: 'This checks the format only. Only Saudi Post can turn a code into an actual address, so use their lookup for that — a tool that guessed would be confidently wrong about where a parcel goes.',
    issues: {
      'too-short': 'A short address is exactly eight characters: four letters then four digits.',
      'too-long': 'That is longer than eight characters. A short address is four letters then four digits.',
      order: 'The digits came first. A short address is four LETTERS then four digits — the corrected form is below.',
      letters: 'The first four characters must all be letters.',
      digits: 'The last four characters must all be digits — that is the building number.',
    } as Record<string, string>,
    example: 'Try an example',
    mandatory: 'A short address is required for customs clearance and last-mile delivery, which is why an incorrect one stalls a shipment rather than merely misdirecting it.',
  },
  ar: {
    input: 'العنوان المختصر', placeholder: 'RRRD2929',
    hint: 'تحقّق من رمز العنوان الوطني المختصر قبل وضعه على شحنة. أربعة حروف ثم أربعة أرقام — وهذه الأداة تلتقط ما يختل في ذلك.',
    valid: 'الصيغة صحيحة',
    parts: 'معنى الأجزاء',
    region: 'المنطقة', branch: 'الفرع', division: 'القسم', unique: 'المدخل', building: 'رقم المبنى',
    copy: 'نسخ', copied: 'تم النسخ!',
    fixedLabel: 'صُحّح أثناء الكتابة:',
    lookup: 'ابحث عنه في البريد السعودي',
    cannotResolve: 'تتحقق هذه الأداة من الصيغة فقط. والبريد السعودي وحده يحوّل الرمز إلى عنوان فعلي، فاستخدم بحثهم لذلك — فأداة تخمّن ستكون واثقة ومخطئة بشأن وجهة الشحنة.',
    issues: {
      'too-short': 'العنوان المختصر ثمانية محارف بالضبط: أربعة حروف ثم أربعة أرقام.',
      'too-long': 'هذا أطول من ثمانية محارف. العنوان المختصر أربعة حروف ثم أربعة أرقام.',
      order: 'جاءت الأرقام أولًا. العنوان المختصر أربعة حروف ثم أربعة أرقام — والصيغة المصحّحة أدناه.',
      letters: 'المحارف الأربعة الأولى يجب أن تكون حروفًا كلها.',
      digits: 'المحارف الأربعة الأخيرة يجب أن تكون أرقامًا كلها — وهي رقم المبنى.',
    } as Record<string, string>,
    example: 'جرّب مثالًا',
    mandatory: 'العنوان المختصر مطلوب للتخليص الجمركي والتوصيل الأخير، ولهذا يوقف الرمزُ الخاطئ الشحنةَ بدل أن يوجّهها إلى مكان آخر فحسب.',
  },
}

export default function ShortAddressTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  const p = useMemo(() => parseShortAddress(text), [text])
  const ok = p.issue === 'ok' || p.issue === 'order'

  async function copy() {
    if (!p.normalised) return
    try { await navigator.clipboard.writeText(p.normalised); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const parts: [string, string][] = ok ? [
    [s.region, p.letters[0]],
    [s.branch, p.letters[1]],
    [s.division, p.letters[2]],
    [s.unique, p.letters[3]],
    [s.building, p.digits],
  ] : []

  return (
    <Stack data-testid="short-address">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.input}
        <Input dir="ltr" className="text-[1.4rem] font-mono tracking-[0.18em] uppercase" data-testid="sa-input"
          placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      {p.issue === 'empty' && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => setText('RRRD2929')} data-testid="sa-example">{s.example}</Button>
        </div>
      )}

      {p.issue !== 'empty' && p.issue !== 'ok' && (
        <p className="text-[0.95rem] text-gold-500 rtl:font-ar" data-testid="sa-issue">{s.issues[p.issue]}</p>
      )}

      {p.fixed.length > 0 && (
        <p className="text-[0.85rem] text-ink-faint" data-testid="sa-fixed">
          <span className="rtl:font-ar">{s.fixedLabel} </span>
          <b className="font-mono">{p.fixed.join('  ')}</b>
        </p>
      )}

      {ok && (
        <>
          <Panel className="flex flex-wrap items-center gap-4">
            <span className="font-mono text-[clamp(1.6rem,7vw,2.4rem)] text-ink tracking-[0.2em]" data-testid="sa-normalised">
              {p.letters}{p.digits}
            </span>
            {p.issue === 'ok' && <span className="text-[0.95rem] text-green-700 rtl:font-ar" data-testid="sa-valid">{s.valid}</span>}
            <Button className="px-3 py-1" onClick={copy} data-testid="sa-copy"><CopyIcon /> {copied ? s.copied : s.copy}</Button>
          </Panel>

          <section className="flex flex-col gap-2">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.parts}</h2>
            <div className="flex flex-wrap gap-2" data-testid="sa-parts">
              {parts.map(([label, value]) => (
                <div key={label} className="flex flex-col items-center border border-[color:var(--line)] rounded-md bg-[var(--surface)] px-4 py-2">
                  <span className="font-mono text-[1.3rem] text-ink">{value}</span>
                  <span className="text-[0.72rem] text-ink-faint rtl:font-ar">{label}</span>
                </div>
              ))}
            </div>
          </section>

          <Button href="https://splonline.com.sa/en/national-address-1/" target="_blank" rel="noopener noreferrer"
            className="self-start" data-testid="sa-lookup">
            <ExternalLinkIcon /> {s.lookup}
          </Button>
        </>
      )}

      <Panel className="flex flex-col gap-1">
        <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.cannotResolve}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.mandatory}</p>
      </Panel>
    </Stack>
  )
}
