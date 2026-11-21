import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarGroupIcon } from '../../components/icons'

export const findTimeTool: Tool = {
  id: 'find-time',
  name: 'Find a Time',
  nameAr: 'ابحث عن موعد',
  tagline: 'One link: everyone marks when they are free, and the times that suit all of you light up.',
  description:
    'Find a meeting time for a group. Name the people you are inviting and send them one link; each of them drags across the times they are free in a week view of the next seven days, shown in their own time zone. Everybody sees who has answered and the times that suit everyone, updating live, and can ask for a notification when the best times change. People sign in with a passkey, not a password, and every poll is deleted a month after it is made.',
  category: 'Business',
  keywords: [
    'find a time', 'group availability', 'meeting poll', 'when is everyone free', 'best time to meet',
    'time zones', 'doodle', 'when2meet',
    'أنسب موعد', 'تنسيق موعد', 'متى الجميع متفرغ', 'استطلاع موعد', 'مناطق زمنية',
  ],
  status: 'beta',
  Icon: CalendarGroupIcon,
  component: lazyTool(() => import('./FindTimeTool')),
  ar: {
    name: 'ابحث عن موعد',
    tagline: 'رابط واحد: يحدّد كلٌّ أوقات فراغه، فتظهر الأوقات التي تناسبكم جميعًا.',
    description:
      'ابحث عن موعد اجتماع لمجموعة. سمِّ من تدعوهم وأرسل لهم رابطًا واحدًا؛ يسحب كلٌّ منهم على أوقات فراغه في عرض أسبوعي للأيام السبعة القادمة، معروضًا بتوقيته المحلي. يرى الجميع من أجاب والأوقات التي تناسب الكل، وتتحدّث مباشرةً، ويمكنهم طلب تنبيه حين تتغير أفضل الأوقات. يسجّل الناس الدخول بمفتاح مرور لا بكلمة مرور، ويُحذف كل استطلاع بعد شهر من إنشائه.',
  },
}
