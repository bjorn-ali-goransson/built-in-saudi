import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CompressIcon } from '../../components/icons'

export const pdfCompressTool: Tool = {
  id: 'pdf-compress',
  name: 'Compress PDF',
  nameAr: 'ضغط PDF',
  tagline: 'Shrink a PDF in your browser — keep your text, or go smallest.',
  description:
    'Make a PDF smaller in your browser. “Keep text” recompresses the embedded photos/JPEGs and leaves your text selectable; “Smallest” re-renders each page as an optimised image for maximum shrink (great for scans). See the size saved before you download. Runs with pdf.js + pdf-lib, so your document is never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'compress', 'shrink', 'reduce', 'smaller', 'optimize', 'compress pdf', 'ضغط', 'ضغط pdf', 'تصغير', 'تقليل حجم'],
  status: 'stable',
  Icon: CompressIcon,
  component: lazyTool(() => import('./PdfCompressTool')),
  ar: {
    name: 'ضغط PDF',
    tagline: 'صغّر ملف PDF داخل متصفحك — أبقِ نصّك أو اذهب للأصغر.',
    description:
      'صغّر حجم ملف PDF داخل متصفحك. «إبقاء النص» يعيد ضغط الصور/JPEG المضمّنة ويُبقي نصّك قابلًا للتحديد؛ و«الأصغر» يعيد رسم كل صفحة كصورة محسّنة لأقصى تصغير (مثالي للملفات الممسوحة). شاهد حجم التوفير قبل التنزيل. يعمل عبر pdf.js و pdf-lib، فلا يُرفع مستندك أبدًا.',
  },
}
