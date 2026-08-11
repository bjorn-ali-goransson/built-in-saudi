import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiffIcon } from '../../components/icons'

export const pdfDiffTool: Tool = {
  id: 'pdf-diff',
  name: 'Compare PDFs',
  tagline: 'Which words changed between two versions — in your browser.',
  description:
    'Compare two versions of a PDF and see exactly which words were added or removed, and on which page. It aligns the text rather than the pixels, so a paragraph inserted at the top does not make the rest of the document look rewritten. Neither file is uploaded — which matters, because the documents people compare are contracts, payslips and policies.',
  category: 'PDF',
  keywords: [
    'بي دي اف', 'compare pdf', 'pdf compare', 'pdf diff', 'contract', 'redline', 'two pdfs', 'draft',
    'مقارنة pdf', 'مقارنة ملفي pdf', 'عقد', 'مسوّدة',
  ],
  status: 'stable',
  Icon: DiffIcon,
  component: lazyTool(() => import('./PdfDiffTool')),
  ar: {
    name: 'مقارنة ملفات PDF',
    tagline: 'أي الكلمات تغيّرت بين نسختين — داخل متصفحك.',
    description:
      'قارن نسختين من ملف PDF واعرف الكلمات المضافة والمحذوفة بالضبط، وفي أي صفحة. تحاذي النصّ لا البكسل، فلا تجعل فقرةٌ مُدرَجة في الأعلى بقيةَ المستند تبدو معادة الكتابة. ولا يُرفع أي من الملفين — وهذا مهم، فالمستندات التي يقارنها الناس عقود وكشوف رواتب ووثائق.',
  },
}
