// Starting points in the reader's language, each on its own theme and showing
// what the editor does: layouts, a big number, a table, shapes, notes.
import type { Template } from '../../components/office/OfficeApp'
import { blankDeck, newSlide, para, newId, type DeckData, type LayoutKind, type ShapeEl, type Para, type Theme } from './model'
import { spread } from './order'
import { THEMES } from './themes'
import { SL_STR } from './strings'

const theme = (name: string): Theme => JSON.parse(JSON.stringify(THEMES.find((t) => t.name === name) || THEMES[0]))

export function slidesTemplates(locale: 'en' | 'ar'): Template<DeckData>[] {
  const s = SL_STR[locale]
  const ar = locale === 'ar'
  const t = (en: string, a: string) => (ar ? a : en)
  const P = (text: string, extra: Partial<Para> = {}) => para(text, { rtl: ar || undefined, ...extra })
  function deck(th: string, slides: { kind: LayoutKind; texts: (string | string[])[]; notes?: string; extra?: (d: DeckData) => ShapeEl[] }[]): DeckData {
    const d = blankDeck(ar)
    d.theme = theme(th)
    d.slides = slides.map((x) => {
      const sl = newSlide(x.kind, d)
      const phs = sl.elements.filter((e): e is ShapeEl => e.kind === 'shape' && !!e.ph)
      x.texts.forEach((v, i) => {
        const ph = phs[i]
        if (!ph?.text) return
        const base = ph.text.paras[0]
        ph.text.paras = (Array.isArray(v) ? v : [v]).map((line) => {
          const m = /^(\s*)- (.*)$/.exec(line)
          return P(m ? m[2] : line, { align: base.align, bullet: m ? 'bullet' : base.bullet ?? null, level: m && m[1].length ? 1 : undefined })
        })
      })
      if (x.extra) sl.elements.push(...x.extra(d))
      if (x.notes) sl.notes = x.notes
      return sl
    })
    const k = spread(d.slides.length)
    d.slides.forEach((x, i) => { x.ord = k[i]; const ek = spread(x.elements.length); x.elements.forEach((e, j) => (e.ord = ek[j])) })
    return d
  }
  const bar = (d: DeckData, color = 'accent1'): ShapeEl => ({ id: newId(), kind: 'shape', geom: 'rect', x: 0, y: d.size.h - 14, w: d.size.w, h: 14, fill: { type: 'solid', color }, line: null })
  const step = (x: number, label: string, color: string): ShapeEl => ({ id: newId(), kind: 'shape', geom: 'chevron', x, y: 250, w: 230, h: 90, fill: { type: 'solid', color }, line: null, text: { paras: [P(label, { align: 'ctr' })], anchor: 'ctr', defaults: { size: 20, color: 'lt1', b: true } } })
  return [
    {
      id: 'pitch', label: s.templates.pitch,
      make: () => deck('Najdi', [
        { kind: 'title', texts: [t('Qahwa Box', 'صندوق القهوة'), t('Specialty coffee, delivered weekly', 'قهوة مختصة تصلك كل أسبوع')], notes: t('Thank everyone for coming. One sentence on who we are.', 'اشكر الحضور، ثم جملة واحدة عن هويتنا.') },
        { kind: 'titleContent', texts: [t('The problem', 'المشكلة'), [t('- Good beans are hard to find', '- يصعب العثور على حبوب جيدة'), t('- Prices change every month', '- الأسعار تتغير كل شهر'), t('- Nobody explains the roast', '- لا أحد يشرح درجة التحميص')]] },
        { kind: 'bigNumber', texts: [t('38%', '٣٨٪'), t('of coffee drinkers in Riyadh buy online', 'من محبي القهوة في الرياض يشترون عبر الإنترنت')], extra: (d) => [bar(d)] },
        { kind: 'titleOnly', texts: [t('How it works', 'كيف يعمل')], extra: () => [step(60, t('Choose', 'اختر'), 'accent1'), step(310, t('Roast', 'نحمّص'), 'accent2'), step(560, t('Deliver', 'نوصل'), 'accent3')] },
        { kind: 'quote', texts: [t('“The best cup I have had at home.”', '«أفضل فنجان شربته في البيت.»'), t('— An early customer', '— أحد أوائل العملاء')] },
        { kind: 'section', texts: [t('Thank you', 'شكرًا لكم'), t('hello@example.com', 'hello@example.com')] },
      ]),
    },
    {
      id: 'lesson', label: s.templates.lesson,
      make: () => deck('Ocean', [
        { kind: 'title', texts: [t('The water cycle', 'دورة الماء'), t('Science · Grade 5', 'العلوم · الصف الخامس')] },
        { kind: 'titleContent', texts: [t('What we will learn', 'ماذا سنتعلم'), [t('- Evaporation', '- التبخر'), t('- Condensation', '- التكاثف'), t('- Precipitation', '- الهطول')]] },
        { kind: 'twoContent', texts: [t('Then and now', 'قبل وبعد'), [t('Water in the sea', 'الماء في البحر'), t('- warmed by the sun', '- تسخّنه الشمس')], [t('Water in the sky', 'الماء في السماء'), t('- forms clouds', '- يكوّن السحب')]] },
        { kind: 'section', texts: [t('Your turn', 'دورك'), t('Draw the cycle in your notebook', 'ارسم الدورة في دفترك')] },
      ]),
    },
    {
      id: 'update', label: s.templates.update,
      make: () => {
        const d = deck('Ink', [
          { kind: 'title', texts: [t('Project update', 'تحديث المشروع'), t('Week 12', 'الأسبوع ١٢')] },
          { kind: 'titleContent', texts: [t('Done this week', 'أُنجز هذا الأسبوع'), [t('- New sign-up page', '- صفحة تسجيل جديدة'), t('- Faster search', '- بحث أسرع'), t('- 3 bugs fixed', '- إصلاح ٣ أخطاء')]] },
          { kind: 'titleOnly', texts: [t('Status', 'الحالة')] },
        ])
        const sl = d.slides[2]
        const cell = (x: string, b = false) => ({ text: { paras: [P(x, b ? {} : {})], defaults: { size: 16 } } })
        sl.elements.push({ id: newId(), kind: 'table', x: 62, y: 160, w: 836, h: 220, cols: [300, 200, 336], style: { header: true, banded: true, accent: 'accent1' }, rows: [
          { h: 44, cells: [cell(t('Area', 'المجال'), true), cell(t('Status', 'الحالة'), true), cell(t('Next step', 'الخطوة التالية'), true)] },
          { h: 44, cells: [cell(t('Design', 'التصميم')), cell(t('On track', 'في الموعد')), cell(t('Review on Sunday', 'مراجعة يوم الأحد'))] },
          { h: 44, cells: [cell(t('Build', 'التطوير')), cell(t('At risk', 'معرّض للتأخير')), cell(t('Add one developer', 'إضافة مطوّر'))] },
          { h: 44, cells: [cell(t('Launch', 'الإطلاق')), cell(t('Planned', 'مخطط')), cell(t('Pick the date', 'تحديد الموعد'))] },
        ] })
        const ek = spread(sl.elements.length)
        sl.elements.forEach((e, j) => (e.ord = ek[j]))
        return d
      },
    },
    {
      id: 'event', label: s.templates.event,
      make: () => deck('Midnight', [
        { kind: 'title', texts: [t('Founders’ evening', 'أمسية المؤسسين'), t('Thursday, 8 pm · Jeddah', 'الخميس، ٨ مساءً · جدة')] },
        { kind: 'titleContent', texts: [t('Programme', 'البرنامج'), [t('- 8:00  Welcome', '- ٨:٠٠  الترحيب'), t('- 8:30  Three short talks', '- ٨:٣٠  ثلاث كلمات قصيرة'), t('- 9:30  Dinner', '- ٩:٣٠  العشاء')]] },
        { kind: 'section', texts: [t('See you there', 'نراكم هناك'), t('Register at the door', 'التسجيل عند الباب')] },
      ]),
    },
  ]
}
