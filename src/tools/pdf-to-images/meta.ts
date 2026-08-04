import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DocPhotoIcon } from '../../components/icons'

export const pdfToImagesTool: Tool = {
  id: 'pdf-to-images',
  name: 'PDF to Images',
  nameAr: 'PDF إلى صور',
  tagline: 'Turn each PDF page into a PNG, JPG or WebP.',
  description:
    'Convert a PDF into images — one file per page, at the resolution you choose (screen, print or high-DPI), as PNG, JPG or WebP. Pick the pages you want, download them individually or all at once as a ZIP. Rendered entirely in your browser, so contracts, IDs and statements are never uploaded.',
  category: 'PDF',
  keywords: ['pdf to jpg', 'pdf to png', 'pdf to image', 'convert pdf', 'extract pages', 'rasterize', 'webp', 'pdf إلى صور', 'تحويل pdf', 'استخراج صفحات'],
  status: 'stable',
  Icon: DocPhotoIcon,
  component: lazyTool(() => import('./PdfToImagesTool')),
  ar: {
    name: 'PDF إلى صور',
    tagline: 'حوّل كل صفحة PDF إلى صورة PNG أو JPG أو WebP.',
    description:
      'حوّل ملف PDF إلى صور — ملف لكل صفحة، بالدقة التي تختارها (شاشة أو طباعة أو دقة عالية)، بصيغة PNG أو JPG أو WebP. اختر الصفحات التي تريدها ونزّلها منفردة أو دفعة واحدة في ملف ZIP. يُعالَج داخل متصفحك بالكامل، فلا تُرفع العقود والهويات وكشوف الحساب أبدًا.',
  },
}
