import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShieldIcon } from '../../components/icons'

export const hisnAlMuslimTool: Tool = {
  id: 'hisn-al-muslim',
  name: 'Hisn al-Muslim',
  nameAr: 'حصن المسلم',
  tagline: 'The Fortress of the Muslim — browsable du‘a collection.',
  description:
    'Ḥiṣn al-Muslim (the Fortress of the Muslim) — the full collection of adhkār and du‘as for daily life, compiled by Saʿīd b. Wahf al-Qaḥṭānī. Search the ~130 chapters and read the vocalized Arabic du‘as. Fully offline.',
  category: 'Saudi / Local',
  keywords: ['hisn al muslim', 'hisnul muslim', 'fortress of the muslim', 'dua', 'adhkar', 'حصن المسلم', 'أذكار', 'أدعية', 'القحطاني'],
  status: 'stable',
  Icon: ShieldIcon,
  component: lazyTool(() => import('./HisnAlMuslimTool')),
  ar: {
    name: 'حصن المسلم',
    tagline: 'مجموعة الأذكار والأدعية — قابلة للبحث.',
    description:
      'حصن المسلم — مجموعة الأذكار والأدعية لليوم والليلة، جمع سعيد بن وهف القحطاني. ابحث في نحو ١٣٠ بابًا واقرأ الأدعية بالنص العربي المشكول. يعمل دون اتصال.',
  },
}
