import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SignatureIcon } from '../../components/icons'

export const pdfSignTool: Tool = {
  id: 'pdf-sign',
  name: 'Sign PDF',
  nameAr: 'توقيع PDF',
  tagline: 'Draw your signature and drop it onto any PDF.',
  description:
    'Sign a PDF by hand: draw your signature with a finger or mouse, then drag, pinch and place it exactly where it belongs — with a magnifier for pixel-perfect positioning. Everything runs in your browser with pdf-lib, so your document is never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'sign', 'signature', 'e-sign', 'sign pdf', 'توقيع', 'توقيع pdf', 'إمضاء', 'التوقيع الإلكتروني'],
  status: 'stable',
  Icon: SignatureIcon,
  component: lazyTool(() => import('./PdfSignTool')),
  ar: {
    name: 'توقيع PDF',
    tagline: 'ارسم توقيعك وضعه على أي ملف PDF.',
    description:
      'وقّع ملف PDF بخط يدك: ارسم توقيعك بإصبعك أو بالفأرة، ثم اسحبه واقرِصه وضعه بدقة في مكانه — مع عدسة مكبّرة لضبطٍ مثالي. يعمل كل شيء داخل متصفحك، فلا يُرفع مستندك أبدًا.',
  },
}
