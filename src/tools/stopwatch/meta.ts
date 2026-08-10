import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const stopwatchTool: Tool = {
  id: 'stopwatch',
  name: 'Stopwatch & Timer',
  nameAr: 'ساعة إيقاف ومؤقّت',
  tagline: 'Counts up, counts down, keeps time.',
  description:
    'A stopwatch with laps and a countdown timer with an alarm, in one place. Both take their time from the clock rather than by counting ticks, so switching tabs, locking the phone or leaving it in the background does not lose the minutes in between — which is what usually goes wrong with a timer in a browser. The countdown tool here is for a date months away and the pomodoro for fixed sprints; this is the everyday one.',
  category: 'Time & Date',
  keywords: [
    'stopwatch', 'timer', 'countdown timer', 'lap', 'splits', 'egg timer', 'minutes', 'seconds', 'chronometer', 'time something', 'alarm',
    'ساعة إيقاف', 'مؤقت', 'مؤقّت', 'عد تنازلي', 'لفة', 'توقيت', 'دقائق', 'ثواني', 'منبه',
  ],
  status: 'stable',
  Icon: TimerIcon,
  component: lazyTool(() => import('./StopwatchTool')),
  ar: {
    name: 'ساعة إيقاف ومؤقّت',
    tagline: 'تعدّ تصاعديًا وتنازليًا وتضبط الوقت.',
    description:
      'ساعة إيقاف بلفّات ومؤقّت تنازلي بمنبّه، في مكان واحد. وكلاهما يأخذ وقته من الساعة نفسها لا بعدّ النبضات، فلا تضيع الدقائق حين تنتقل بين التبويبات أو تُقفل الهاتف أو تتركه في الخلفية — وهذا ما يفسد المؤقّتات في المتصفح عادةً. أما أداة العدّ التنازلي هنا فهي لتاريخ بعيد، والبومودورو لجلسات ثابتة؛ وهذه هي اليومية.',
  },
}
