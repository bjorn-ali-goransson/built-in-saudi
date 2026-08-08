import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KaabaIcon } from '../../components/icons'

export const hajjUmrahTool: Tool = {
  id: 'hajj-umrah',
  name: 'Hajj & Umrah Guide',
  nameAr: 'دليل الحج والعمرة',
  tagline: 'The rites step by step, with the duas and a tracker.',
  description:
    'A step-by-step guide to ʿUmrah and Ḥajj — every act with its supplication and its fiqh ruling. Switch between ʿUmrah (default) and Ḥajj, filter to just the pillars and duties or read the full guide with the recommended sunan, and tap each step to track your progress. Fully offline.',
  category: 'Islamic',
  keywords: ['hajj', 'umrah', 'pilgrimage', 'manasik', 'ihram', 'tawaf', 'saee', 'arafah', 'guide', 'حج', 'عمرة', 'مناسك', 'إحرام', 'طواف', 'سعي', 'عرفة'],
  status: 'stable',
  Icon: KaabaIcon,
  component: lazyTool(() => import('./HajjUmrahTool')),
  ar: {
    name: 'دليل الحج والعمرة',
    tagline: 'المناسك خطوةً بخطوة، مع الأدعية وعدّاد تقدّم.',
    description:
      'دليل خطوةً بخطوة لأداء العمرة والحج — كل عمل مع دعائه وحكمه الفقهي. بدّل بين العمرة (الافتراضية) والحج، واعرض الأركان والواجبات فقط أو الدليل كاملًا مع السنن، واضغط كل خطوة لتتبّع تقدّمك. يعمل دون اتصال.',
  },
}
