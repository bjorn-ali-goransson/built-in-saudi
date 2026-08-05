import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { WheelIcon } from '../../components/icons'

export const spinWheelTool: Tool = {
  id: 'spin-wheel',
  name: 'Wheel of Names',
  nameAr: 'عجلة الأسماء',
  tagline: 'Paste a list, spin, get a winner.',
  description:
    'A spinning wheel for picking a name fairly — for a classroom, a giveaway, a team draw or deciding who presents first. Paste the names, spin, and optionally drop each winner so nobody is drawn twice. The result is chosen with the browser’s cryptographic random source, not Math.random, and your list stays in this browser.',
  category: 'Generators',
  keywords: ['wheel', 'random', 'picker', 'raffle', 'names', 'draw', 'spinner', 'giveaway', 'عجلة', 'قرعة', 'اختيار عشوائي', 'أسماء', 'سحب'],
  status: 'stable',
  Icon: WheelIcon,
  component: lazyTool(() => import('./SpinWheelTool')),
  ar: {
    name: 'عجلة الأسماء',
    tagline: 'الصق قائمة، أدر العجلة، واحصل على فائز.',
    description:
      'عجلة دوّارة لاختيار اسم بعدل — لفصل دراسي أو مسابقة أو توزيع فريق أو تحديد من يعرض أولًا. الصق الأسماء وأدر العجلة، ويمكنك حذف كل فائز حتى لا يتكرر أحد. تُختار النتيجة عبر مصدر العشوائية التعموي في المتصفح لا عبر Math.random، وتبقى قائمتك في هذا المتصفح.',
  },
}
