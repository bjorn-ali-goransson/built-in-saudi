// Starting points in the reader's language. Each one shows off something the
// editor does — styles, a table, a checklist, numbered lists — rather than being
// a blank page with a different name.
import type { Template } from '../../components/office/OfficeApp'
import { emptyDoc, type PMNode, type WordData } from './model'
import { WD_STR } from './strings'

const T = (text: string, marks?: PMNode['marks']): PMNode => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const B = (text: string) => T(text, [{ type: 'bold' }])

export function wordTemplates(locale: 'en' | 'ar'): Template<WordData>[] {
  const s = WD_STR[locale]
  const ar = locale === 'ar'
  const t = (en: string, a: string) => (ar ? a : en)
  const dir = ar ? { dir: 'rtl' } : {}
  const P = (...c: (PMNode | string)[]): PMNode => ({ type: 'paragraph', attrs: { ...dir }, content: c.map((x) => (typeof x === 'string' ? T(x) : x)).filter((x) => x.text !== '') })
  const Hn = (level: number, text: string): PMNode => ({ type: 'heading', attrs: { level, ...dir }, content: [T(text)] })
  const list = (type: 'bullet_list' | 'ordered_list', items: string[], attrs: Record<string, unknown> = {}, checked?: boolean): PMNode => ({
    type, attrs, content: items.map((i) => ({ type: 'list_item', attrs: checked === undefined ? {} : { checked }, content: [P(i)] })),
  })
  const table = (rows: string[][]): PMNode => ({
    type: 'table',
    content: rows.map((r, i) => ({ type: 'table_row', content: r.map((c) => ({ type: i === 0 ? 'table_header' : 'table_cell', content: [P(i === 0 ? B(c) : c)] })) })),
  })
  const make = (content: PMNode[], extra: Partial<WordData> = {}): WordData => ({ ...emptyDoc(ar), doc: { type: 'doc', content }, ...extra })
  const today = new Date().toLocaleDateString(ar ? 'ar-SA-u-ca-gregory' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  return [
    {
      id: 'letter',
      label: s.templates.letter,
      make: () => make([
        { type: 'paragraph', attrs: { ...dir, align: 'right' }, content: [T(today)] },
        P(t('To: ', 'إلى: '), B(t('Name of recipient', 'اسم المرسَل إليه'))),
        P(t('Subject: ', 'الموضوع: '), B(t('What this letter is about', 'موضوع الخطاب'))),
        P(t('Dear Sir or Madam,', 'السلام عليكم ورحمة الله وبركاته، وبعد:')),
        P(t('Write the purpose of the letter in the first paragraph, then the detail in the ones that follow.', 'اكتب الغرض من الخطاب في الفقرة الأولى، ثم التفاصيل في الفقرات التالية.')),
        P(t('With thanks and regards,', 'وتقبلوا خالص التحية والتقدير،')),
        P(B(t('Your name', 'اسمك'))),
      ], { footer: t('Page {page} of {pages}', 'صفحة {page} من {pages}') }),
    },
    {
      id: 'report',
      label: s.templates.report,
      make: () => make([
        Hn(1, t('Quarterly report', 'التقرير الربعي')),
        P(T(t('Prepared by the operations team · ', 'أعدّه فريق العمليات · '), [{ type: 'italic' }]), T(today, [{ type: 'italic' }])),
        Hn(2, t('Summary', 'الملخص')),
        P(t('Revenue grew for the third quarter in a row, while costs held flat.', 'نمت الإيرادات للربع الثالث على التوالي، وبقيت التكاليف ثابتة.'), { type: 'footnote', attrs: { text: t('Figures are unaudited.', 'الأرقام غير مدققة.') } }),
        Hn(2, t('Results', 'النتائج')),
        table([[t('Measure', 'المؤشر'), t('Target', 'المستهدف'), t('Actual', 'الفعلي')], [t('Revenue (SAR)', 'الإيرادات (ريال)'), '1,200,000', '1,340,000'], [t('New customers', 'عملاء جدد'), '300', '355'], [t('Satisfaction', 'الرضا'), '90%', '93%']]),
        Hn(2, t('Next steps', 'الخطوات التالية')),
        list('ordered_list', [t('Open the Jeddah branch', 'افتتاح فرع جدة'), t('Hire two support staff', 'توظيف موظفَي دعم'), t('Review pricing in Q4', 'مراجعة الأسعار في الربع الرابع')], { order: 1, kind: ar ? 'arabic-indic' : 'decimal' }),
      ], { header: t('Quarterly report — confidential', 'التقرير الربعي — سري'), footer: t('Page {page} of {pages}', 'صفحة {page} من {pages}') }),
    },
    {
      id: 'meeting',
      label: s.templates.meeting,
      make: () => make([
        Hn(1, t('Meeting notes', 'محضر اجتماع')),
        P(B(t('Date: ', 'التاريخ: ')), today),
        P(B(t('Attendees: ', 'الحضور: ')), t('Sara, Omar, Lina', 'سارة، عمر، لينا')),
        Hn(2, t('Agenda', 'جدول الأعمال')),
        list('bullet_list', [t('Last week’s actions', 'إجراءات الأسبوع الماضي'), t('The new website', 'الموقع الجديد'), t('Any other business', 'ما يستجد من أعمال')]),
        Hn(2, t('Decisions', 'القرارات')),
        P(t('Write each decision as one sentence.', 'اكتب كل قرار في جملة واحدة.')),
        Hn(2, t('Actions', 'المهام')),
        list('bullet_list', [t('Sara — send the draft by Thursday', 'سارة — إرسال المسودة يوم الخميس'), t('Omar — book the venue', 'عمر — حجز القاعة')], { checklist: true }, false),
      ]),
    },
    {
      id: 'cv',
      label: s.templates.cv,
      make: () => make([
        { type: 'heading', attrs: { level: 1, ...dir, align: 'center' }, content: [T(t('Your Name', 'اسمك الكامل'))] },
        { type: 'paragraph', attrs: { ...dir, align: 'center' }, content: [T(t('Riyadh · name@example.com · +966 5x xxx xxxx', 'الرياض · name@example.com · ‎+966 5x xxx xxxx'))] },
        { type: 'horizontal_rule' },
        Hn(2, t('Experience', 'الخبرات')),
        P(B(t('Job title', 'المسمى الوظيفي')), t(' — Company, 2022–present', ' — الشركة، ٢٠٢٢ حتى الآن')),
        list('bullet_list', [t('What you achieved, with a number in it', 'إنجاز يتضمن رقمًا'), t('Another achievement', 'إنجاز آخر')]),
        Hn(2, t('Education', 'التعليم')),
        P(B(t('Degree', 'الدرجة العلمية')), t(' — University, 2021', ' — الجامعة، ٢٠٢١')),
        Hn(2, t('Skills', 'المهارات')),
        P(t('Skill · Skill · Skill', 'مهارة · مهارة · مهارة')),
      ]),
    },
  ]
}
