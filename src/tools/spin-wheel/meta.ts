import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { WheelIcon } from '../../components/icons'

export const spinWheelTool: Tool = {
  id: 'spin-wheel',
  name: 'Wheel of Names',
  nameAr: 'عجلة الأسماء',
  tagline: 'Spin for a name, split a list into teams, or roll dice.',
  description:
    'A spinning wheel for picking a name fairly — for a classroom, a giveaway, a team draw or deciding who presents first. Paste the names, spin, and optionally drop each winner so nobody is drawn twice. The result is chosen with the browser’s cryptographic random source, not Math.random, and your list stays in this browser. The same page splits a list into random teams — by how many teams or how many per team — and rolls any dice or flips a coin.',
  category: 'Generators',
  keywords: [
    // Merged in November 2026 from the tools this one replaced.
    'random picker', 'picker wheel','wheel', 'random', 'picker', 'raffle', 'names', 'draw', 'spinner', 'giveaway', 'عجلة', 'قرعة', 'اختيار عشوائي', 'أسماء', 'سحب',
    // Merged in from Random Team Maker and Dice Roller (November 2026).
    'team', 'teams', 'groups', 'split into teams', 'classroom', 'shuffle', 'فرق', 'مجموعات', 'توزيع', 'تقسيم إلى فرق',
    'dice', 'roll', 'd20', 'd6', 'coin flip', 'flip a coin', 'نرد', 'زهر', 'قطعة نقود', 'رمي عملة'],
  aliases: ['Random Team Maker', 'Dice Roller', 'مولّد الفرق العشوائي', 'رامي النرد'],
  status: 'stable',
  Icon: WheelIcon,
  component: lazyTool(() => import('./SpinWheelTool')),
  ar: {
    name: 'عجلة الأسماء',
    tagline: 'أدر العجلة لاختيار اسم، أو قسّم القائمة إلى فرق، أو ارمِ النرد.',
    description:
      'عجلة دوّارة لاختيار اسم بعدل — لفصل دراسي أو مسابقة أو توزيع فريق أو تحديد من يعرض أولًا. الصق الأسماء وأدر العجلة، ويمكنك حذف كل فائز حتى لا يتكرر أحد. تُختار النتيجة عبر مصدر العشوائية التعموي في المتصفح لا عبر Math.random، وتبقى قائمتك في هذا المتصفح. وتقسّم الصفحة نفسها القائمة إلى فرق عشوائية — بعدد الفرق أو بعدد الأفراد في كل فريق — وترمي أي نرد أو تقلب عملة.',
  },
}
