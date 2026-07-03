import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MergeIcon } from '../../components/icons'

export const pdfMergeTool: Tool = {
  id: 'pdf-merge',
  name: 'Merge PDF',
  nameAr: 'دمج PDF',
  tagline: 'Combine several PDFs into one, in order.',
  description:
    'Merge multiple PDF files into a single document in the order you choose — reorder or remove files and see the page count before you merge. Runs entirely in your browser with pdf-lib, so your documents are never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'merge', 'combine', 'join pdf', 'merge pdf', 'دمج pdf', 'دمج ملفات', 'جمع'],
  status: 'stable',
  Icon: MergeIcon,
  component: lazyTool(() => import('./PdfMergeTool')),
  ar: {
    name: 'دمج PDF',
    tagline: 'ادمج عدة ملفات PDF في ملف واحد بالترتيب.',
    description:
      'ادمج عدة ملفات PDF في مستند واحد بالترتيب الذي تختاره — أعِد ترتيب الملفات أو احذفها وشاهد عدد الصفحات قبل الدمج. يعمل داخل متصفحك بالكامل، فلا تُرفع مستنداتك أبدًا.',
  },
}
