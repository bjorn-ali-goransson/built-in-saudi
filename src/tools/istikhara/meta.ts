import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CompassStarIcon } from '../../components/icons'

export const istikharaTool: Tool = {
  id: 'istikhara',
  name: 'Istikhara Du‘a',
  nameAr: 'دعاء الاستخارة',
  tagline: 'The prayer for guidance — how to pray it + the du‘a.',
  description:
    'The du‘a of Ṣalāt al-Istikhāra (the prayer for guidance) — the prophetic Arabic text with transliteration, an English meaning, how to pray the two rakʿahs, and the source (Jābir ibn ʿAbdillāh · Ṣaḥīḥ al-Bukhārī). Fully offline.',
  category: 'Islamic',
  keywords: ['istikhara', 'istikhaara', 'guidance prayer', 'dua', 'salat al-istikhara', 'استخارة', 'دعاء', 'صلاة الاستخارة'],
  status: 'stable',
  Icon: CompassStarIcon,
  component: lazyTool(() => import('./IstikharaTool')),
  ar: {
    name: 'دعاء الاستخارة',
    tagline: 'صلاة الاستخارة — كيفيتها ودعاؤها.',
    description:
      'دعاء صلاة الاستخارة — النص النبوي بالعربية مع النطق والمعنى بالإنجليزية، وكيفية أداء الركعتين، والمصدر (جابر بن عبد الله · صحيح البخاري). يعمل دون اتصال.',
  },
}
