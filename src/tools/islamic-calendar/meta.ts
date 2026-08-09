import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { IslamicCalendarIcon } from '../../components/icons'

export const islamicCalendarTool: Tool = {
  id: 'islamic-calendar',
  name: 'Islamic Calendar',
  nameAr: 'التقويم الإسلامي',
  tagline: 'Hijri month view with moon phases, white days & holidays.',
  description:
    'A month-at-a-glance Islamic calendar (Umm al-Qura): switch between Hijri and Gregorian, see the moon phase for each day, the white days (ayyām al-bīḍ, 13–15), and Islamic dates like Ramadan and the two Eids. Tap a day for details. Computed in your browser.',
  category: 'Islamic',
  keywords: ['islamic calendar', 'hijri', 'month', 'moon', 'white days', 'ayyam al beed', 'ramadan', 'when is ramadan', 'ramadan start', 'eid', 'when is eid', 'umm al-qura', 'تقويم', 'هجري', 'الأيام البيض', 'رمضان', 'متى رمضان', 'بداية رمضان', 'متى العيد'],
  status: 'stable',
  Icon: IslamicCalendarIcon,
  component: lazyTool(() => import('./IslamicCalendarTool')),
  ar: {
    name: 'التقويم الإسلامي',
    tagline: 'عرض شهري هجري مع أطوار القمر والأيام البيض والمناسبات.',
    description:
      'تقويم إسلامي شهري (أم القرى): بدّل بين الهجري والميلادي، واعرف طور القمر لكل يوم، والأيام البيض (١٣–١٥)، والمناسبات الإسلامية كرمضان والعيدين. اضغط على يومٍ لمزيد من التفاصيل. يُحسب داخل متصفحك.',
  },
}
