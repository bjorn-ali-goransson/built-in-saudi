import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VolumeIcon } from '../../components/icons'

export const removeSilenceTool: Tool = {
  id: 'remove-silence',
  name: 'Remove Silence',
  nameAr: 'حذف الصمت',
  tagline: 'Cut the dead air out of a recording.',
  description:
    'Cut the silence out of an audio recording — the pauses in a lecture, the gaps in an interview, the dead air at the start. Set how quiet counts as silent and how long a gap has to be, and see exactly what will go before it goes. A margin is kept at each edge so a breath before a word survives, because a cut made exactly on the silence sounds chopped. Runs entirely in your browser.',
  category: 'Files',
  keywords: [
    'audio', 'silence', 'remove', 'trim', 'podcast', 'lecture', 'recording', 'dead air', 'gaps', 'shorten', 'edit',
    'صوت', 'صمت', 'حذف', 'قص', 'بودكاست', 'محاضرة', 'تسجيل', 'سكتات', 'تحرير',
  ],
  status: 'stable',
  Icon: VolumeIcon,
  component: lazyTool(() => import('./RemoveSilenceTool')),
  ar: {
    name: 'حذف الصمت',
    tagline: 'احذف الفراغ من تسجيلك.',
    description:
      'احذف الصمت من تسجيل صوتي — سكتات المحاضرة، وفجوات المقابلة، والفراغ في البداية. حدّد ما يُعدّ صمتًا وكم يجب أن تطول السكتة، وشاهد بالضبط ما سيُحذف قبل حذفه. ويُترك هامش عند كل طرف لتبقى الشهقة قبل الكلمة، فالقص على حدّ الصمت تمامًا يجعل النتيجة مبتورة. يعمل داخل متصفحك بالكامل.',
  },
}
