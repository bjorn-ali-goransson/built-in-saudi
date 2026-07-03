import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MosqueIcon } from '../../components/icons'

export const prayerTimesTool: Tool = {
  id: 'prayer-times',
  name: 'Prayer Times',
  nameAr: 'مواقيت الصلاة',
  tagline: 'Umm al-Qura prayer times, with optional alerts.',
  description:
    'Accurate daily prayer times using the Umm al-Qura method. Pick a Saudi city or use your location — everything is computed in your browser. Optionally get a notification a few minutes before each prayer.',
  category: 'Saudi / Local',
  keywords: [
    'prayer times', 'salah', 'salat', 'umm al-qura', 'adhan', 'fajr', 'maghrib',
    'notifications', 'مواقيت الصلاة', 'صلاة', 'أذان', 'الفجر', 'المغرب',
  ],
  status: 'stable',
  Icon: MosqueIcon,
  component: lazyTool(() => import('./PrayerTimesTool')),
  ar: {
    name: 'مواقيت الصلاة',
    tagline: 'مواقيت الصلاة بطريقة أم القرى، مع تنبيهات اختيارية.',
    description:
      'مواقيت صلاة يومية دقيقة بطريقة أم القرى. اختر مدينة سعودية أو استخدم موقعك — كل شيء يُحسب داخل متصفحك. ويمكنك تفعيل تنبيه قبل كل صلاة بدقائق.',
  },
}
