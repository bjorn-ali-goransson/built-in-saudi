import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PhotoDocIcon } from '../../components/icons'

export const imagesToPdfTool: Tool = {
  id: 'images-to-pdf',
  name: 'Images to PDF',
  nameAr: 'الصور إلى PDF',
  tagline: 'Combine JPG/PNG images into one PDF.',
  description:
    'Combine several JPG/PNG images into a single PDF, one image per page — reorder the pages, fit to the image or use A4/Letter with a margin. Built entirely in your browser with pdf-lib, so sensitive documents (IDs, contracts) are never uploaded.',
  category: 'PDF',
  keywords: ['jpg to pdf', 'png to pdf', 'images to pdf', 'combine', 'merge images', 'pdf', 'صور إلى pdf', 'تحويل صور', 'دمج'],
  status: 'stable',
  Icon: PhotoDocIcon,
  component: lazyTool(() => import('./ImagesToPdfTool')),
  ar: {
    name: 'الصور إلى PDF',
    tagline: 'ادمج صور JPG/PNG في ملف PDF واحد.',
    description:
      'ادمج عدة صور JPG/PNG في ملف PDF واحد، صورة لكل صفحة — مع إعادة الترتيب، وملاءمة الصورة أو استخدام A4/Letter بهامش. يُبنى داخل متصفحك بالكامل، فلا تُرفع المستندات الحساسة (الهويات والعقود) أبدًا.',
  },
}
