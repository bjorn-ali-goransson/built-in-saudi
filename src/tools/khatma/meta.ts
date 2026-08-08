import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BookmarkIcon } from '../../components/icons'

export const khatmaTool: Tool = {
  id: 'khatma',
  name: 'Khatma Planner',
  nameAr: 'مخطّط الختمة',
  tagline: 'Finish the Qur’an by a date you choose.',
  description:
    'Plan a khatma over any stretch of days — Ramadan, a month, a week — divided evenly by page or by juz, with Gregorian and Hijri dates side by side. Print it with a tick box per day, or tick the days off here; your progress stays on this device. Page numbers follow the 604-page Madani mushaf, and the tool says so, because a plan quoting pages from an edition you do not own is worse than no plan.',
  category: 'Islamic',
  keywords: [
    // Both spellings. This site writes British English in its own copy while
    // a keyword list, written by a developer, tends to the American form —
    // measured: 8 of 12 -ise/-ize variants missed, 5 returning nothing at all.
    'memorization',
    'quran', 'khatma', 'ramadan', 'reading plan', 'juz', 'mushaf', 'memorisation', 'schedule', 'daily', 'hijri',
    'ختمة', 'قرآن', 'رمضان', 'خطة قراءة', 'جزء', 'مصحف', 'ورد يومي', 'جدول', 'حفظ',
  ],
  status: 'stable',
  Icon: BookmarkIcon,
  component: lazyTool(() => import('./KhatmaTool')),
  ar: {
    name: 'مخطّط الختمة',
    tagline: 'أتمّ القرآن في الموعد الذي تختاره.',
    description:
      'خطّط ختمة على أي عدد من الأيام — رمضان أو شهر أو أسبوع — مقسّمة بالتساوي بالصفحات أو بالأجزاء، مع التاريخين الميلادي والهجري جنبًا إلى جنب. اطبعها بمربّع تعليم لكل يوم، أو علّم الأيام هنا؛ ويبقى تقدّمك على جهازك. وأرقام الصفحات بحسب مصحف المدينة ذي الـ٦٠٤ صفحات، والأداة تصرّح بذلك، لأن خطة بأرقام طبعة لا تملكها أسوأ من لا خطة.',
  },
}
