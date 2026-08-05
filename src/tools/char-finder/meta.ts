import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SearchIcon } from '../../components/icons'

export const charFinderTool: Tool = {
  id: 'char-finder',
  name: 'Character Finder',
  nameAr: 'باحث المحارف',
  tagline: 'Find ﷺ, ﷼, →, ✓ and the rest without a character map.',
  description:
    'Search for the character you need by name — arrows, maths symbols, currency, Arabic marks and ligatures like ﷺ and ﷼, punctuation, ticks and crosses — then tap to copy it. The inspect mode goes the other way: paste anything and see exactly what each character is, which is how you find the lookalike letter hiding in a document.',
  category: 'Text',
  keywords: ['unicode', 'character map', 'symbols', 'emoji', 'copy paste', 'arrows', 'ﷺ', 'رموز', 'محارف', 'يونيكود', 'نسخ', 'علامات'],
  status: 'stable',
  Icon: SearchIcon,
  component: lazyTool(() => import('./CharFinderTool')),
  ar: {
    name: 'باحث المحارف والرموز',
    tagline: 'اعثر على ﷺ و﷼ و→ و✓ دون خريطة محارف.',
    description:
      'ابحث عن المحرف الذي تريده بالاسم — أسهم ورموز رياضية وعملات وعلامات عربية وتركيبات مثل ﷺ و﷼ وعلامات ترقيم وصح وخطأ — ثم انقر لنسخه. ووضع الفحص يعمل بالعكس: الصق أي شيء لترى حقيقة كل محرف، وهكذا تكتشف الحرف الشبيه المختبئ في مستند.',
  },
}
