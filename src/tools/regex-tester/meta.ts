import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RegexIcon } from '../../components/icons'

export const regexTesterTool: Tool = {
  id: 'regex-tester',
  name: 'Regex Tester',
  tagline: 'Test regular expressions live, with match highlighting.',
  description:
    'Write a regular expression and see every match highlighted in your test text as you type, with capture groups and match counts. Runs entirely in your browser using the native JavaScript engine — nothing is uploaded.',
  category: 'Developer',
  keywords: ['regex', 'regular expression', 'regexp', 'pattern', 'match', 'test', 'تعبير نمطي', 'ريجيكس'],
  status: 'stable',
  Icon: RegexIcon,
  component: lazyTool(() => import('./RegexTesterTool')),
  ar: {
    name: 'مختبِر التعابير النمطية',
    tagline: 'اختبر التعابير النمطية مباشرةً مع تظليل المطابقات.',
    description:
      'اكتب تعبيرًا نمطيًا وشاهد كل مطابقة مُظلّلة في نصك أثناء الكتابة، مع مجموعات الالتقاط وعدد المطابقات. يعمل بالكامل في متصفحك باستخدام محرّك JavaScript — لا يُرفع أي شيء.',
  },
}
