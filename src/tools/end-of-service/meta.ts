import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BriefcaseIcon } from '../../components/icons'

export const endOfServiceTool: Tool = {
  id: 'end-of-service',
  name: 'End-of-Service Calculator',
  tagline: 'Estimate your Saudi end-of-service award (مكافأة).',
  description:
    'Estimate the end-of-service gratuity (mukāfaʾat nihāyat al-khidma) under the Saudi Labour Law: half a month per year for the first five years and a full month per year thereafter, adjusted for whether you resigned or the contract ended. Based on Articles 84–85 — informational only, not legal advice. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: ['end of service', 'gratuity', 'mukafaa', 'saudi labor law', 'severance', 'مكافأة نهاية الخدمة', 'نظام العمل', 'استقالة'],
  status: 'stable',
  Icon: BriefcaseIcon,
  component: lazyTool(() => import('./EndOfServiceTool')),
  ar: {
    name: 'حاسبة نهاية الخدمة',
    tagline: 'قدّر مكافأة نهاية الخدمة وفق نظام العمل السعودي.',
    description:
      'قدّر مكافأة نهاية الخدمة وفق نظام العمل السعودي: نصف شهر عن كل سنة من السنوات الخمس الأولى وشهر كامل عن كل سنة بعدها، مع تعديلها حسب الاستقالة أو انتهاء العقد. مبنيّة على المادتين 84 و85 — لأغراض إرشادية فقط وليست استشارة قانونية. تعمل بالكامل في متصفحك.',
  },
}
