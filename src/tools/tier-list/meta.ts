import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TierIcon } from '../../components/icons'

export const tierListTool: Tool = {
  id: 'tier-list',
  name: 'Tier List Maker',
  tagline: 'Rank anything into S–D tiers, then export.',
  description:
    'Add labels for the things you want to rank, then drag them into S, A, B, C and D tiers to build a classic tier list — and download it as an image to share. Your list is saved in this browser; nothing is uploaded.',
  category: 'Design',
  keywords: ['tier list', 'ranking', 'rank', 's tier', 'compare', 'vote', 'قائمة تصنيف', 'ترتيب', 'تصنيف'],
  status: 'stable',
  Icon: TierIcon,
  component: lazyTool(() => import('./TierListTool')),
  ar: {
    name: 'صانع قوائم التصنيف',
    tagline: 'صنّف أي شيء في فئات S–D ثم صدّرها.',
    description:
      'أضِف تسميات للأشياء التي تريد ترتيبها، ثم اسحبها إلى فئات S وA وB وC وD لبناء قائمة تصنيف كلاسيكية — ونزّلها كصورة للمشاركة. تُحفظ قائمتك في هذا المتصفح؛ لا يُرفع أي شيء.',
  },
}
