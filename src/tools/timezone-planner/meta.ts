import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GlobeIcon } from '../../components/icons'

export const timezonePlannerTool: Tool = {
  id: 'timezone-planner',
  name: 'Time Zone Planner',
  nameAr: 'مخطّط المناطق الزمنية',
  tagline: 'Find an hour that is not the middle of someone’s night.',
  description:
    'Add the places your people are in and see the whole day at once, colour-coded by whether each hour lands in working hours, at the edges, or in the middle of the night. It ranks the best few slots for everyone. Offsets come from your browser’s own timezone data, so daylight saving on the chosen date is already handled — including places that change on a different weekend to yours.',
  category: 'Calculators',
  keywords: ['timezone', 'time zone', 'meeting', 'planner', 'world clock', 'utc', 'converter', 'مناطق زمنية', 'توقيت', 'اجتماع', 'فارق التوقيت'],
  status: 'stable',
  Icon: GlobeIcon,
  component: lazyTool(() => import('./TimezonePlannerTool')),
  ar: {
    name: 'مخطّط المناطق الزمنية',
    tagline: 'اعثر على ساعة ليست منتصف الليل عند أحدهم.',
    description:
      'أضف أماكن فريقك وشاهد اليوم كاملًا دفعة واحدة، ملوّنًا بحسب وقوع كل ساعة في وقت العمل أو على أطرافه أو في منتصف الليل. وترتّب الأداة أفضل الأوقات للجميع. تأتي الفوارق من بيانات المناطق الزمنية في متصفحك، فالتوقيت الصيفي في التاريخ المختار محسوب أصلًا — حتى للأماكن التي تغيّره في عطلة مختلفة عنك.',
  },
}
