import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MergeIcon } from '../../components/icons'

export const pdfMergeTool: Tool = {
  id: 'pdf-merge',
  name: 'Merge PDF',
  nameAr: 'دمج PDF',
  tagline: 'Combine PDFs and pictures, and put the pages in order.',
  description:
    'Put several PDFs together, add photos or scans as pages, turn sideways pages the right way up, drag pages into order and drop the ones you do not want — on one screen, then save one PDF. PDF pages are copied rather than re-drawn, so text stays text and a scan stays exactly the scan it was. Pictures go on a page their own size, or on A4 or Letter with a margin. Runs entirely in your browser, so your documents are never uploaded.',
  category: 'PDF',
  keywords: [
    'بي دي اف', 'pdf', 'merge', 'combine', 'join pdf', 'merge pdf', 'دمج pdf', 'دمج بي دي اف', 'جمع',
    // Merged in from Images to PDF and Organise PDF Pages (November 2026).
    // No 'scan' / 'مسح ضوئي': this tool PRESERVES a scan and cannot read one,
    // and the word belongs to pdf-ocr, which does.
    'jpg to pdf', 'png to pdf', 'images to pdf', 'photos to pdf', 'picture to pdf', 'merge images',
    'صور إلى pdf', 'تحويل صور', 'صورة إلى pdf',
    'rotate pdf', 'reorder pages', 'organise pdf', 'organize pdf', 'delete pages', 'remove pages', 'arrange pages', 'sideways', 'upside down',
    'تدوير', 'ترتيب صفحات', 'حذف صفحات', 'تنظيم', 'صفحات', 'مقلوبة',
  ],
  inverse: 'pdf-to-images',
  aliases: ['Images to PDF', 'الصور إلى PDF'],
  status: 'stable',
  Icon: MergeIcon,
  component: lazyTool(() => import('./PdfMergeTool')),
  ar: {
    name: 'دمج PDF',
    tagline: 'اجمع مستندات PDF والصور، ورتّب الصفحات.',
    description:
      'اجمع عدة ملفات PDF، وأضف الصور أو المستندات الممسوحة صفحاتٍ، واضبط اتجاه الصفحات المائلة، واسحبها إلى ترتيبها، واحذف ما لا تريد — في شاشة واحدة، ثم احفظ ملف PDF واحدًا. وتُنسخ صفحات PDF ولا يُعاد رسمها، فيبقى النص نصًا وتبقى الصورة الممسوحة كما هي. وتوضع الصور على صفحة بحجمها، أو على A4 أو Letter بهامش. يعمل داخل متصفحك بالكامل، فلا تُرفع مستنداتك أبدًا.',
  },
}
