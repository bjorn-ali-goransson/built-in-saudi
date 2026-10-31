import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { QrIcon } from '../../components/icons'

export const qrCodeTool: Tool = {
  id: 'qr-code',
  name: 'QR Code Generator',
  nameAr: 'مولّد رمز الاستجابة السريعة',
  tagline: 'Make crisp QR codes for links, Wi-Fi, email & more.',
  description:
    'Generate high-resolution QR codes for URLs, plain text, Wi-Fi networks, email and phone numbers. Tune colours, size and error-correction, then export as PNG or scalable SVG — with no watermark. The same page makes product barcodes too (EAN-13, EAN-8, UPC-A and Code 128). Everything runs in your browser; nothing is uploaded.',
  category: 'Generators',
  keywords: [
    'qr', 'qr code', 'generator', 'wifi qr', 'url', 'barcode',
    'vcard', 'svg', 'png', 'free', 'no watermark',
    // Merged in from the Barcode Generator (November 2026).
    'barcode generator', 'ean13', 'ean', 'upc', 'code128', 'product barcode', 'رمز شريطي', 'ملصق', 'منتج',
  ],
  aliases: ['Barcode Generator'],
  inverse: 'qr-reader',
  status: 'stable',
  Icon: QrIcon,
  component: lazyTool(() => import('./QrCodeTool')),
  ar: {
    name: 'مولّد الباركود',
    tagline: 'أنشئ باركود واضحًا للروابط والواي فاي والبريد والمزيد.',
    description:
      'أنشئ رموز باركود عالية الدقة للروابط والنصوص وشبكات الواي فاي والبريد الإلكتروني وأرقام الهواتف. تحكّم في الألوان والحجم وتصحيح الأخطاء، ثم صدّر بصيغة PNG أو SVG قابلة للتحجيم — بدون علامة مائية. وتصنع الصفحة نفسها باركود المنتجات أيضًا (EAN-13 وEAN-8 وUPC-A وCode 128). كل شيء يعمل داخل متصفحك؛ لا يُرفع أي شيء.',
  },
}
