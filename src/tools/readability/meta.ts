import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ParagraphIcon } from '../../components/icons'

export const readabilityTool: Tool = {
  id: 'readability',
  name: 'Readability Scorer',
  tagline: 'Grade how easy your English writing is to read.',
  description:
    'Paste English text to get its Flesch Reading Ease score and Flesch–Kincaid grade level, plus word, sentence and syllable counts and averages — so you can see, and simplify, how hard your writing is. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['readability', 'flesch', 'reading ease', 'grade level', 'writing', 'text', 'مقروئية', 'سهولة القراءة'],
  status: 'stable',
  Icon: ParagraphIcon,
  component: lazyTool(() => import('./ReadabilityTool')),
  ar: {
    name: 'مقياس المقروئية',
    tagline: 'قيّم سهولة قراءة كتابتك الإنجليزية.',
    description:
      'الصق نصًّا إنجليزيًا لتحصل على درجة سهولة القراءة (Flesch) ومستوى الصف الدراسي (Flesch–Kincaid)، مع عدد الكلمات والجُمل والمقاطع ومتوسّطاتها — لترى مدى صعوبة كتابتك وتبسّطها. تعمل بالكامل في متصفحك.',
  },
}
