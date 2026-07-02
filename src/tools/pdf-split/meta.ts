import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FileIcon } from '../../components/icons'

export const pdfSplitTool: Tool = {
  id: 'pdf-split',
  name: 'Split PDF',
  nameAr: 'تقسيم PDF',
  tagline: 'Extract a page range or split into pages.',
  description:
    'Split a PDF in your browser — extract a page range like “1-3, 5, 8-10” into a new file, or burst the whole document into single-page PDFs (download all as a ZIP or one by one). Runs entirely on your device with pdf-lib, so the file is never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'split', 'extract pages', 'page range', 'burst', 'separate pdf', 'تقسيم pdf', 'استخراج صفحات', 'فصل'],
  status: 'stable',
  Icon: FileIcon,
  component: lazyTool(() => import('./PdfSplitTool')),
  ar: {
    name: 'تقسيم PDF',
    tagline: 'استخرج نطاق صفحات أو قسّم إلى صفحات.',
    description:
      'قسّم ملف PDF داخل متصفحك — استخرج نطاق صفحات مثل «1-3، 5، 8-10» في ملف جديد، أو فكّك المستند إلى صفحات مفردة (نزّلها كلها كملف ZIP أو واحدة تلو الأخرى). يعمل على جهازك بالكامل، فلا يُرفع الملف أبدًا.',
  },
}
