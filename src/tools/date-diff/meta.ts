import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const dateDiffTool: Tool = {
  id: 'date-diff',
  name: 'Date Diff',
  tagline: 'How long between two dates, how many of them are working days, and how old you are.',
  description:
    'Find the exact duration between two dates in the Gregorian or Hijri calendar: years, months and days, total days and weeks, and how many of them are working days (with a Friday–Saturday or Saturday–Sunday weekend). The Age tab takes a date of birth and gives the exact age, the weekday you were born on and the days to your next birthday. Runs entirely in your browser.',
  category: 'Calculators',
  // The whole phrase, so the query has something to match as one string.
  keywords: [
    'days between two dates', 'date', 'difference', 'duration', 'days between', 'how many days', 'الفرق بين تاريخين',
    // Merged in from the Age Calculator and the Working Days Calculator (November 2026).
    'age', 'birthday', 'how old', 'عمر', 'ميلاد', 'حساب العمر',
    'working days', 'business days', 'weekday', 'weekend', 'أيام العمل', 'أيام الدوام', 'عطلة',
  ],
  aliases: ['Age Calculator', 'Working Days Calculator', 'حاسبة العمر', 'حاسبة أيام العمل'],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./DateDiffTool')),
  ar: {
    name: 'الفرق بين تاريخين',
    tagline: 'كم المدة بين تاريخين، وكم منها أيام عمل، وكم عمرك.',
    description:
      'احسب المدة الدقيقة بين تاريخين بالتقويم الميلادي أو الهجري: سنوات وأشهر وأيام، وإجمالي الأيام والأسابيع، وكم منها أيام عمل (مع عطلة الجمعة والسبت أو السبت والأحد). وفي تبويب العمر أدخل تاريخ الميلاد لترى عمرك بدقة، ويوم الأسبوع الذي وُلدت فيه، والأيام الباقية لميلادك القادم. يعمل بالكامل داخل متصفحك.',
  },
}
