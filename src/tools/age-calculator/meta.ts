import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CakeIcon } from '../../components/icons'

export const ageCalculatorTool: Tool = {
  id: 'age-calculator',
  name: 'Age Calculator',
  tagline: 'Your exact age, and the countdown to your next birthday.',
  description:
    'Enter a birth date to see the exact age in years, months and days, the totals in months, weeks and days, the weekday you were born on, and a countdown to the next birthday. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['age', 'birthday', 'date', 'how old', 'years', 'countdown', 'عمر', 'ميلاد', 'حساب العمر'],
  status: 'stable',
  Icon: CakeIcon,
  component: lazyTool(() => import('./AgeCalculatorTool')),
  ar: {
    name: 'حاسبة العمر',
    tagline: 'عمرك بدقّة، والعدّ التنازلي لميلادك القادم.',
    description:
      'أدخل تاريخ الميلاد لترى العمر بدقّة بالسنوات والأشهر والأيام، والمجاميع بالأشهر والأسابيع والأيام، ويوم الأسبوع الذي وُلدت فيه، وعدًّا تنازليًا للميلاد القادم. تعمل بالكامل في متصفحك.',
  },
}
