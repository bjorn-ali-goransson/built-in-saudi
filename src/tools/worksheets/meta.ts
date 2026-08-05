import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { WorksheetIcon } from '../../components/icons'

export const worksheetsTool: Tool = {
  id: 'worksheets',
  name: 'Maths Worksheets',
  nameAr: 'أوراق تمارين الرياضيات',
  tagline: 'Printable practice sheets with a matching answer key.',
  description:
    'Generate printable arithmetic worksheets — addition, subtraction, multiplication and division, in whatever number range you set — with an answer key page that always matches. Every sheet has a code, so reprinting after a paper jam gives you the same questions rather than a new set the key no longer fits. Division problems are built from the answer, so they divide exactly. Arabic-Indic numerals supported. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'worksheet', 'worksheets', 'maths', 'math', 'practice', 'printable', 'school', 'teacher', 'classroom', 'homework', 'answer key', 'arithmetic',
    'أوراق عمل', 'تمارين', 'رياضيات', 'طباعة', 'مدرسة', 'معلم', 'واجب', 'إجابات', 'جمع', 'طرح', 'ضرب', 'قسمة',
  ],
  status: 'stable',
  Icon: WorksheetIcon,
  component: lazyTool(() => import('./WorksheetsTool')),
  ar: {
    name: 'أوراق تمارين الرياضيات',
    tagline: 'أوراق تدريب للطباعة مع ورقة إجابات مطابقة.',
    description:
      'أنشئ أوراق تمارين حسابية قابلة للطباعة — جمعًا وطرحًا وضربًا وقسمة، ضمن المدى العددي الذي تحدّده — مع صفحة إجابات مطابقة دائمًا. لكل ورقة رمز، فإعادة الطباعة بعد انحشار الورق تعطيك الأسئلة نفسها لا مجموعة جديدة لا تناسبها ورقة الإجابات. وتُبنى مسائل القسمة من الناتج فتنتهي بعدد صحيح. وتدعم الأرقام الهندية. تعمل داخل متصفحك بالكامل.',
  },
}
