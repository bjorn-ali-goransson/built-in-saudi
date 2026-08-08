import { useMemo, useState } from 'react'
import { useLocale } from '../../i18n'
import { Button, Textarea, Stack, Panel, Field } from '../../components/ui'
import { checkHtml, type Severity } from './check'

const SAMPLE = `<section>
  <h2>Our team</h2>
  <h4>Engineering</h4>
  <img src="team-photo-2026.jpg">
  <img src="logo.png" alt="logo.png">
  <p>For the full list <a href="/team">click here</a>.</p>
  <form>
    <input type="email" placeholder="Email address">
    <button><svg width="16" height="16"></svg></button>
  </form>
</section>`

const STR = {
  en: {
    intro: 'Paste HTML and see the accessibility problems that are decidable from the markup alone. Nothing is uploaded — the check runs in this tab, which is also why it reads what you paste rather than fetching a URL.',
    label: 'Your HTML', sample: 'Load an example', clear: 'Clear',
    none: 'No problems found in the markup — which is not the same as accessible. Read the note below.',
    empty: 'Paste some HTML to check it.',
    found: (n: number) => `${n} problem${n === 1 ? '' : 's'}`,
    sev: { high: 'Blocking', medium: 'Should fix', low: 'Worth a look' } as Record<Severity, string>,
    cannotTitle: 'What this cannot tell you',
    cannotBody: 'It can see that alt text is absent, or that it is the file name. It cannot see whether alt text is MEANINGFUL — "image1" and a careful description both pass. Nor can it judge whether a keyboard user can finish a form, whether a modal traps focus, whether an error message actually helps, or whether a tap target is big enough, because none of that is in the markup. A clean result here is a floor, not a pass.',
  },
  ar: {
    intro: 'الصق شيفرة HTML وشاهد مشكلات الوصول التي يمكن الحكم عليها من الوسم وحده. لا يُرفع شيء — الفحص يجري في هذه الصفحة، ولهذا يقرأ ما تلصقه بدل جلب رابط.',
    label: 'شيفرتك', sample: 'حمّل مثالًا', clear: 'مسح',
    none: 'لا مشكلات في الوسم — وهذا ليس مرادفًا لكونه ميسّرًا. اقرأ الملاحظة أدناه.',
    empty: 'الصق شيفرة HTML لفحصها.',
    found: (n: number) => `${n} مشكلة`,
    sev: { high: 'حاجب', medium: 'يجب إصلاحه', low: 'يستحق النظر' } as Record<Severity, string>,
    cannotTitle: 'ما لا تستطيع هذه الأداة إخبارك به',
    cannotBody: 'تستطيع أن ترى أن النص البديل غائب أو أنه اسم الملف. ولا تستطيع أن ترى إن كان النص البديل ذا معنى — فـ«صورة1» ووصف دقيق كلاهما يمرّ. ولا أن تحكم إن كان مستخدم لوحة المفاتيح يستطيع إكمال نموذج، أو إن كانت نافذة منبثقة تحبس التركيز، أو إن كانت رسالة الخطأ تنفع فعلًا، أو إن كان هدف اللمس كبيرًا كفاية، فلا شيء من ذلك في الوسم. والنتيجة النظيفة هنا حدٌّ أدنى لا شهادة.',
  },
}

const TONE: Record<Severity, string> = {
  high: 'border-s-[3px] border-[color:var(--danger)]',
  medium: 'border-s-[3px] border-gold-500',
  low: 'border-s-[3px] border-[color:var(--line)]',
}

export default function A11yCheckTool() {
  const { locale } = useLocale()
  const s = STR[locale]
  const [html, setHtml] = useState('')
  const issues = useMemo(() => (html.trim() ? checkHtml(html) : []), [html])

  return (
    <Stack data-testid="a11y-check">
      <p className="text-[0.95rem] text-ink-soft rtl:font-ar">{s.intro}</p>

      <Field label={s.label}>
        <Textarea
          className="min-h-[12rem] font-mono text-[0.85rem]"
          dir="ltr"
          value={html}
          data-testid="a11y-input"
          onChange={(e) => setHtml(e.target.value)}
        />
      </Field>

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => setHtml(SAMPLE)} data-testid="a11y-sample">{s.sample}</Button>
        <Button onClick={() => setHtml('')} data-testid="a11y-clear">{s.clear}</Button>
      </div>

      {!html.trim() && <p className="text-[0.9rem] text-ink-faint rtl:font-ar" data-testid="a11y-empty">{s.empty}</p>}

      {html.trim() && issues.length === 0 && (
        <Panel data-testid="a11y-none"><p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.none}</p></Panel>
      )}

      {issues.length > 0 && (
        <>
          <p className="text-[0.9rem] font-semibold text-ink" data-testid="a11y-count">{s.found(issues.length)}</p>
          <div className="flex flex-col gap-2" data-testid="a11y-issues">
            {issues.map((i, n) => (
              <div key={`${i.id}-${n}`} className={`flex flex-col gap-1 ps-3 pe-3 py-2.5 rounded-e-md bg-[var(--surface)] ${TONE[i.severity]}`} data-testid={`a11y-issue-${i.id}`}>
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="text-[0.7rem] uppercase tracking-[0.05em] text-ink-faint">{s.sev[i.severity]}</span>
                  <span className="text-[0.95rem] font-semibold text-ink rtl:font-ar">{i.title}</span>
                </div>
                <p className="text-[0.86rem] text-ink-soft leading-relaxed rtl:font-ar">{i.detail}</p>
                <code className="text-[0.78rem] font-mono text-ink-faint break-all" dir="ltr">{i.snippet}</code>
              </div>
            ))}
          </div>
        </>
      )}

      <Panel className="gap-1" data-testid="a11y-cannot">
        <p className="font-display text-[1.05rem] rtl:font-ar">{s.cannotTitle}</p>
        <p className="text-[0.9rem] text-ink-soft rtl:font-ar">{s.cannotBody}</p>
      </Panel>
    </Stack>
  )
}
