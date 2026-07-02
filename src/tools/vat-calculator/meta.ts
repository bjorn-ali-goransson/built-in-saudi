import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PercentIcon } from '../../components/icons'

export const vatCalculatorTool: Tool = {
  id: 'vat-calculator',
  name: 'VAT Calculator',
  nameAr: 'حاسبة الضريبة',
  tagline: 'Saudi 15% VAT — add or remove, net/VAT/gross.',
  description:
    'Add or remove Saudi VAT (15% by default, with 5% and 0% presets or any rate) — see the net, VAT amount and gross in SAR, rounded to the halala, with a copyable breakdown. Bilingual, entirely in your browser.',
  category: 'Calculators',
  keywords: ['vat', 'tax', 'saudi', 'ksa', '15%', 'ضريبة', 'القيمة المضافة', 'حاسبة', 'ضريبة القيمة المضافة'],
  status: 'stable',
  Icon: PercentIcon,
  component: lazyTool(() => import('./VatCalculatorTool')),
  ar: {
    name: 'حاسبة ضريبة القيمة المضافة',
    tagline: 'ضريبة ١٥٪ السعودية — إضافة أو استخراج.',
    description:
      'أضِف أو استخرج ضريبة القيمة المضافة السعودية (١٥٪ افتراضيًا، مع ٥٪ و٠٪ أو أي نسبة) — واعرف الصافي والضريبة والإجمالي بالريال مقرَّبًا للهللة، مع تفاصيل قابلة للنسخ. ثنائي اللغة وداخل متصفحك بالكامل.',
  },
}
