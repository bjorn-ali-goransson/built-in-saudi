import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CardIcon } from '../../components/icons'

export const iqamaFeesTool: Tool = {
  id: 'iqama-fees',
  name: 'Iqama Renewal Cost',
  nameAr: 'تكلفة تجديد الإقامة',
  tagline: 'What a family renewal actually costs.',
  description:
    'Work out what renewing an iqama costs, and see the fee people forget. The iqama itself is 650 SAR a year; the dependent fee is 400 SAR per person per MONTH, collected up front for the whole period — so a spouse and two children for a year is 14,400 SAR due in one payment, and the iqama fee is the small part of the bill. The tool shows how much of your total is dependents, and that renewing quarterly splits the same yearly cost into four payments rather than reducing it. It also says plainly that the monthly work permit levy is your employer’s: its rate follows their Saudization band, and Article 40 of the Labour Law forbids charging it to the worker.',
  category: 'Saudi / Local',
  keywords: [
    'iqama fees', 'iqama renewal', 'iqama cost', 'dependent fee', 'muraafiq', 'maktab amal', 'work permit levy',
    'renewal', 'expat', 'family', 'sponsor', 'absher', 'muqeem', 'jawazat', 'article 40', 'late penalty',
    'رسوم الإقامة', 'تجديد الإقامة', 'رسوم المرافقين', 'مرافق', 'مكتب العمل', 'رخصة العمل',
    'تجديد', 'مقيم', 'أبشر', 'جوازات', 'كفيل', 'غرامة التأخير',
  ],
  status: 'beta',
  Icon: CardIcon,
  component: lazyTool(() => import('./IqamaFeesTool')),
  ar: {
    name: 'تكلفة تجديد الإقامة',
    tagline: 'كم يكلّف تجديد إقامة أسرة فعلًا.',
    description:
      'احسب تكلفة تجديد الإقامة، واطّلع على الرسم الذي ينساه الناس. فالإقامة نفسها 650 ريالًا سنويًا، أما رسم المرافقين فأربعمئة ريال عن كل فرد شهريًا تُدفع كاملة مقدمًا عن المدة كلها — فزوجة وطفلان لسنة تعني 14,400 ريال دفعةً واحدة، ورسم الإقامة هو الجزء الصغير من الفاتورة. وتبيّن الأداة كم نسبة المرافقين من إجماليك، وأن التجديد كل ثلاثة أشهر يقسّم التكلفة السنوية نفسها إلى أربع دفعات لا أن يخفّضها. وتقول صراحةً إن رسم رخصة العمل الشهري على صاحب العمل: نسبته تتبع نطاق السعودة عنده، والمادة الأربعون من نظام العمل تمنع تحميله للعامل.',
  },
}
