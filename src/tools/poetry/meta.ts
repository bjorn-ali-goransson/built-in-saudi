import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ParagraphIcon } from '../../components/icons'

export const poetryTool: Tool = {
  id: 'arabic-poetry',
  name: 'Arabic Poetry Meters',
  nameAr: 'بحور الشعر',
  tagline: 'The 16 metres with examples + a verse formatter.',
  description:
    'The sixteen classical Arabic poetic metres (buḥūr) of al-Khalīl — each with its tafʿīlāt and a famous example bayt — plus a verse formatter: paste poetry and it lays each bayt out in the traditional two-hemistich (ṣadr / ʿajz) form. Fully offline.',
  category: 'Text',
  keywords: ['poetry', 'arabic', 'meters', 'buhur', 'bahr', 'aroud', 'prosody', 'شعر', 'بحور', 'العروض', 'تفعيلات', 'بيت'],
  status: 'stable',
  Icon: ParagraphIcon,
  component: lazyTool(() => import('./PoetryTool')),
  ar: {
    name: 'بحور الشعر',
    tagline: 'البحور الستة عشر بأمثلتها + منسّق الأبيات.',
    description:
      'بحور الشعر العربي الستة عشر عند الخليل بن أحمد — كلٌّ بتفعيلاته وبمثالٍ مشهور — مع منسّق للأبيات: الصق الشعر فيُنسَّق كل بيتٍ في صورته العمودية (صدر وعجز). يعمل دون اتصال.',
  },
}
