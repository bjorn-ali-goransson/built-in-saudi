import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GripIcon } from '../../components/icons'

export const pdfOrganiseTool: Tool = {
  id: 'pdf-organise',
  name: 'Organise PDF Pages',
  nameAr: 'ترتيب صفحات PDF',
  tagline: 'Rotate, reorder and remove pages.',
  description:
    'Turn sideways pages the right way up, drag them into the right order, and drop the ones you do not want — all on one screen, then save. Pages are copied rather than re-drawn, so text stays text and a scan stays exactly the scan it was. The file never leaves your device.',
  category: 'PDF',
  keywords: ['بي دي اف', 
    // No 'scan' / 'مسح ضوئي' here. This tool PRESERVES a scan; it does not make
    // one and cannot read one. Listing the word stole "مسح ضوئي" from pdf-ocr,
    // which is the tool that actually answers it.
    'pdf', 'rotate', 'reorder', 'organise', 'organize', 'delete pages', 'remove pages', 'sort', 'arrange', 'sideways', 'upside down',
    'pdf', 'تدوير', 'ترتيب', 'حذف صفحات', 'تنظيم', 'صفحات', 'مقلوبة',
  ],
  status: 'stable',
  Icon: GripIcon,
  component: lazyTool(() => import('./PdfOrganiseTool')),
  ar: {
    name: 'ترتيب صفحات PDF',
    tagline: 'أدر الصفحات ورتّبها واحذف ما لا تريد.',
    description:
      'اضبط اتجاه الصفحات المائلة، واسحبها إلى ترتيبها الصحيح، واحذف ما لا تريده — كل ذلك في شاشة واحدة، ثم احفظ. وتُنسخ الصفحات ولا يُعاد رسمها، فيبقى النص نصًا وتبقى الصورة الممسوحة كما هي تمامًا. ولا يغادر الملف جهازك.',
  },
}
