import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const idExpiryTool: Tool = {
  id: 'id-expiry',
  name: 'Iqama & ID Expiry',
  nameAr: 'انتهاء الإقامة والوثائق',
  tagline: 'Days left on your iqama, passport, licence and istimara.',
  description:
    'Track when your documents run out. Enter an expiry date in either the Hijri or Gregorian calendar and see the days remaining in both, sorted by whichever runs out first — iqama, passport, driving licence, vehicle registration, insurance or a visa. Everything stays in this browser: no account, nothing uploaded.',
  category: 'Saudi / Local',
  keywords: ['iqama', 'expiry', 'residency', 'passport', 'licence', 'istimara', 'إقامة', 'انتهاء', 'صلاحية', 'جواز', 'استمارة', 'رخصة', 'تجديد'],
  status: 'beta',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./IdExpiryTool')),
  ar: {
    name: 'انتهاء الإقامة والوثائق',
    tagline: 'الأيام المتبقية على إقامتك وجوازك ورخصتك واستمارتك.',
    description:
      'تابع مواعيد انتهاء وثائقك. أدخل تاريخ الانتهاء بالتقويم الهجري أو الميلادي وشاهد الأيام المتبقية بالتقويمين، مرتّبة بحسب الأقرب انتهاءً — الإقامة أو الجواز أو رخصة القيادة أو استمارة المركبة أو التأمين أو التأشيرة. كل شيء يبقى في هذا المتصفح: بلا حساب، وبلا رفع.',
  },
}
