import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BoltIcon } from '../../components/icons'

export const electricityBillTool: Tool = {
  id: 'electricity-bill',
  name: 'Electricity Bill Estimate',
  nameAr: 'تقدير فاتورة الكهرباء',
  tagline: 'And why 6,000 kWh is not a cliff.',
  description:
    'Work out roughly what a month of electricity costs, with the breakdown that shows where it came from — units at each rate, the meter service charge and VAT. It also corrects the thing almost everyone gets wrong: the tariff is marginal, not a cliff. The first 6,000 kWh are charged at 18 halalas however much you use in total, and only the units above that cost 30, so crossing the threshold adds a few riyals rather than repricing the whole bill. The tool shows what the next kilowatt costs at your level of use, and how far you are from the higher rate.',
  category: 'Saudi / Local',
  keywords: [
    'electricity', 'bill', 'sec', 'kwh', 'tariff', 'power', 'energy', 'consumption', 'meter', 'utility', '6000', 'halalas', 'estimate',
    'الكهرباء', 'فاتورة', 'فاتورة الكهرباء', 'تعرفة', 'استهلاك', 'كيلوواط', 'عداد', 'شريحة', 'تقدير',
  ],
  status: 'stable',
  Icon: BoltIcon,
  component: lazyTool(() => import('./ElectricityBillTool')),
  ar: {
    name: 'تقدير فاتورة الكهرباء',
    tagline: 'ولماذا 6000 ك.و.س ليست قفزة.',
    description:
      'احسب تقريبًا كم يكلّف شهر من الكهرباء، مع تفصيل يبيّن من أين جاء المبلغ — الوحدات بكل سعر، ورسم خدمة العداد، وضريبة القيمة المضافة. وتصحّح الأداة ما يخطئ فيه أكثر الناس: فالتعرفة تصاعدية لا قفزة. إذ تُحتسب أول 6000 كيلوواط بـ18 هللة مهما بلغ استهلاكك، ولا تُحتسب بـ30 إلا الوحدات التي فوقها، فتجاوز الحد يزيد بضعة ريالات لا أن يُعيد تسعير الفاتورة كلها. وتبيّن لك الأداة كم يكلّف الكيلوواط التالي عند مستوى استهلاكك، وكم بقي حتى الشريحة الأعلى.',
  },
}
