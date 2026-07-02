import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const dateDiffTool: Tool = {
  id: 'date-diff',
  name: 'Date Difference',
  tagline: 'How long between two dates — years, months, days.',
  description:
    'Find the exact duration between two dates: years, months and days, plus total days and weeks. Great for ages, deadlines and durations. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['date', 'difference', 'duration', 'days between', 'age', 'how many days', 'الفرق بين تاريخين'],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./DateDiffTool')),
  ar: {
    name: 'الفرق بين تاريخين',
    tagline: 'كم المدة بين تاريخين — سنوات وأشهر وأيام.',
    description:
      'احسب المدة الدقيقة بين تاريخين: سنوات وأشهر وأيام، بالإضافة إلى إجمالي الأيام والأسابيع. مناسب للأعمار والمواعيد والمدد. يعمل بالكامل داخل متصفحك.',
  },
}
