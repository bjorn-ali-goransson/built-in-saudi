import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BriefcaseIcon } from '../../components/icons'

export const leaveOvertimeTool: Tool = {
  id: 'leave-overtime',
  name: 'Leave, Overtime & Notice',
  nameAr: 'الإجازة والعمل الإضافي والإشعار',
  tagline: 'What the Labour Law gives you.',
  description:
    'Your annual leave, what overtime is worth, and how much notice either side has to give — the entitlements that apply while you are still working, where the gratuity calculator covers leaving. Three of them are routinely got wrong: leave steps from 21 days to 30 after five continuous years with the same employer, and the tool tells you the date; notice is 30 days if you resign but 60 if your employer ends it, which people assume is one number; and overtime is capped at 720 hours a year, a cap that exists to protect you rather than to limit what you can be paid for.',
  category: 'Saudi / Local',
  keywords: [
    'annual leave', 'leave days', 'overtime', 'notice period', 'probation', 'labour law', 'labor law', 'resign', 'termination', 'working hours', 'entitlement', '21 days', '30 days', 'employee rights',
    'الإجازة السنوية', 'إجازة', 'العمل الإضافي', 'ساعات إضافية', 'مدة الإشعار', 'فترة التجربة', 'نظام العمل', 'استقالة', 'حقوق الموظف', 'أجر الساعة',
  ],
  status: 'beta',
  Icon: BriefcaseIcon,
  component: lazyTool(() => import('./LeaveOvertimeTool')),
  ar: {
    name: 'الإجازة والعمل الإضافي والإشعار',
    tagline: 'ما يمنحك نظام العمل.',
    description:
      'إجازتك السنوية، وكم يساوي العمل الإضافي، وكم مدة الإشعار على كل طرف — وهي الحقوق التي تسري وأنت على رأس العمل، أما ترك العمل فتغطيه حاسبة نهاية الخدمة. وثلاثة منها يخطئ فيها الناس كثيرًا: الإجازة ترتفع من 21 يومًا إلى 30 بعد خمس سنوات متصلة عند صاحب العمل نفسه، والأداة تخبرك بالتاريخ؛ ومدة الإشعار 30 يومًا إن استقلت و60 إن أنهاه صاحب العمل، ويظنها الناس رقمًا واحدًا؛ والعمل الإضافي محدود بـ720 ساعة سنويًا، وهو حدٌّ لحمايتك لا لتقييد ما تُدفع مقابله.',
  },
}
