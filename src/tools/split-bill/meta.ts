import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SplitIcon } from '../../components/icons'

export const splitBillTool: Tool = {
  id: 'split-bill',
  name: 'Bill Splitter',
  tagline: 'Split a bill with tip, evenly per person.',
  description:
    'Split a restaurant or group bill fairly: add an optional tip percentage, set how many people are paying, and see the per-person share and the grand total. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['bill', 'split', 'tip', 'restaurant', 'share', 'group', 'per person', 'فاتورة', 'تقسيم', 'بقشيش'],
  status: 'stable',
  Icon: SplitIcon,
  component: lazyTool(() => import('./SplitBillTool')),
  ar: {
    name: 'مقسّم الفاتورة',
    tagline: 'قسّم الفاتورة مع البقشيش بالتساوي على الأشخاص.',
    description:
      'قسّم فاتورة مطعم أو مجموعة بإنصاف: أضف نسبة بقشيش اختيارية، وحدّد عدد الدافعين، وشاهد نصيب كل شخص والمجموع الكلي. تعمل بالكامل في متصفحك.',
  },
}
