import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanTextIcon } from '../../components/icons'

export const docScanTool: Tool = {
  id: 'doc-scan',
  name: 'Photo to Scan',
  tagline: 'A photo of a page, straightened and cleaned up.',
  description:
    'Turn a photograph of a document into something that looks scanned: drag the four corners onto the page and it is straightened by a projective transform, the paper is made white and the ink black, and the file comes out a fraction of the size — which is also what makes it readable to OCR. You place the corners yourself, so automatic edge detection cannot fail silently. Nothing is uploaded.',
  category: 'Images',
  keywords: [
    'scan', 'scanner', 'document scanner', 'scan with phone', 'photo to scan', 'deskew',
    'straighten', 'perspective', 'crop page', 'camscanner', 'whiteboard', 'receipt', 'contract',
    'تصوير مستند', 'تصوير ورقة', 'تعديل الميل', 'تصحيح المنظور', 'ورقة',
  ],
  status: 'stable',
  Icon: ScanTextIcon,
  component: lazyTool(() => import('./DocScanTool')),
  ar: {
    name: 'تصحيح صورة المستند',
    tagline: 'صورة صفحة، معدّلة الميل ومنظّفة.',
    description:
      'حوّل صورة مستند إلى ما يشبه المسح الضوئي: اسحب الزوايا الأربع إلى أطراف الصفحة فتُعدَّل بتحويل إسقاطي، ويصير الورق أبيض والحبر أسود، ويخرج الملف بجزء يسير من الحجم — وهو نفسه ما يجعله مقروءًا للتعرّف الضوئي. وأنت من يضع الزوايا، فلا يفشل الكشف التلقائي صامتًا. ولا يُرفع شيء.',
  },
}
