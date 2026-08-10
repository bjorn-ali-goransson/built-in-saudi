import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PhotoDocIcon } from '../../components/icons'

export const pdfToWordTool: Tool = {
  id: 'pdf-to-word',
  name: 'PDF to Word',
  tagline: 'An editable .docx, with the headings and lists recovered.',
  description:
    'Turn a PDF into a Word document you can edit — headings, bold and lists recovered rather than one flat block of text, and a password-protected file opens with the password you already have. It runs entirely in your browser: the file is never uploaded, which is the whole point on a contract or a payslip.',
  category: 'PDF',
  keywords: [
    'pdf to word', 'pdf to docx', 'pdf to doc', 'convert pdf', 'pdf converter',
    'word', 'docx', 'editable', 'edit a pdf', 'export pdf',
    'PDF إلى وورد', 'تحويل PDF إلى وورد', 'بي دي اف الى وورد', 'وورد', 'تحويل PDF',
    'تعديل PDF', 'مستند قابل للتحرير',
  ],
  status: 'stable',
  Icon: PhotoDocIcon,
  component: lazyTool(() => import('./PdfToWordTool')),
  ar: {
    name: 'PDF إلى وورد',
    tagline: 'مستند ‎.docx‎ قابل للتحرير، مع استعادة العناوين والقوائم.',
    description:
      'حوّل ملف PDF إلى مستند وورد تستطيع تحريره — تُستعاد العناوين والخط العريض والقوائم بدل كتلة نصّ واحدة، ويُفتح الملف المحمي بكلمة المرور التي لديك. يعمل بالكامل داخل متصفحك: ولا يُرفع الملف أبدًا، وهذا هو المقصود كله في عقد أو قسيمة راتب.',
  },
}
