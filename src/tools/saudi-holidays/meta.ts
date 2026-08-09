import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarCheckIcon } from '../../components/icons'

export const saudiHolidaysTool: Tool = {
  id: 'saudi-holidays',
  name: 'Saudi Public Holidays',
  tagline: 'Every official paid holiday, and how long until the next one.',
  description:
    'The paid public holidays under Article 112 — Eid al-Fitr, Eid al-Adha, National Day and Founding Day — worked out for any year in both calendars, with the rules on weekend compensation and annual leave that the published lists leave out. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'holiday', 'holidays', 'public holidays', 'official holidays', 'day off',
    'eid', 'eid al-fitr', 'eid al-adha', 'ramadan', 'national day', 'founding day',
    'when is eid', 'days until eid', 'leave', 'article 112',
    'إجازة', 'إجازات', 'الإجازات الرسمية', 'العطل الرسمية', 'عيد', 'عيد الفطر',
    'عيد الأضحى', 'اليوم الوطني', 'يوم التأسيس', 'متى العيد', 'كم باقي على العيد',
  ],
  status: 'beta',
  Icon: CalendarCheckIcon,
  component: lazyTool(() => import('./SaudiHolidaysTool')),
  ar: {
    name: 'الإجازات الرسمية',
    tagline: 'كل إجازة رسمية مدفوعة، وكم بقي على القادمة.',
    description:
      'الإجازات الرسمية المدفوعة بموجب المادة ١١٢ — عيد الفطر وعيد الأضحى واليوم الوطني ويوم التأسيس — محسوبةً لأي سنة بالتقويمين، مع أحكام التعويض عن نهاية الأسبوع والإجازة السنوية التي تغفلها القوائم المنشورة. يعمل بالكامل داخل متصفحك.',
  },
}
