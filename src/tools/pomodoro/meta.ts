import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const pomodoroTool: Tool = {
  id: 'pomodoro',
  name: 'Pomodoro Timer',
  tagline: 'Focus in 25-minute sprints with breaks.',
  description:
    'A distraction-free Pomodoro timer: work in focused sprints, take short and long breaks, and let it cycle automatically with a gentle chime and a round counter. Your custom lengths are remembered on this device. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['pomodoro', 'timer', 'focus', 'productivity', 'break', 'study', 'work', 'مؤقت', 'تركيز', 'إنتاجية'],
  status: 'stable',
  Icon: TimerIcon,
  component: lazyTool(() => import('./PomodoroTool')),
  ar: {
    name: 'مؤقّت بومودورو',
    tagline: 'ركّز في جلسات 25 دقيقة مع فترات راحة.',
    description:
      'مؤقّت بومودورو خالٍ من التشتيت: اعمل في جلسات مركّزة، وخذ فترات راحة قصيرة وطويلة، ودعه يتنقّل تلقائيًا مع نغمة لطيفة وعدّاد جولات. تُحفظ مدّتك المخصّصة على هذا الجهاز. يعمل بالكامل في متصفحك.',
  },
}
