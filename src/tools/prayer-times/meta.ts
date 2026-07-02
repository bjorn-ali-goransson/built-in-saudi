import { lazy } from 'react'
import type { Tool } from '../types'
import { MoonIcon } from '../../components/icons'

export const prayerTimesTool: Tool = {
  id: 'prayer-times',
  name: 'Prayer Times & Hijri Calendar',
  nameAr: 'مواقيت الصلاة والتقويم الهجري',
  tagline: 'Umm al-Qura prayer times, Hijri dates, Ramadan & Eid.',
  description:
    'Accurate daily prayer times using the Umm al-Qura method, today’s Hijri date, a Hijri ↔ Gregorian converter, and upcoming Islamic dates including Ramadan and the two Eids. Pick a Saudi city or use your location — everything is computed in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'prayer times', 'salah', 'salat', 'umm al-qura', 'hijri', 'gregorian',
    'ramadan', 'eid', 'islamic calendar', 'adhan', 'مواقيت الصلاة', 'هجري', 'رمضان',
  ],
  status: 'stable',
  Icon: MoonIcon,
  component: lazy(() => import('./PrayerTimesTool')),
  ar: {
    name: 'مواقيت الصلاة والتقويم الهجري',
    tagline: 'مواقيت الصلاة بطريقة أم القرى، والتاريخ الهجري، ورمضان والعيدان.',
    description:
      'مواقيت صلاة يومية دقيقة بطريقة أم القرى، وتاريخ اليوم الهجري، ومحوّل بين الهجري والميلادي، والمناسبات الإسلامية القادمة بما فيها رمضان والعيدان. اختر مدينة سعودية أو استخدم موقعك — كل شيء يُحسب داخل متصفحك.',
  },
}
