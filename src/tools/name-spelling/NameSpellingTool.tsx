import { useEffect, useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Field, Stack, Panel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import { analyseName, joinChoices } from './names'

const STR = {
  en: {
    input: 'The name in Arabic', placeholder: 'محمد عبدالله العتيبي',
    examples: 'Try an example',
    result: 'Your spelling', copy: 'Copy', copied: 'Copied!',
    common: 'used on documents', generated: 'assembled letter by letter',
    pick: 'Pick a spelling for each part',
    empty: 'Type a name in Arabic above.',
    headline: 'There is no correct spelling — only a consistent one',
    body: 'محمد is Mohammed, Muhammad, Mohamed, Mohammad and Muhammed on five passports in the same family, and every one of them is right. What matters is matching the document you already hold: a ticket that disagrees with a passport is a problem at the gate, whichever spelling reads better.',
    advice: 'So if you already have a passport, an iqama or a bank account, copy the spelling from it and stop. Use this when there is nothing to copy yet — a newborn, a first application — or to see which variants exist before you choose one to keep forever.',
    sourceNote: 'Spellings marked “used on documents” are ones that appear on real papers here. The rest are assembled from the letters, which is a reasonable guess and nothing more.',
  },
  ar: {
    input: 'الاسم بالعربية', placeholder: 'محمد عبدالله العتيبي',
    examples: 'جرّب مثالًا',
    result: 'كتابتك', copy: 'نسخ', copied: 'تم النسخ!',
    common: 'مستخدمة في الوثائق', generated: 'مركّبة حرفًا بحرف',
    pick: 'اختر كتابةً لكل جزء',
    empty: 'اكتب اسمًا بالعربية في الأعلى.',
    headline: 'لا توجد كتابة صحيحة — بل كتابة متّسقة',
    body: 'محمد تُكتب Mohammed وMuhammad وMohamed وMohammad وMuhammed في خمسة جوازات لأسرة واحدة، وكلها صحيحة. والمهم أن تطابق الوثيقة التي بيدك: فالتذكرة التي تخالف الجواز مشكلة عند البوابة، أيًّا كانت الكتابة الأجمل.',
    advice: 'فإن كان لديك جواز أو إقامة أو حساب بنكي، فانسخ الكتابة منه وتوقّف. واستعمل هذه الأداة حين لا يوجد ما تنسخ منه — مولود جديد أو أول معاملة — أو لترى الخيارات قبل أن تختار واحدة تلازمك.',
    sourceNote: 'الكتابات الموسومة بـ«مستخدمة في الوثائق» تظهر في أوراق حقيقية هنا. وما عداها مركّب من الحروف، وهو تخمين معقول لا أكثر.',
  },
}

const EXAMPLES = ['محمد عبدالله العتيبي', 'نورة سعد القحطاني', 'إبراهيم الغامدي']

export default function NameSpellingTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [name, setName] = useState('')
  const [choices, setChoices] = useState<string[]>([])
  const [copied, setCopied] = useState(false)

  const parts = useMemo(() => analyseName(name), [name])

  // Default each part to its first suggestion whenever the name changes.
  useEffect(() => {
    setChoices(parts.map((p, i) => {
      const current = choices[i]
      const still = p.suggestions.some((x) => x.text === current)
      return still ? current : (p.suggestions[0]?.text ?? '')
    }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name])

  const full = joinChoices(choices)

  async function copy() {
    try { await navigator.clipboard.writeText(full); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="name-spelling">
      <Field label={s.input}>
        <Input dir="rtl" className="font-ar text-[1.3rem]" value={name} placeholder={s.placeholder}
          data-testid="ns-input" onChange={(e) => setName(e.target.value)} />
      </Field>

      {!name.trim() && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.examples}</span>
          {EXAMPLES.map((x) => (
            <Button key={x} className="px-3 py-1 font-ar" data-testid={`ns-example-${EXAMPLES.indexOf(x)}`}
              onClick={() => setName(x)}>{x}</Button>
          ))}
        </div>
      )}

      {parts.length > 0 && (
        <>
          <Panel className="gap-2">
            <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.result}</span>
            <div className="flex flex-wrap items-center gap-3">
              <span className="font-display text-[1.6rem] text-ink" dir="ltr" data-testid="ns-full">{full || '—'}</span>
              <Button className="px-3 py-1" onClick={copy} disabled={!full} data-testid="ns-copy">
                <CopyIcon /> {copied ? s.copied : s.copy}
              </Button>
            </div>
          </Panel>

          <section className="flex flex-col gap-3">
            <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.pick}</h2>
            {parts.map((p, i) => (
              <div key={`${p.arabic}-${i}`} className="flex flex-col gap-1.5" data-testid={`ns-part-${i}`}>
                <span className="font-ar text-[1.15rem] text-ink" dir="rtl">{p.arabic}</span>
                <div className="flex flex-wrap gap-2">
                  {p.suggestions.map((sug) => (
                    <button key={sug.text} data-testid={`ns-option-${i}-${sug.text}`}
                      onClick={() => setChoices((c) => c.map((x, k) => (k === i ? sug.text : x)))}
                      className={`px-3 py-1.5 rounded-md border text-[0.9rem] ${choices[i] === sug.text
                        ? 'border-green-700 bg-green-600 text-sand-100'
                        : 'border-[color:var(--line)] bg-[var(--surface)] text-ink'}`}>
                      {sug.text}
                      <span className={`ms-2 text-[0.68rem] ${choices[i] === sug.text ? 'opacity-80' : 'text-ink-faint'}`}>
                        {sug.source === 'common' ? s.common : s.generated}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {!parts.length && <p className="text-ink-faint rtl:font-ar" data-testid="ns-empty">{s.empty}</p>}

      <Panel className="gap-2">
        <p className="text-[0.95rem] text-ink font-semibold rtl:font-ar" data-testid="ns-headline">{s.headline}</p>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar">{s.body}</p>
        <p className="text-[0.88rem] text-ink-soft rtl:font-ar" data-testid="ns-advice">{s.advice}</p>
        <p className="text-[0.85rem] text-ink-faint rtl:font-ar">{s.sourceNote}</p>
      </Panel>
    </Stack>
  )
}
