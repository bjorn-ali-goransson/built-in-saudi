import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FeatherIcon } from '../../components/icons'

export const writerTool: Tool = {
  id: 'writer',
  name: 'Distraction-Free Writer',
  tagline: 'A calm, autosaving place to just write.',
  description:
    'A clean, full-width writing pad with a live word and character count and reading time. Your text autosaves to this browser as you type, and you can download it as .txt or .md any time. No accounts, no clutter, nothing uploaded.',
  category: 'Text',
  keywords: ['writer', 'writing', 'notepad', 'distraction free', 'markdown', 'word count', 'محرر', 'كتابة', 'مفكرة'],
  status: 'stable',
  Icon: FeatherIcon,
  component: lazyTool(() => import('./WriterTool')),
  ar: {
    name: 'محرّر بلا تشتيت',
    tagline: 'مكان هادئ يحفظ تلقائيًا لتكتب فحسب.',
    description:
      'لوح كتابة نظيف بعرض كامل مع عدّاد حيّ للكلمات والأحرف وزمن القراءة. يُحفظ نصّك تلقائيًا في هذا المتصفح أثناء الكتابة، ويمكنك تنزيله كـ.txt أو .md في أي وقت. بلا حسابات ولا فوضى ولا رفع.',
  },
}
