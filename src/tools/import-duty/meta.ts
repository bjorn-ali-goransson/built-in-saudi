import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const importDutyTool: Tool = {
  id: 'import-duty',
  name: 'Import Duty & VAT',
  tagline: 'Duty-free is not tax-free — what the parcel really costs.',
  description:
    'What a parcel from abroad costs when it lands: customs duty on the CIF value, the 15% VAT that applies at any value even under the SAR 1,000 exemption, and why the two rates do not add up to 20%. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'customs', 'import duty', 'import tax', 'customs duty', 'shipping from abroad',
    'aliexpress', 'amazon', 'shein', 'parcel', 'de minimis', 'cif', 'zatca',
    'vat on imports', 'clearance', 'landed cost',
    'الجمارك', 'الرسوم الجمركية', 'ضريبة الاستيراد', 'التخليص الجمركي', 'شحن من الخارج',
    'الشراء من الخارج', 'طرد', 'القيمة الجمركية', 'إعفاء ألف ريال',
  ],
  status: 'beta',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./ImportDutyTool')),
  ar: {
    name: 'الرسوم الجمركية والضريبة',
    tagline: 'الإعفاء من الرسوم ليس إعفاءً من الضريبة.',
    description:
      'كم يكلّف الطرد القادم من الخارج حين يصل: الرسوم الجمركية على القيمة CIF، وضريبة القيمة المضافة ١٥٪ التي تُطبَّق على أي قيمة حتى دون إعفاء الألف ريال، ولماذا لا تُجمع النسبتان لتصير ٢٠٪. يعمل بالكامل داخل متصفحك.',
  },
}
