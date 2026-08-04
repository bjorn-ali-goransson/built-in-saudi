import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanQrIcon } from '../../components/icons'

export const qrReaderTool: Tool = {
  id: 'qr-reader',
  name: 'QR Code Reader',
  nameAr: 'قارئ الباركود',
  tagline: 'Read a QR code from a picture or your camera.',
  description:
    'Point your camera at a QR code, or drop in a screenshot or photo of one, and read what it actually says — before you visit it. Shows the raw contents, warns about look-alike links, and decodes Wi-Fi, contact and payment codes into something readable. Runs entirely in your browser; the picture and the camera feed never leave your device.',
  category: 'Utilities',
  keywords: ['qr reader', 'qr scanner', 'scan qr', 'read qr', 'decode qr', 'barcode reader', 'qr from image', 'قارئ باركود', 'مسح باركود', 'قراءة باركود', 'فك باركود'],
  status: 'stable',
  Icon: ScanQrIcon,
  component: lazyTool(() => import('./QrReaderTool')),
  ar: {
    name: 'قارئ الباركود',
    tagline: 'اقرأ الباركود من صورة أو من الكاميرا.',
    description:
      'وجّه الكاميرا إلى الباركود، أو أفلت لقطة شاشة أو صورة له، واقرأ محتواه الحقيقي قبل فتحه. يعرض المحتوى الخام، وينبّه إلى الروابط المضللة، ويفكّ رموز الواي فاي وجهات الاتصال والدفع إلى صيغة مقروءة. يعمل داخل متصفحك بالكامل؛ فلا تغادر الصورة ولا بث الكاميرا جهازك.',
  },
}
