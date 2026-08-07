import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CoinsIcon } from '../../components/icons'

export const gosiSalaryTool: Tool = {
  id: 'gosi-salary',
  name: 'GOSI & Net Salary',
  nameAr: 'التأمينات وصافي الراتب',
  tagline: 'What is deducted, and what you take home.',
  description:
    'Work out your real GOSI deduction and your take-home pay. Contributions are charged on basic salary plus housing allowance only — not transport, phone, commission or bonus — and stop at SAR 45,000 a month, which is why "just take 10% of your salary" is wrong for anyone with allowances. It also knows there are two systems: anyone registered with GOSI before 3 July 2024 stays on the old rates, while the newer scheme rises half a point every July. A non-Saudi employee has nothing deducted at all.',
  category: 'Saudi / Local',
  keywords: [
    'gosi', 'net salary', 'take home pay', 'salary calculator', 'deduction', 'payroll', 'saned', 'social insurance', 'contribution', 'basic salary', 'housing allowance', 'employer cost',
    'التأمينات', 'التأمينات الاجتماعية', 'صافي الراتب', 'راتب', 'خصم', 'ساند', 'اشتراك', 'مسير رواتب', 'بدل سكن', 'حاسبة الراتب',
  ],
  status: 'stable',
  Icon: CoinsIcon,
  component: lazyTool(() => import('./GosiSalaryTool')),
  ar: {
    name: 'التأمينات وصافي الراتب',
    tagline: 'كم يُخصم منك، وكم تقبض فعلًا.',
    description:
      'احسب خصم التأمينات الحقيقي وصافي راتبك. فالاشتراكات تُحتسب على الراتب الأساسي وبدل السكن فقط — لا على النقل ولا الجوال ولا العمولة ولا المكافأة — وتتوقف عند 45,000 ريال شهريًا، ولهذا فإن «خذ 10% من راتبك» خطأ لكل من له بدلات. وتعرف الأداة أن هناك نظامين: من سُجّل في التأمينات قبل 3 يوليو 2024 يبقى على النسب القديمة، أما النظام الأحدث فيرتفع نصف نقطة كل يوليو. والموظف غير السعودي لا يُخصم منه شيء إطلاقًا.',
  },
}
