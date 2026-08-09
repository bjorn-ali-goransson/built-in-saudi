import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const ovulationTool: Tool = {
  id: 'ovulation',
  name: 'Ovulation Calculator',
  nameAr: 'حاسبة الإباضة',
  tagline: 'The six days that matter, in both calendars.',
  description:
    'Find the fertile window from your last period and your cycle length — and see why it is not what most calculators say. Ovulation is about fourteen days before the NEXT period rather than fourteen days after the last, so on a long cycle it is not “day 14”; and the days that matter are the five BEFORE ovulation plus the day itself, because sperm outlive an egg by several days. Every date in the Hijri calendar as well as the Gregorian. Nothing is sent anywhere.',
  category: 'Calculators',
  keywords: [
    'ovulation', 'fertile', 'fertility', 'fertile window', 'cycle', 'period',
    'conceive', 'trying to conceive', 'ttc', 'luteal', 'menstrual', 'calendar',
    'إباضة', 'التبويض', 'الخصوبة', 'أيام الخصوبة', 'الدورة', 'الدورة الشهرية',
    'الحمل', 'موعد التبويض', 'حاسبة التبويض',
  ],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./OvulationTool')),
  ar: {
    name: 'حاسبة الإباضة',
    tagline: 'الأيام الستة التي تهمّ، بالتقويمين.',
    description:
      'اعرفي نافذة الخصوبة من آخر دورة وطول دورتك — واعرفي لماذا تختلف عمّا تقوله معظم الحاسبات. فالإباضة تقع قبل الدورة القادمة بنحو أربعة عشر يومًا لا بعد السابقة بأربعة عشر، فليست «اليوم ١٤» في الدورات الطويلة؛ والأيام التي تهمّ هي الخمسة السابقة للإباضة ويومها، لأن الحيوانات المنوية تعيش أطول من البويضة بأيام. وكل تاريخ بالهجري كما بالميلادي. ولا يُرسل شيء إلى أي مكان.',
  },
}
