import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Input, Stack, Panel } from '../../components/ui'
import { CopyIcon } from '../../components/icons'
import { LETTERS, parsePlate, renderPlate } from './plate'

const STR = {
  en: {
    input: 'Plate', placeholder: 'ا ب ج 1234  ·  A B J 1234  ·  ١٢٣٤',
    hint: 'Type a plate in either script, in either order, with Arabic or Western digits. You get both halves back, written the way they actually appear.',
    latin: 'Latin side', arabic: 'Arabic side',
    copy: 'Copy', copied: 'Copied!',
    table: 'The 17 letters',
    mirrored: 'The letters run in the opposite order on the Arabic half, because Arabic reads right-to-left. A form that accepts both and prints them in the same order is showing one of them wrong.',
    why: 'Only 17 Arabic letters appear on plates. Each was given a unique single Latin character so a plate cannot be misread at a border or in an international database — which is why ح is J and م is Z rather than anything more obvious.',
    problems: {
      'no-letters': 'No plate letters found.',
      'no-digits': 'No digits found.',
      'too-many-letters': 'A plate has three letters; the extras were ignored.',
      'too-many-digits': 'A plate has at most four digits; the extras were ignored.',
    } as Record<string, string>,
    unknown: 'Not a plate letter:',
    unknownWhy: 'Saudi plates use only the 17 letters below — the rest were left out on purpose.',
    example: 'Try an example',
  },
  ar: {
    input: 'اللوحة', placeholder: 'ا ب ج ١٢٣٤  ·  A B J 1234',
    hint: 'اكتب اللوحة بأي خط وبأي ترتيب، بأرقام هندية أو إنجليزية. وستحصل على الجانبين كما يظهران فعلًا.',
    latin: 'الجانب اللاتيني', arabic: 'الجانب العربي',
    copy: 'نسخ', copied: 'تم النسخ!',
    table: 'الحروف السبعة عشر',
    mirrored: 'تسير الحروف بترتيب معاكس في الجانب العربي لأن العربية تُقرأ من اليمين. والنموذج الذي يقبل الاثنين ويطبعهما بالترتيب نفسه يعرض أحدهما خطأً.',
    why: 'لا يظهر على اللوحات سوى ١٧ حرفًا عربيًا. وأُعطي كل حرف مقابلًا لاتينيًا واحدًا فريدًا حتى لا تُقرأ اللوحة خطأً في منفذ حدودي أو قاعدة بيانات دولية — ولهذا صارت ح هي J وم هي Z لا شيئًا أقرب للبداهة.',
    problems: {
      'no-letters': 'لم يُعثر على حروف لوحة.',
      'no-digits': 'لم يُعثر على أرقام.',
      'too-many-letters': 'اللوحة ثلاثة حروف؛ وتُجوهلت الزيادة.',
      'too-many-digits': 'اللوحة أربعة أرقام كحد أقصى؛ وتُجوهلت الزيادة.',
    } as Record<string, string>,
    unknown: 'ليس حرف لوحة:',
    unknownWhy: 'تستخدم اللوحات السعودية الحروف السبعة عشر أدناه فقط — وما عداها مستبعد عمدًا.',
    example: 'جرّب مثالًا',
  },
}

export default function SaudiPlateTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [text, setText] = useState('')
  const [copied, setCopied] = useState('')

  const plate = useMemo(() => parsePlate(text), [text])
  const out = useMemo(() => renderPlate(plate), [plate])
  const showResult = plate.letters.length > 0 || plate.digits.length > 0

  const unknown = plate.problems.find((p) => p.startsWith('unknown-letter:'))?.slice(15)
  const otherProblems = plate.problems.filter((p) => !p.startsWith('unknown-letter:'))

  async function copy(value: string, tag: string) {
    if (!value) return
    try { await navigator.clipboard.writeText(value); setCopied(tag); setTimeout(() => setCopied(''), 1500) } catch { /* ignore */ }
  }

  return (
    <Stack data-testid="saudi-plate">
      <label className="flex flex-col gap-1 text-[0.8rem] text-ink-faint">
        {s.input}
        <Input dir="auto" className="text-[1.2rem] font-mono" data-testid="sp-input"
          placeholder={s.placeholder} value={text} onChange={(e) => setText(e.target.value)} />
      </label>

      {!text.trim() && (
        <div className="flex flex-col gap-2 items-start">
          <p className="text-ink-faint text-[0.95rem] rtl:font-ar">{s.hint}</p>
          <Button onClick={() => setText('ا ب ح 4321')} data-testid="sp-example">{s.example}</Button>
        </div>
      )}

      {unknown && (
        <p className="text-[0.9rem] text-gold-500 rtl:font-ar" data-testid="sp-unknown">
          {s.unknown} <b className="font-mono">{unknown}</b> — {s.unknownWhy}
        </p>
      )}
      {otherProblems.map((p) => (
        <p key={p} className="text-[0.88rem] text-ink-faint rtl:font-ar" data-testid={`sp-problem-${p}`}>{s.problems[p]}</p>
      ))}

      {showResult && (
        <>
          <div className="grid gap-3 grid-cols-1 min-[560px]:grid-cols-2">
            {/* Two panels laid out to echo the plate itself. */}
            <Panel className="flex flex-col gap-2">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.latin}</span>
              <span className="font-mono text-[clamp(1.6rem,6vw,2.4rem)] text-ink tracking-[0.15em]" dir="ltr" data-testid="sp-latin">
                {out.latin || '—'}
              </span>
              <Button className="self-start px-3 py-1" onClick={() => copy(out.latin, 'latin')} data-testid="sp-copy-latin">
                <CopyIcon /> {copied === 'latin' ? s.copied : s.copy}
              </Button>
            </Panel>
            <Panel className="flex flex-col gap-2">
              <span className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.arabic}</span>
              <span className="font-ar text-[clamp(1.6rem,6vw,2.4rem)] text-ink tracking-[0.15em]" dir="rtl" data-testid="sp-arabic">
                {out.arabic || '—'}
              </span>
              <Button className="self-start px-3 py-1" onClick={() => copy(out.arabic, 'arabic')} data-testid="sp-copy-arabic">
                <CopyIcon /> {copied === 'arabic' ? s.copied : s.copy}
              </Button>
            </Panel>
          </div>
          <p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.mirrored}</p>
        </>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="font-body text-[0.68rem] uppercase tracking-[0.06em] text-ink-faint">{s.table}</h2>
        <div className="grid grid-cols-3 min-[480px]:grid-cols-6 gap-2" data-testid="sp-table">
          {LETTERS.map((l) => {
            const used = plate.letters.includes(l.la)
            return (
              <button key={l.la} data-testid={`sp-letter-${l.la}`}
                onClick={() => setText((t) => t + l.ar)}
                className={`flex flex-col items-center gap-0.5 rounded-md border py-2 ${used ? 'border-green-600 bg-[color-mix(in_srgb,var(--color-green-400)_12%,transparent)]' : 'border-[color:var(--line)] bg-[var(--surface)]'}`}>
                <span className="font-ar text-[1.5rem] text-ink leading-none">{l.ar}</span>
                <span className="font-mono text-[1rem] text-ink-soft">{l.la}</span>
              </button>
            )
          })}
        </div>
      </section>

      <Panel><p className="text-[0.85rem] text-ink-soft rtl:font-ar">{s.why}</p></Panel>
    </Stack>
  )
}
