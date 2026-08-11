import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BriefcaseIcon } from '../../components/icons'

export const retirementAgeTool: Tool = {
  id: 'retirement-age',
  name: 'When Can I Retire? (GOSI)',
  tagline: 'It is not 60 any more, and one date decides which rule you are under.',
  description:
    'Work out when you can draw a GOSI pension under the Social Insurance Law in force from 3 July 2024. Somebody with no contributions before that date retires at 65, with early retirement no sooner than 55; everybody else falls in a 58-to-65 band set by their age on that day. The pension itself is the average wage of your last two years times contribution months divided by 480 — so each year buys 2.5%, and the last two years decide the lot.',
  category: 'Saudi / Local',
  keywords: [
    'retirement', 'retirement age', 'pension', 'gosi', 'التقاعد', 'سن التقاعد', 'المعاش',
    'تقاعد مبكر', 'early retirement', 'معاش التقاعد', 'متى أتقاعد',
    'النظام الجديد', 'نظام التأمينات', 'pension age',
  ],
  status: 'beta',
  Icon: BriefcaseIcon,
  component: lazyTool(() => import('./RetirementAgeTool')),
  ar: {
    name: 'متى أتقاعد؟ (التأمينات)',
    tagline: 'لم يعد ٦٠، وتاريخ واحد يحدّد أي قاعدة تنطبق عليك.',
    description:
      'اعرف متى يمكنك صرف معاش التأمينات وفق نظام التأمينات الاجتماعية النافذ من ٣ يوليو ٢٠٢٤. فمن لا اشتراك له قبل ذلك التاريخ يتقاعد في ٦٥ ولا يتقاعد مبكرًا قبل ٥٥، ومن عداه يقع في نطاق ٥٨ إلى ٦٥ يحدّده عمره في ذلك اليوم. والمعاش نفسه متوسط أجر آخر سنتين × أشهر الاشتراك ÷ ٤٨٠ — فكل سنة تشتري ٢٫٥٪، وآخر سنتين تحسمان الأمر كله.',
  },
}
