import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FeatherIcon } from '../../components/icons'

export const diacritizeTool: Tool = {
  id: 'diacritize',
  name: 'Arabic Diacritizer',
  nameAr: 'مُشكِّل النصوص',
  tagline: 'Add full tashkīl to Arabic text with AI',
  description:
    'Paste Arabic text and an AI pass adds full diacritics (تشكيل) — including the grammatical case endings — then hand it back for copy. Sign in with Google (free); to keep the AI budget fair it is limited to one run per 24 hours. The tool checks your text is Arabic before sending.',
  category: 'Saudi / Local',
  keywords: ['arabic', 'diacritics', 'tashkeel', 'tashkil', 'harakat', 'vowels', 'تشكيل', 'حركات', 'ضبط', 'إعراب', 'نطق'],
  status: 'beta',
  Icon: FeatherIcon,
  component: lazyTool(() => import('./DiacritizeTool')),
  ar: {
    name: 'مُشكِّل النصوص العربية',
    tagline: 'أضِف التشكيل الكامل للنص العربي بالذكاء الاصطناعي',
    description:
      'الصق نصًّا عربيًّا فيضيف الذكاء الاصطناعي التشكيل الكامل — مع علامات الإعراب — ثم يعيده لك للنسخ. سجّل الدخول بحساب Google (مجانًا)؛ ولضبط ميزانية الذكاء الاصطناعي يُسمح بمرة واحدة كل ٢٤ ساعة. تتحقق الأداة من أن النص عربي قبل الإرسال.',
  },
}
