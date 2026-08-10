import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BriefcaseIcon } from '../../components/icons'

export const sponsorshipTransferTool: Tool = {
  id: 'sponsorship-transfer',
  name: 'Sponsorship Transfer',
  tagline: 'The fee is tiered, and it is not yours to pay.',
  description:
    'What transferring sponsorship costs — 2,000, 4,000 or 6,000 depending on how many times the worker has moved before — who owes it under Article 40, whether you need your current employer to agree at all, and the 60-day window after a contract ends. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'sponsorship transfer', 'transfer sponsorship', 'change employer', 'kafala',
    'qiwa', 'transfer fee', 'new employer', 'without consent', 'article 40',
    'iqama transfer', 'job transfer', 'sponsor',
    'نقل الكفالة', 'نقل كفالة', 'نقل الخدمات', 'رسوم نقل الكفالة', 'تغيير صاحب العمل',
    'قوى', 'بدون موافقة الكفيل', 'كفيل', 'المادة 40', 'انتهاء العقد',
  ],
  status: 'beta',
  Icon: BriefcaseIcon,
  component: lazyTool(() => import('./SponsorshipTransferTool')),
  ar: {
    name: 'نقل الكفالة',
    tagline: 'الرسوم متدرّجة، وليست عليك.',
    description:
      'كم يكلّف نقل الكفالة — ٢٬٠٠٠ أو ٤٬٠٠٠ أو ٦٬٠٠٠ بحسب عدد مرات نقل العامل من قبل — ومن يتحمّلها بموجب المادة ٤٠، وهل تحتاج موافقة صاحب العمل الحالي أصلًا، ومهلة الستين يومًا بعد انتهاء العقد. يعمل بالكامل داخل متصفحك.',
  },
}
