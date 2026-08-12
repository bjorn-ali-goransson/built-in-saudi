import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { UsersIcon } from '../../components/icons'

export const domesticWorkerTool: Tool = {
  id: 'domestic-worker',
  name: 'Domestic Worker Entitlements',
  tagline: 'The Labour Law does not cover them — and the difference is threefold.',
  description:
    'What a domestic worker in Saudi Arabia is entitled to under the regulation that actually covers them: one month’s wage per four years, 30 days leave after two, sick pay, weekly and daily rest, and the wage protection that became mandatory for every household in January 2026. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'domestic worker', 'housemaid', 'maid', 'driver', 'nanny', 'house help',
    'musaned', 'domestic labour', 'household worker', 'end of service maid',
    'maid salary', 'maid rights', 'sponsor duties', 'wage protection', 'wps',
    'عاملة منزلية', 'العمالة المنزلية', 'خادمة', 'شغالة', 'سائق خاص', 'مربية',
    'مساند', 'حقوق العمالة المنزلية', 'نهاية خدمة عاملة منزلية', 'راتب العاملة',
    'إجازة العاملة المنزلية', 'حماية الأجور', 'صاحب العمل المنزلي',
  ],
  status: 'beta',
  Icon: UsersIcon,
  component: lazyTool(() => import('./DomesticWorkerTool')),
  ar: {
    name: 'حقوق العمالة المنزلية',
    tagline: 'نظام العمل لا يشملهم — والفرق ثلاثة أضعاف.',
    description:
      'ما تستحقه العمالة المنزلية في السعودية بموجب اللائحة التي تشملها فعلًا: أجر شهر عن كل أربع سنوات، وثلاثون يوم إجازة بعد سنتين، والإجازة المرضية، والراحة الأسبوعية واليومية، وحماية الأجور التي صارت إلزامية على كل أسرة في يناير ٢٠٢٦. يعمل بالكامل داخل متصفحك.',
  },
}
