import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GlobeIcon } from '../../components/icons'

export const exitReentryTool: Tool = {
  id: 'exit-reentry',
  name: 'Exit & Re-entry Visa Fee',
  nameAr: 'رسوم تأشيرة الخروج والعودة',
  tagline: 'What your trip actually costs.',
  description:
    'Work out the fee for the trip you are actually taking, and see the two things that catch people out. Months are charged in whole 30-day blocks, so 31 days costs the same as 60 while 61 costs a month more — the tool shows how many days you have before the price steps again. And the visa cannot outrun your iqama: a trip that returns after it expires is not a dearer visa, it is no visa at all until you renew, so that is said before the fee rather than after it. Extending from abroad costs double per month.',
  category: 'Saudi / Local',
  keywords: [
    'exit reentry', 'exit re-entry', 'visa fee', 'khuruj', 'iqama', 'travel', 'absher', 'muqeem', 'single visa', 'multiple visa', 'extension', 'expat',
    'خروج وعودة', 'تأشيرة', 'رسوم', 'إقامة', 'سفر', 'أبشر', 'مقيم', 'مفردة', 'متعددة', 'تمديد',
  ],
  status: 'stable',
  Icon: GlobeIcon,
  component: lazyTool(() => import('./ExitReentryTool')),
  ar: {
    name: 'رسوم تأشيرة الخروج والعودة',
    tagline: 'كم تكلّف رحلتك فعلًا.',
    description:
      'احسب رسوم الرحلة التي ستسافرها فعلًا، واطّلع على الأمرين اللذين يغفل عنهما الناس. فالأشهر تُحتسب كتلًا كاملة من ثلاثين يومًا، فـ31 يومًا كـ60 يومًا في السعر بينما 61 يومًا تزيد شهرًا — والأداة تبيّن كم يومًا بقي قبل أن يقفز السعر مجددًا. والتأشيرة لا تتجاوز إقامتك: فالرحلة التي تعود بعد انتهائها ليست تأشيرة أغلى بل لا تأشيرة أصلًا حتى تجدّد، ولهذا يُقال ذلك قبل الرسوم لا بعدها. والتمديد من الخارج يكلّف ضعف قيمة الشهر.',
  },
}
