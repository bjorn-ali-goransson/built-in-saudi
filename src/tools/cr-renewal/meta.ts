import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const crRenewalTool: Tool = {
  id: 'cr-renewal',
  name: 'Commercial Registration Renewal',
  tagline: 'When it opens, when it expires, and what the grace period really costs.',
  description:
    'Work out when a Saudi commercial registration can be renewed and when it must be. Renewal opens 90 days before expiry and there is a further 90 days after it — but that grace is not an extension: fines run from the expiry date and the commercial identity can be cancelled past it. An unpaid Chamber of Commerce subscription blocks the renewal on the day. Dates in both calendars, exportable to your calendar.',
  category: 'Saudi / Local',
  keywords: [
    'commercial registration', 'cr renewal', 'سجل تجاري', 'تجديد السجل التجاري', 'السجل التجاري',
    'commercial register', 'business licence', 'ministry of commerce', 'وزارة التجارة',
    'الغرفة التجارية', 'chamber of commerce', 'مهلة السماح', 'انتهاء السجل', 'رخصة بلدية', 'balady',
  ],
  status: 'beta',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./CrRenewalTool')),
  ar: {
    name: 'تجديد السجل التجاري',
    tagline: 'متى يفتح، ومتى ينتهي، وكم تكلّف مهلة السماح فعلًا.',
    description:
      'اعرف متى يمكن تجديد السجل التجاري ومتى يجب. يفتح التجديد قبل الانتهاء بتسعين يومًا، وبعده تسعون يومًا أخرى — لكنها ليست تمديدًا: الغرامات تجري من تاريخ الانتهاء، والهوية التجارية عرضة للإلغاء بعدها. واشتراك الغرفة التجارية غير المدفوع يمنع التجديد يوم تحاول. المواعيد بالتقويمين وقابلة للتصدير إلى تقويمك.',
  },
}
