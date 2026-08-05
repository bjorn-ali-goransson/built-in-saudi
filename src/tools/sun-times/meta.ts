import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SunHorizonIcon } from '../../components/icons'

export const sunTimesTool: Tool = {
  id: 'sun-times',
  name: 'Sunrise, Sunset & Golden Hour',
  nameAr: 'الشروق والغروب والساعة الذهبية',
  tagline: 'Every light of the day, worked out properly.',
  description:
    'Sunrise, sunset, solar noon, the three twilights, and the golden and blue hours for any place and date — computed from the sun’s actual altitude rather than a rule of thumb like “an hour after sunrise”, which is wrong nearly everywhere. Shows the Hijri date and the prayer times for the same spot, and leaves a row blank rather than inventing a time the sun never reaches.',
  category: 'Calculators',
  keywords: ['sunrise', 'sunset', 'golden hour', 'blue hour', 'twilight', 'photography', 'solar noon', 'شروق', 'غروب', 'الساعة الذهبية', 'الشفق', 'تصوير', 'الظهيرة'],
  status: 'stable',
  Icon: SunHorizonIcon,
  component: lazyTool(() => import('./SunTimesTool')),
  ar: {
    name: 'الشروق والغروب والساعة الذهبية',
    tagline: 'كل أضواء اليوم، محسوبة كما ينبغي.',
    description:
      'الشروق والغروب والظهيرة الشمسية والشفق بأنواعه الثلاثة والساعتان الذهبية والزرقاء لأي مكان وتاريخ — محسوبة من ارتفاع الشمس الفعلي لا من قاعدة تقريبية مثل «ساعة بعد الشروق» وهي خاطئة في معظم الأماكن. تعرض التاريخ الهجري وأوقات الصلاة للموضع نفسه، وتترك الصف فارغًا بدل اختلاق وقت لا تبلغه الشمس أصلًا.',
  },
}
