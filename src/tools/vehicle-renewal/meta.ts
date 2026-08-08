import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const vehicleRenewalTool: Tool = {
  id: 'vehicle-renewal',
  name: 'Fahes & Istimara Due Dates',
  nameAr: 'مواعيد الفحص والاستمارة',
  tagline: 'Which one has to happen first.',
  description:
    'Work out when your periodic inspection and your vehicle registration are due — and, the part people find out at the counter, which one has to happen first. A valid Fahes is required to renew the istimara, so an overdue inspection blocks the renewal outright. A new private car is exempt from inspection for three years from first registration (two for taxis and public transport), which means the first one falls due on an anniversary nobody has a reminder for. Every date is shown in both Gregorian and Hijri, because the card may be in either.',
  category: 'Saudi / Local',
  keywords: [
    'fahes', 'fahas', 'mvpi', 'periodic inspection', 'istimara', 'vehicle registration', 'renewal', 'car', 'absher', 'expiry', 'due date', 'exemption',
    'الفحص الدوري', 'فحص', 'استمارة', 'تجديد', 'رخصة سير', 'سيارة', 'أبشر', 'انتهاء', 'موعد', 'إعفاء',
  ],
  status: 'beta',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./VehicleRenewalTool')),
  ar: {
    name: 'مواعيد الفحص والاستمارة',
    tagline: 'أيّهما قبل الآخر.',
    description:
      'اعرف متى يستحق الفحص الدوري ومتى تنتهي استمارتك — والأهم، وهو ما يكتشفه الناس عند النافذة، أيّهما قبل الآخر. فالفحص الساري شرط لتجديد الاستمارة، ومن ثمّ فالفحص المتأخر يمنع التجديد أصلًا. والسيارة الخاصة الجديدة معفاة من الفحص ثلاث سنوات من أول تسجيل (وسنتان للأجرة والنقل العام)، ومعنى ذلك أن أول فحص يستحق في ذكرى سنوية لا تذكير لأحد بها. وكل تاريخ معروض بالميلادي والهجري معًا، لأن البطاقة قد تكون بأيّهما.',
  },
}
