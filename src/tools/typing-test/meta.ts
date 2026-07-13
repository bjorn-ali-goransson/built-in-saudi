import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KeyboardIcon } from '../../components/icons'

export const typingTestTool: Tool = {
  id: 'typing-test',
  name: 'Typing Speed Test',
  tagline: 'Measure your words-per-minute and accuracy.',
  description:
    'Type the shown passage to measure your typing speed in words per minute and your accuracy, with each character highlighted as right or wrong in real time. Start again for a fresh passage any time. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['typing test', 'wpm', 'words per minute', 'speed', 'accuracy', 'keyboard', 'اختبار الكتابة', 'سرعة الطباعة'],
  status: 'stable',
  Icon: KeyboardIcon,
  component: lazyTool(() => import('./TypingTestTool')),
  ar: {
    name: 'اختبار سرعة الكتابة',
    tagline: 'قِس عدد كلماتك في الدقيقة ودقّتك.',
    description:
      'اكتب المقطع المعروض لقياس سرعة كتابتك بالكلمات في الدقيقة ودقّتك، مع تمييز كل حرف صحيحًا أو خاطئًا لحظيًا. ابدأ من جديد لمقطع آخر في أي وقت. يعمل بالكامل في متصفحك.',
  },
}
