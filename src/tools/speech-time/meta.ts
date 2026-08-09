import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const speechTimeTool: Tool = {
  id: 'speech-time',
  name: 'Words to Speaking Time',
  tagline: 'How long a script takes to read, and to say out loud.',
  description:
    'Paste a speech, a khutbah, a presentation or an article and see how long it takes to read silently and to deliver aloud — with the correct rate for Arabic, which is read far slower per word than English. Or work backwards: say how many minutes you have and get a word budget. Runs entirely in your browser.',
  category: 'Text',
  keywords: [
    'speech', 'speaking time', 'words to minutes', 'words to time', 'reading time',
    'presentation', 'talk', 'script', 'podcast', 'audiobook', 'narration',
    'wpm', 'words per minute', 'how long', 'duration', 'khutbah',
    'وقت القراءة', 'وقت الإلقاء', 'مدة الخطبة', 'خطبة', 'عرض تقديمي', 'كلمة',
  ],
  status: 'stable',
  Icon: TimerIcon,
  component: lazyTool(() => import('./SpeechTimeTool')),
  ar: {
    name: 'وقت الإلقاء والقراءة',
    tagline: 'كم يستغرق النص قراءةً صامتة وإلقاءً بصوت عالٍ.',
    description:
      'ألصق خطبة أو عرضًا تقديميًا أو مقالًا واعرف كم يستغرق قراءةً صامتة وإلقاءً بصوت عالٍ — بالمعدّل الصحيح للعربية، التي تُقرأ أبطأ بكثير في الكلمة الواحدة من الإنجليزية. أو اعكس السؤال: حدّد الدقائق المتاحة واحصل على عدد الكلمات. يعمل بالكامل داخل متصفحك.',
  },
}
