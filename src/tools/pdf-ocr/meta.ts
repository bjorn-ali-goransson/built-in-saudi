import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanTextIcon } from '../../components/icons'

export const pdfOcrTool: Tool = {
  id: 'pdf-ocr',
  name: 'Scanned PDF to Text',
  nameAr: 'نص من PDF ممسوح',
  tagline: 'Read the text out of a scan.',
  description:
    'A scanned contract, a stamped letter, a photocopied receipt — a PDF that is really a picture, so nothing can be selected or searched. This reads the letters off each page and hands you the text, in English or Arabic. Pages that already carry real text are taken as they are rather than guessed at, and if the whole file already has text it says so instead of making a worse copy. The engine and its language models run in your browser, served from this site: the scan never leaves your device.',
  category: 'PDF',
  keywords: ['بي دي اف', 
    'scanned pdf', 'scanned document', 'pdf ocr', 'ocr', 'scan to text', 'read scan', 'searchable', 'arabic ocr', 'extract text', 'stamped', 'image pdf',
    'مسح ضوئي', 'تعرف ضوئي', 'استخراج نص', 'pdf', 'قراءة', 'عربي', 'مستند ممسوح', 'صورة',
  ],
  status: 'stable',
  Icon: ScanTextIcon,
  component: lazyTool(() => import('./PdfOcrTool')),
  ar: {
    name: 'نص من PDF ممسوح',
    tagline: 'اقرأ نص المستند الممسوح ضوئيًا.',
    description:
      'عقد ممسوح، أو خطاب مختوم، أو إيصال مصوَّر — ملف PDF هو في الحقيقة صورة، فلا يمكن تحديد شيء فيه ولا البحث. تقرأ هذه الأداة الحروف من كل صفحة وتسلّمك النص، بالعربية أو الإنجليزية. وتُؤخذ الصفحات التي تحمل نصًا حقيقيًا كما هي بدل تخمينها، وإن كان الملف كله نصًا أصلًا نبّهتك بدل أن تصنع نسخة أسوأ. ويعمل المحرك ونماذجه اللغوية في متصفحك وتُقدَّم من هذا الموقع: فلا يغادر المستند جهازك.',
  },
}
