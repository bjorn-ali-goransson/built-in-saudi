import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TextIcon } from '../../components/icons'

export const wordCounterTool: Tool = {
  id: 'text-counter',
  name: 'Word Counter',
  tagline: 'Live word, character, sentence & reading-time counts.',
  description:
    'Count words, characters, sentences and paragraphs live as you type, with reading-time estimates. Counts Arabic and emoji correctly. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['word', 'character', 'count', 'counter', 'text', 'reading time', 'عدد الكلمات'],
  status: 'stable',
  Icon: TextIcon,
  component: lazyTool(() => import('./WordCounterTool')),
  ar: {
    name: 'عدّاد الكلمات والحروف',
    tagline: 'عدّ الكلمات والحروف والجُمل ووقت القراءة مباشرةً.',
    description:
      'عُدّ الكلمات والحروف والجُمل والفقرات مباشرةً أثناء الكتابة، مع تقدير وقت القراءة. يحسب العربية والرموز التعبيرية بشكل صحيح. يعمل بالكامل داخل متصفحك.',
  },
}
