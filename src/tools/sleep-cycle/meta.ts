import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MoonIcon } from '../../components/icons'

export const sleepCycleTool: Tool = {
  id: 'sleep-cycle',
  name: 'Sleep Cycle Calculator',
  nameAr: 'حاسبة دورات النوم',
  tagline: 'When to sleep so you wake between cycles — not mid-dream.',
  description:
    'Work backwards from when you need to be up, or forwards from now, to the times that land at the end of a ~90-minute sleep cycle rather than in the middle of deep sleep. It allows for the quarter-hour it takes to fall asleep, shows Fajr so you can see which options are before it, and marks the last third of the night for anyone praying qiyām.',
  category: 'Calculators',
  keywords: ['sleep', 'cycle', 'bedtime', 'wake up', 'alarm', '90 minutes', 'qiyam', 'نوم', 'دورات النوم', 'موعد النوم', 'استيقاظ', 'قيام الليل', 'الفجر'],
  status: 'stable',
  Icon: MoonIcon,
  component: lazyTool(() => import('./SleepCycleTool')),
  ar: {
    name: 'حاسبة دورات النوم',
    tagline: 'متى تنام لتستيقظ بين الدورات لا في وسط الحلم.',
    description:
      'احسب رجوعًا من وقت استيقاظك المطلوب، أو تقدّمًا من الآن، إلى الأوقات التي تقع في نهاية دورة نوم مدتها نحو ٩٠ دقيقة بدل وسط النوم العميق. تحتسب الأداة ربع الساعة التي يستغرقها الخلود للنوم، وتعرض الفجر لترى أي الخيارات قبله، وتحدّد الثلث الأخير من الليل لمن يقوم.',
  },
}
