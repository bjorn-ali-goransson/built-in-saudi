import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TimerIcon } from '../../components/icons'

export const trafficFineTool: Tool = {
  id: 'traffic-fine',
  name: 'Traffic Fine Discount & Deadlines',
  tagline: 'The 25% reduction, and the day it lapses.',
  description:
    'Work out what a Saudi traffic fine costs at the 25% reduction under Article 75, and exactly when that reduction lapses. The 45 days are 30 to object plus 15 to pay, running one after the other — and a 90-day Absher extension carries the discount only 30 days further, not 90. Deadlines in both calendars, exportable to your calendar.',
  category: 'Saudi / Local',
  keywords: [
    'traffic fine', 'مخالفة', 'مخالفات', 'مخالفة مرورية', 'ساهر', 'saher', 'fine discount',
    'خصم المخالفات', 'تخفيض المخالفات', 'المادة 75', 'article 75', 'traffic violation',
    'pay fine', 'سداد المخالفة', 'مهلة السداد', 'اعتراض على مخالفة', 'absher', 'أبشر', 'غرامة',
  ],
  status: 'beta',
  Icon: TimerIcon,
  component: lazyTool(() => import('./TrafficFineTool')),
  ar: {
    name: 'خصم المخالفة المرورية ومهلها',
    tagline: 'تخفيض ٢٥٪ واليوم الذي يسقط فيه.',
    description:
      'احسب ما تكلّفه المخالفة المرورية بتخفيض ٢٥٪ وفق المادة ٧٥، ومتى يسقط هذا التخفيض بالضبط. فالـ٤٥ يومًا هي ٣٠ للاعتراض و١٥ للسداد تجريان تباعًا لا معًا، ومهلة أبشر البالغة ٩٠ يومًا لا تحمل التخفيض إلا ٣٠ يومًا إضافية لا ٩٠. المواعيد بالتقويمين، وقابلة للتصدير إلى تقويمك.',
  },
}
