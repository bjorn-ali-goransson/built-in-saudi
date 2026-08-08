import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EraseIcon } from '../../components/icons'

export const arabicNormalizeTool: Tool = {
  id: 'arabic-normalize',
  name: 'Arabic Text Normalizer',
  nameAr: 'موحّد النص العربي',
  tagline: 'Strip tashkeel and unify the letters that break search.',
  description:
    'Clean up Arabic text: remove diacritics (تشكيل) and kashida stretching, unify أ إ آ ٱ to ا and ى to ي, drop invisible characters, and collapse stray spaces. The same word typed two ways will never match in a search or a database — this makes it match. Runs entirely in your browser.',
  category: 'Arabic',
  keywords: ['arabic', 'normalize', 'tashkeel', 'diacritics', 'harakat', 'تشكيل', 'تطويل', 'توحيد', 'ألف', 'همزة', 'نص عربي', 'search'],
  status: 'stable',
  Icon: EraseIcon,
  component: lazyTool(() => import('./ArabicNormalizeTool')),
  ar: {
    name: 'موحّد النص العربي',
    tagline: 'أزل التشكيل ووحّد الحروف التي تُفسد البحث.',
    description:
      'نظّف النص العربي: أزل التشكيل والتطويل، ووحّد أ إ آ ٱ إلى ا وى إلى ي، واحذف المحارف الخفية، وادمج المسافات الزائدة. الكلمة نفسها مكتوبة بطريقتين لا تتطابق أبدًا في بحث أو قاعدة بيانات — وهذه الأداة تجعلها تتطابق. يعمل بالكامل في متصفحك.',
  },
}
