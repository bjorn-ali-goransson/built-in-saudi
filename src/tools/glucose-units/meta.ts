import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ExchangeIcon } from '../../components/icons'

export const glucoseUnitsTool: Tool = {
  id: 'glucose-units',
  name: 'Blood Sugar Converter',
  nameAr: 'محوّل قراءات السكر',
  tagline: 'mg/dL ↔ mmol/L, and HbA1c both ways.',
  description:
    'Convert a blood glucose reading between mg/dL and mmol/L, and HbA1c between % and mmol/mol, with the estimated average glucose that goes with it. Saudi labs and meters report mg/dL while most research and European results use mmol/L, and the factor between them is 18 — worth getting right. It also says where a reading falls, and flags one low or high enough to need acting on now.',
  category: 'Calculators',
  keywords: ['blood sugar', 'glucose', 'mg/dl', 'mmol/l', 'hba1c', 'a1c', 'diabetes', 'convert', 'سكر الدم', 'تحويل', 'السكر التراكمي', 'سكري', 'قراءة'],
  status: 'stable',
  Icon: ExchangeIcon,
  component: lazyTool(() => import('./GlucoseUnitsTool')),
  ar: {
    name: 'محوّل قراءات سكر الدم',
    tagline: 'تحويل mg/dL و mmol/L والسكر التراكمي.',
    description:
      'حوّل قراءة سكر الدم بين mg/dL وmmol/L، والسكر التراكمي بين ٪ وmmol/mol، مع متوسط السكر التقديري المصاحب. تستخدم المختبرات والأجهزة في السعودية mg/dL بينما تستخدم معظم الأبحاث والنتائج الأوروبية mmol/L، والمعامل بينهما ١٨ — ويستحق الضبط. وتبيّن الأداة أين تقع القراءة، وتنبّه إلى ما هو منخفض أو مرتفع بما يستدعي تصرّفًا فوريًا.',
  },
}
