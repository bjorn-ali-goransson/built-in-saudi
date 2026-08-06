import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PenIcon } from '../../components/icons'

export const arabicHandwritingTool: Tool = {
  id: 'arabic-handwriting',
  name: 'Arabic Handwriting Sheets',
  nameAr: 'كراسة الخط العربي',
  tagline: 'Printable tracing practice, shaped correctly.',
  description:
    'Printable Arabic handwriting practice — every letter in all four of its positional forms (alone, at the start, in the middle, at the end), or any word or name you type. The letters are shaped and joined properly, which is the thing generic worksheet sites get wrong when they print 28 isolated glyphs a child will never meet in a word. Ruled guide lines, faded or dotted tracing, and as many rows as you want. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'arabic', 'handwriting', 'tracing', 'practice', 'worksheet', 'letters', 'alphabet', 'school', 'kids', 'printable', 'calligraphy',
    'خط عربي', 'كراسة', 'تتبع', 'حروف', 'تمارين', 'أوراق عمل', 'مدرسة', 'أطفال', 'طباعة', 'الحروف الهجائية',
  ],
  status: 'stable',
  Icon: PenIcon,
  component: lazyTool(() => import('./ArabicHandwritingTool')),
  ar: {
    name: 'كراسة الخط العربي',
    tagline: 'تدريب على الخط للطباعة، بحروف موصولة كما ينبغي.',
    description:
      'أوراق تدريب على الخط العربي قابلة للطباعة — كل حرف في مواضعه الأربعة (مفردًا، وأول الكلمة، ووسطها، وآخرها)، أو أي كلمة أو اسم تكتبه. والحروف تُشكَّل وتُوصَل على وجهها الصحيح، وهو ما تخطئ فيه مواقع أوراق العمل العامة حين تطبع ٢٨ شكلًا مفردًا لا يلقاها الطفل في كلمة قط. مع أسطر مسطّرة، وتتبّع باهت أو منقّط، وعدد الأسطر الذي تريد. تعمل داخل متصفحك بالكامل.',
  },
}
