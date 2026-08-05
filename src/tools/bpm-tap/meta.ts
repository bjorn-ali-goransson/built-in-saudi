import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiceIcon } from '../../components/icons'

export const bpmTapTool: Tool = {
  id: 'bpm-tap',
  name: 'Tap BPM',
  nameAr: 'قياس الإيقاع بالنقر',
  tagline: 'Tap along, get the tempo — and the delay times.',
  description:
    'Find a track’s tempo by tapping along. It averages over a sliding window rather than everything since you started, so it follows a tempo change instead of burying it, and it tells you how steady your tapping actually was — a number with no confidence attached is how people end up trusting a bad reading. It also gives the quarter, eighth, dotted-eighth and bar times in milliseconds, which is what a delay pedal wants.',
  category: 'Calculators',
  keywords: ['bpm', 'tap tempo', 'tempo', 'beats per minute', 'delay time', 'dj', 'إيقاع', 'نقر', 'تمبو', 'زمن التأخير', 'موسيقى'],
  status: 'stable',
  Icon: DiceIcon,
  component: lazyTool(() => import('./BpmTapTool')),
  ar: {
    name: 'قياس الإيقاع بالنقر',
    tagline: 'انقر مع الموسيقى لتعرف الإيقاع وأزمنة التأخير.',
    description:
      'اعرف إيقاع مقطع بالنقر معه. تحسب الأداة المتوسط على نافذة متحركة بدل كل شيء منذ البداية، فتتابع تغيّر الإيقاع بدل أن تدفنه، وتخبرك بمدى ثبات نقرك فعلًا — فالرقم بلا ثقة مرفقة هو ما يجعل الناس يثقون بقراءة خاطئة. وتعطيك أيضًا أزمنة النغمة الربعية والثمانية والثمانية المنقوطة والمازورة بالمللي ثانية، وهو ما يحتاجه جهاز التأخير.',
  },
}
