import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SunHorizonIcon } from '../../components/icons'

export const adhkarTool: Tool = {
  id: 'adhkar',
  name: 'Morning & Evening Adhkar',
  nameAr: 'أذكار الصباح والمساء',
  tagline: 'The daily remembrances with a tap counter.',
  description:
    'The core morning and evening adhkār from the Qur’an and authentic Sunnah — Arabic with transliteration, an English meaning, the repeat count and source, and a tap-to-count tracker that remembers today’s progress. Fully offline.',
  category: 'Saudi / Local',
  keywords: ['adhkar', 'azkar', 'morning evening', 'remembrance', 'dhikr', 'أذكار', 'الصباح', 'المساء', 'ذكر'],
  status: 'stable',
  Icon: SunHorizonIcon,
  component: lazyTool(() => import('./AdhkarTool')),
  ar: {
    name: 'أذكار الصباح والمساء',
    tagline: 'الأذكار اليومية مع عدّاد باللمس.',
    description:
      'أذكار الصباح والمساء الأساسية من القرآن والسنة الصحيحة — بالعربية مع النطق والمعنى بالإنجليزية وعدد التكرار والمصدر، وعدّاد باللمس يحفظ تقدّم اليوم. يعمل دون اتصال.',
  },
}
