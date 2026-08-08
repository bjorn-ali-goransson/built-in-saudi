import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PercentIcon } from '../../components/icons'

export const vatRegistrationTool: Tool = {
  id: 'vat-registration',
  name: 'Do I Need to Register for VAT?',
  nameAr: 'هل يلزمني التسجيل في ضريبة القيمة المضافة؟',
  tagline: 'The rolling test ZATCA actually applies.',
  description:
    'Find out whether VAT registration is mandatory, optional, or not required — on the test ZATCA actually applies rather than the one people assume. It is any twelve consecutive months, not your calendar year, so the clock may have started months before you noticed; and expecting to cross in the year ahead makes registration due now. Exempt supplies do not count towards the threshold while zero-rated ones do, which is the mistake that produces a registration nobody needed. When you have crossed, it shows the month it happened and the date you have to register by.',
  category: 'Saudi / Local',
  keywords: [
    'vat', 'vat registration', 'zatca', 'threshold', 'register', '375000', '187500', 'taxable turnover', 'freelance', 'small business', 'tax', 'rolling 12 months',
    'ضريبة القيمة المضافة', 'التسجيل', 'الزكاة والضريبة', 'حد التسجيل', 'إيرادات', 'عمل حر', 'منشأة صغيرة', 'ضريبة',
  ],
  status: 'beta',
  Icon: PercentIcon,
  component: lazyTool(() => import('./VatRegistrationTool')),
  ar: {
    name: 'هل يلزمني التسجيل في ضريبة القيمة المضافة؟',
    tagline: 'الاختبار المتجدد الذي تطبّقه الهيئة فعلًا.',
    description:
      'اعرف إن كان التسجيل في ضريبة القيمة المضافة إلزاميًا أم اختياريًا أم غير لازم — وفق الاختبار الذي تطبّقه هيئة الزكاة والضريبة والجمارك فعلًا لا الذي يفترضه الناس. فالعبرة بأي اثني عشر شهرًا متتالية لا بالسنة الميلادية، وقد تكون المهلة بدأت قبل أن تنتبه بأشهر؛ وتوقّعك تجاوز الحد في السنة القادمة يجعل التسجيل واجبًا الآن. والتوريدات المعفاة لا تُحتسب ضمن الحد بينما تُحتسب الخاضعة بنسبة صفر، وهذا هو الخطأ الذي يُنشئ تسجيلًا لم يكن لازمًا. وإن كنت قد تجاوزت، تبيّن لك الأداة الشهر الذي وقع فيه ذلك والتاريخ الذي يلزمك التسجيل قبله.',
  },
}
