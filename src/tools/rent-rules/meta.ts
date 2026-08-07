import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CardIcon } from '../../components/icons'

export const rentRulesTool: Tool = {
  id: 'rent-rules',
  name: 'Rent Increase & Renewal Rules',
  nameAr: 'قواعد زيادة الإيجار والتجديد',
  tagline: 'Can the rent go up, and when to give notice.',
  description:
    'Whether your rent can legally be increased, and the date you have to give notice by. Increases inside Riyadh’s urban boundary are frozen for five years from 25 September 2025 — but an escalation clause in a contract that was already in place on that date still stands, so two tenants in the same building can get different answers depending on which side of one day their signature falls. Separately, and everywhere in the Kingdom, a lease renews itself automatically unless one party gives the other 60 days’ notice — the deadline people actually miss.',
  category: 'Saudi / Local',
  keywords: [
    'rent', 'rent increase', 'rent freeze', 'riyadh', 'ejar', 'lease', 'renewal', 'notice', 'tenant', 'landlord', 'contract', 'rega', '60 days', 'escalation',
    'إيجار', 'زيادة الإيجار', 'تجميد الإيجار', 'الرياض', 'عقد إيجار', 'تجديد', 'إشعار', 'مستأجر', 'مؤجر', 'الهيئة العامة للعقار',
  ],
  status: 'stable',
  Icon: CardIcon,
  component: lazyTool(() => import('./RentRulesTool')),
  ar: {
    name: 'قواعد زيادة الإيجار والتجديد',
    tagline: 'هل يجوز رفع الإيجار، ومتى تُشعر.',
    description:
      'هل يجوز نظامًا رفع إيجارك، وما التاريخ الذي يلزمك الإشعار قبله. فالزيادات داخل النطاق العمراني للرياض مجمّدة خمس سنوات من 25 سبتمبر 2025 — لكن شرط الزيادة في عقد كان قائمًا قبل ذلك التاريخ يظل نافذًا، فقد يختلف الجواب بين مستأجرَين في عمارة واحدة تبعًا لأي جانب من يوم واحد وقع توقيعهما. وبمعزل عن ذلك، وفي المملكة كلها، يتجدد العقد تلقائيًا ما لم يُشعر أحد الطرفين الآخر بستين يومًا — وهي المهلة التي يفوّتها الناس فعلًا.',
  },
}
