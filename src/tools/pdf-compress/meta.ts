import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CompressIcon } from '../../components/icons'

export const pdfCompressTool: Tool = {
  id: 'pdf-compress',
  name: 'Compress PDF',
  nameAr: 'ضغط PDF',
  tagline: 'Shrink a PDF right in your browser — nothing uploaded.',
  description:
    'Make a PDF smaller in your browser: pick a compression level and it re-renders each page as an optimised JPEG and rebuilds the file — great for scanned or photo-heavy PDFs. See the size saved before you download. Runs with pdf.js + pdf-lib, so your document is never uploaded. Text becomes part of the image (not selectable).',
  category: 'PDF',
  keywords: ['pdf', 'compress', 'shrink', 'reduce', 'smaller', 'optimize', 'compress pdf', 'ضغط', 'ضغط pdf', 'تصغير', 'تقليل حجم'],
  status: 'stable',
  Icon: CompressIcon,
  component: lazyTool(() => import('./PdfCompressTool')),
  ar: {
    name: 'ضغط PDF',
    tagline: 'صغّر ملف PDF داخل متصفحك — دون رفعه.',
    description:
      'صغّر حجم ملف PDF داخل متصفحك: اختر مستوى الضغط فيُعيد رسم كل صفحة كصورة JPEG محسّنة ويعيد بناء الملف — مثالي للملفات الممسوحة أو المليئة بالصور. شاهد حجم التوفير قبل التنزيل. يعمل عبر pdf.js و pdf-lib، فلا يُرفع مستندك أبدًا. يصبح النص جزءًا من الصورة (غير قابل للتحديد).',
  },
}
