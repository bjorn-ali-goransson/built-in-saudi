import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CakeIcon } from '../../components/icons'

export const hijriAgeTool: Tool = {
  id: 'hijri-age',
  name: 'Hijri Age Calculator',
  nameAr: 'حاسبة العمر الهجري',
  tagline: 'Your age in Hijri years, and the Gregorian one beside it.',
  description:
    'Enter a date of birth in either calendar and get your exact age in both — years, months and days, the total days lived, and when your next Hijri birthday falls. A Hijri year is about 354 days, so a Hijri age runs ahead of a Gregorian one by roughly a year every 33, which is why subtracting the year numbers gives the wrong answer.',
  category: 'Saudi / Local',
  keywords: ['hijri age', 'age calculator', 'islamic calendar', 'birthday', 'umm al-qura', 'العمر الهجري', 'حساب العمر', 'تاريخ الميلاد', 'هجري', 'ميلادي'],
  status: 'stable',
  Icon: CakeIcon,
  component: lazyTool(() => import('./HijriAgeTool')),
  ar: {
    name: 'حاسبة العمر الهجري',
    tagline: 'عمرك بالسنوات الهجرية، والميلادية بجانبه.',
    description:
      'أدخل تاريخ ميلادك بأي من التقويمين لتحصل على عمرك الدقيق بهما معًا — بالسنوات والأشهر والأيام، ومجموع الأيام المعاشة، وموعد ميلادك الهجري القادم. السنة الهجرية نحو ٣٥٤ يومًا، لذا يسبق العمر الهجري الميلادي بنحو سنة كل ٣٣ سنة، ولهذا يعطي طرحُ أرقام السنوات نتيجة خاطئة.',
  },
}
