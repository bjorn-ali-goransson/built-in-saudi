import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const hijriCalendarTool: Tool = {
  id: 'hijri-calendar',
  name: 'Hijri Calendar',
  nameAr: 'التقويم الهجري',
  tagline: 'Hijri ↔ Gregorian converter and Islamic dates.',
  description:
    'Convert between Hijri and Gregorian dates (Umm al-Qura), see today’s Hijri date, and upcoming Islamic dates including Ramadan and the two Eids. Everything is computed in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'hijri', 'gregorian', 'converter', 'islamic calendar', 'ramadan', 'eid',
    'umm al-qura', 'هجري', 'ميلادي', 'تقويم', 'رمضان', 'عيد',
  ],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./HijriCalendarTool')),
  ar: {
    name: 'التقويم الهجري',
    tagline: 'محوّل بين الهجري والميلادي والمناسبات الإسلامية.',
    description:
      'حوّل بين التاريخ الهجري والميلادي (أم القرى)، واعرف تاريخ اليوم الهجري، والمناسبات الإسلامية القادمة بما فيها رمضان والعيدان. كل شيء يُحسب داخل متصفحك.',
  },
}
