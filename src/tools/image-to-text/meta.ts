import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanTextIcon } from '../../components/icons'

export const imageToTextTool: Tool = {
  id: 'image-to-text',
  name: 'Image to Text (OCR)',
  nameAr: 'استخراج النص من صورة',
  tagline: 'Read the text out of a photo or scan.',
  description:
    'Pull the text out of a photo, screenshot or scanned page — in English, Arabic, or both at once — then copy it or save it as a .txt file. The whole OCR engine runs inside your browser, so passports, contracts and bank statements are never uploaded anywhere.',
  category: 'Images',
  keywords: ['ocr', 'image to text', 'extract text', 'scan', 'screenshot to text', 'read text', 'tesseract', 'arabic ocr', 'استخراج النص', 'تحويل صورة إلى نص', 'قراءة النص', 'مسح ضوئي'],
  status: 'stable',
  Icon: ScanTextIcon,
  component: lazyTool(() => import('./ImageToTextTool')),
  ar: {
    name: 'استخراج النص من صورة',
    tagline: 'اقرأ النص من صورة أو مستند ممسوح.',
    description:
      'استخرج النص من صورة أو لقطة شاشة أو صفحة ممسوحة ضوئيًا — بالإنجليزية أو العربية أو كليهما معًا — ثم انسخه أو احفظه كملف .txt. يعمل محرك التعرف الضوئي بالكامل داخل متصفحك، فلا تُرفع الجوازات والعقود وكشوف الحساب إلى أي مكان.',
  },
}
