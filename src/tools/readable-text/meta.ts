import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TextIcon } from '../../components/icons'

export const readableTextTool: Tool = {
  id: 'readable-text',
  name: 'Readable Text',
  tagline: 'Set hard-to-read text the way you can actually read it.',
  description:
    'Paste an article or a chapter and adjust the size, line spacing, line length and contrast until it is comfortable — a focus band for the line you are on, and an option to bold the start of each word. Letter spacing is switched off for Arabic on purpose: the letters join, so pulling them apart breaks the word. Your settings are remembered, and nothing is uploaded.',
  category: 'Text',
  keywords: [
    'readable', 'readability', 'dyslexia', 'dyslexic', 'easy to read', 'reading aid',
    'line spacing', 'letter spacing', 'font size', 'low vision', 'accessibility', 'focus',
    'bionic reading', 'reading ruler', 'large text', 'contrast',
    'عسر القراءة', 'تكبير النص', 'تباعد الأسطر', 'ضعف البصر',
    'قراءة مريحة', 'مساعدة على القراءة', 'إتاحة',
  ],
  status: 'stable',
  Icon: TextIcon,
  component: lazyTool(() => import('./ReadableTextTool')),
  ar: {
    name: 'نص أسهل للقراءة',
    tagline: 'اضبط النص الصعب حتى تستطيع قراءته.',
    description:
      'ألصق مقالًا أو فصلًا واضبط الحجم وتباعد الأسطر وطول السطر والتباين حتى يريحك — مع إبراز السطر الذي تقرؤه وخيار لتغميق أول كل كلمة. وتباعد الحروف مُعطَّل للعربية عن قصد: فحروفها تتّصل، والمباعدة بينها تكسر الكلمة. تُحفظ إعداداتك، ولا يُرفع شيء.',
  },
}
