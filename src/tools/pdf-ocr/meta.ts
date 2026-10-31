import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanTextIcon } from '../../components/icons'

export const pdfOcrTool: Tool = {
  id: 'pdf-ocr',
  name: 'PDF to Text',
  nameAr: 'PDF إلى نص',
  tagline: 'Get the text out of any PDF or photo — scanned or not.',
  description:
    'A scanned contract, a stamped letter, a photocopied receipt — a PDF that is really a picture, so nothing can be selected or searched. This reads the letters off each page and hands you the text, in English or Arabic. Pages that already carry real text are taken as they are rather than guessed at, and if the whole file already has text it says so instead of making a worse copy. The engine and its language models run in your browser, served from this site: the scan never leaves your device. It reads a photo, a screenshot or a scanned picture the same way, in English, Arabic or both at once.',
  category: 'PDF',
  keywords: ['بي دي اف', 
    'scanned pdf', 'scanned document', 'pdf ocr', 'ocr', 'scan to text', 'read scan', 'searchable', 'arabic ocr', 'extract text', 'pdf to text', 'copy text from pdf', 'stamped', 'image pdf',
    'مسح ضوئي', 'تعرف ضوئي', 'استخراج نص', 'pdf إلى نص', 'نص من pdf', 'pdf', 'قراءة', 'عربي', 'مستند ممسوح', 'صورة',
    // Merged in from Image to Text (November 2026).
    'image to text', 'screenshot to text', 'text from image', 'read text', 'photo to text', 'tesseract',
    'استخراج النص', 'تحويل صورة إلى نص', 'قراءة النص', 'نص من صورة',
  ],
  aliases: ['Image to Text (OCR)', 'استخراج النص من صورة'],
  status: 'stable',
  Icon: ScanTextIcon,
  component: lazyTool(() => import('./PdfOcrTool')),
  ar: {
    name: 'PDF إلى نص',
    tagline: 'استخرج النص من أي PDF أو صورة — ممسوحًا كان أو لا.',
    description:
      'عقد ممسوح، أو خطاب مختوم، أو إيصال مصوَّر — ملف PDF هو في الحقيقة صورة، فلا يمكن تحديد شيء فيه ولا البحث. تقرأ هذه الأداة الحروف من كل صفحة وتسلّمك النص، بالعربية أو الإنجليزية. وتُؤخذ الصفحات التي تحمل نصًا حقيقيًا كما هي بدل تخمينها، وإن كان الملف كله نصًا أصلًا نبّهتك بدل أن تصنع نسخة أسوأ. ويعمل المحرك ونماذجه اللغوية في متصفحك وتُقدَّم من هذا الموقع: فلا يغادر المستند جهازك. وتقرأ الصورة أو لقطة الشاشة أو الصفحة الممسوحة بالطريقة نفسها، بالعربية أو الإنجليزية أو بهما معًا.',
  },
}
