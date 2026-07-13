import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const countdownTool: Tool = {
  id: 'countdown',
  name: 'Countdown Timer',
  tagline: 'Live countdown to any date and time.',
  description:
    'Set a target date and time — a deadline, launch, trip or celebration — and watch a live countdown of days, hours, minutes and seconds tick down. Your event is remembered on this device. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['countdown', 'timer', 'deadline', 'event', 'date', 'days until', 'عد تنازلي', 'موعد', 'مناسبة'],
  status: 'stable',
  Icon: TimerIcon,
  component: lazyTool(() => import('./CountdownTool')),
  ar: {
    name: 'العدّ التنازلي',
    tagline: 'عدّ تنازلي حيّ لأي تاريخ ووقت.',
    description:
      'حدّد تاريخًا ووقتًا مستهدفًا — موعدًا نهائيًا أو إطلاقًا أو رحلة أو احتفالًا — وشاهد عدًّا تنازليًا حيًّا بالأيام والساعات والدقائق والثواني. تُحفظ مناسبتك على هذا الجهاز. يعمل بالكامل في متصفحك.',
  },
}
