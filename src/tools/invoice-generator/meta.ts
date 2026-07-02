import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const invoiceGeneratorTool: Tool = {
  id: 'invoice-generator',
  name: 'Invoice Generator',
  nameAr: 'منشئ الفواتير',
  tagline: 'Bilingual SAR invoices with 15% VAT.',
  description:
    'Create a clean, bilingual (AR/EN) invoice with line items, automatic 15% Saudi VAT and totals in SAR — with the grand total spelled out in Arabic words. Print or save as PDF straight from your browser; your seller details are saved locally and nothing is uploaded.',
  category: 'Business',
  keywords: ['invoice', 'vat', 'saudi', 'sar', 'billing', 'receipt', 'فاتورة', 'ضريبة', 'فواتير', 'محاسبة'],
  status: 'stable',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./InvoiceGeneratorTool')),
  ar: {
    name: 'منشئ الفواتير',
    tagline: 'فواتير بالريال ثنائية اللغة مع ضريبة ١٥٪.',
    description:
      'أنشئ فاتورة أنيقة ثنائية اللغة (عربي/إنجليزي) ببنودٍ وضريبة قيمة مضافة سعودية ١٥٪ تلقائيًا وإجماليات بالريال — مع كتابة الإجمالي بالأحرف العربية. اطبعها أو احفظها PDF من متصفحك مباشرة؛ تُحفظ بيانات البائع محليًا ولا يُرفع شيء.',
  },
}
