import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const quotationTool: Tool = {
  id: 'quotation',
  name: 'Quotation & Receipt',
  nameAr: 'عرض سعر وسند قبض',
  tagline: 'A quotation, proforma or receipt you can print.',
  description:
    'Write a quotation, a proforma invoice or a payment receipt, bilingual and ready to print or save as PDF. Line items, 15% VAT, your terms, and the fields each document actually needs — a validity date on a quote, a payment method and reference on a receipt. It also says plainly what these documents are not: neither is a tax invoice.',
  category: 'Business',
  keywords: ['quotation', 'quote', 'proforma', 'receipt', 'invoice', 'vat', 'business', 'عرض سعر', 'سند قبض', 'فاتورة مبدئية', 'ضريبة', 'أعمال'],
  status: 'beta',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./QuotationTool')),
  ar: {
    name: 'عرض سعر وسند قبض',
    tagline: 'عرض سعر أو فاتورة مبدئية أو سند قبض جاهز للطباعة.',
    description:
      'اكتب عرض سعر أو فاتورة مبدئية أو سند قبض، بلغتين وجاهزًا للطباعة أو الحفظ PDF. بنود وأسعار وضريبة قيمة مضافة ١٥٪ وشروطك، والحقول التي يحتاجها كل مستند فعلًا — تاريخ صلاحية لعرض السعر، وطريقة دفع ومرجع لسند القبض. وتوضّح الأداة صراحةً ما ليست عليه هذه المستندات: فأيٌّ منها ليس فاتورة ضريبية.',
  },
}
