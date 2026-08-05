import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CardIcon } from '../../components/icons'

export const certificateTool: Tool = {
  id: 'certificate',
  name: 'Certificate Generator',
  nameAr: 'مولّد الشهادات',
  tagline: 'One name per line, one certificate each.',
  description:
    'Make certificates of completion or participation for a whole list at once — paste the names, set the wording and the signature lines, and download every page in one PDF. That bulk step is the whole point: nobody wants to retype a name forty times into a template. Arabic and Latin names both render correctly, including mixed in one list.',
  category: 'Business',
  keywords: ['certificate', 'award', 'completion', 'course', 'training', 'bulk', 'شهادة', 'شهادات', 'إتمام', 'دورة', 'تدريب', 'تكريم'],
  status: 'stable',
  Icon: CardIcon,
  component: lazyTool(() => import('./CertificateTool')),
  ar: {
    name: 'مولّد الشهادات',
    tagline: 'اسم في كل سطر، وشهادة لكل اسم.',
    description:
      'أنشئ شهادات إتمام أو مشاركة لقائمة كاملة دفعة واحدة — الصق الأسماء، واضبط النص وسطور التوقيع، ونزّل كل الصفحات في ملف PDF واحد. وهذه الدفعة هي المقصد كله: فلا أحد يريد إعادة كتابة اسم أربعين مرة في قالب. وتظهر الأسماء العربية واللاتينية بشكل صحيح، حتى مختلطة في قائمة واحدة.',
  },
}
