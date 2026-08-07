import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ReceiptIcon } from '../../components/icons'

export const zatcaQrTool: Tool = {
  id: 'zatca-qr',
  name: 'Invoice QR Reader',
  nameAr: 'قارئ رمز الفاتورة',
  tagline: 'Read the QR on a Saudi e-invoice.',
  description:
    'Photograph a receipt, or paste its QR text, and read what the invoice says: the seller, their VAT registration number, when it was issued, the total and the VAT. It also checks the arithmetic — a standard-rated sale whose VAT is not 15% of the pre-VAT amount is worth a second look. Everything happens on your device. It reads the invoice; it does not verify the signature, which needs ZATCA’s own certificates.',
  category: 'Saudi / Local',
  keywords: [
    'zatca', 'fatoora', 'invoice', 'qr', 'receipt', 'vat', 'tax', 'e-invoice', 'scan', 'decode', 'tlv',
    'زاتكا', 'فاتورة', 'فاتورة إلكترونية', 'رمز', 'باركود', 'ضريبة', 'القيمة المضافة', 'إيصال', 'مسح',
  ],
  status: 'stable',
  Icon: ReceiptIcon,
  component: lazyTool(() => import('./ZatcaQrTool')),
  ar: {
    name: 'قارئ رمز الفاتورة',
    tagline: 'اقرأ رمز الفاتورة الإلكترونية السعودية.',
    description:
      'صوّر إيصالًا أو الصق نص رمزه واقرأ ما تقوله الفاتورة: البائع ورقمه الضريبي ووقت الإصدار والإجمالي والضريبة. وتتحقق الأداة من الحساب أيضًا — فبيع خاضع للنسبة العادية لا تساوي ضريبته ١٥٪ من المبلغ قبل الضريبة يستحق نظرة ثانية. كل ذلك على جهازك. وهي تقرأ الفاتورة ولا تتحقق من توقيعها، فذلك يحتاج شهادات زاتكا نفسها.',
  },
}
