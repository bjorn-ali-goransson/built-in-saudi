import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PercentIcon } from '../../components/icons'

export const percentageCalculatorTool: Tool = {
  id: 'percentage-calculator',
  name: 'Percentage Calculator',
  tagline: 'Every everyday percentage question, solved.',
  description:
    'Answer the common percentage questions instantly: what is X% of Y, X is what percent of Y, and the percentage increase or decrease from one number to another. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['percentage', 'percent', 'increase', 'decrease', 'change', 'ratio', 'math', 'نسبة', 'مئوية', 'زيادة'],
  status: 'stable',
  Icon: PercentIcon,
  component: lazyTool(() => import('./PercentageCalculatorTool')),
  ar: {
    name: 'حاسبة النسبة المئوية',
    tagline: 'كل أسئلة النسب المئوية اليومية بحلٍّ فوري.',
    description:
      'أجب فورًا عن أسئلة النسب الشائعة: كم يساوي X% من Y، وX يمثّل أي نسبة من Y، ونسبة الزيادة أو النقص من رقم إلى آخر. تعمل بالكامل في متصفحك.',
  },
}
