import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const workingDaysTool: Tool = {
  id: 'working-days',
  name: 'Working Days Calculator',
  tagline: 'Count business days between two dates.',
  description:
    'Count the working days between two dates, excluding the weekend — Friday–Saturday for Saudi Arabia or Saturday–Sunday elsewhere — with totals for calendar days and weekend days. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['working days', 'business days', 'weekday', 'weekend', 'date range', 'أيام العمل', 'أيام الدوام', 'عطلة'],
  status: 'stable',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./WorkingDaysTool')),
  ar: {
    name: 'حاسبة أيام العمل',
    tagline: 'احسب أيام العمل بين تاريخين.',
    description:
      'احسب أيام العمل بين تاريخين باستثناء نهاية الأسبوع — الجمعة والسبت للسعودية أو السبت والأحد لغيرها — مع مجاميع للأيام الكلية وأيام العطلة. تعمل بالكامل في متصفحك.',
  },
}
