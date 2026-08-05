import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ScanTextIcon } from '../../components/icons'

export const pdfToTextTool: Tool = {
  id: 'pdf-to-text',
  name: 'PDF to Text',
  nameAr: 'PDF إلى نص',
  tagline: 'Pull the text straight out of a PDF.',
  description:
    'Get the words out of a PDF as plain text — page by page, in reading order, ready to paste anywhere. If the PDF turns out to be a scan with no text in it, the tool says so and points you at OCR instead of handing you an empty box. The file is read in your browser and never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'text', 'extract', 'copy', 'convert', 'txt', 'نص', 'استخراج', 'تحويل', 'نسخ'],
  status: 'stable',
  Icon: ScanTextIcon,
  component: lazyTool(() => import('./PdfToTextTool')),
  ar: {
    name: 'PDF إلى نص',
    tagline: 'استخرج النص من ملف PDF مباشرةً.',
    description:
      'استخرج كلمات ملف PDF كنص عادي — صفحةً صفحة وبترتيب القراءة، جاهزًا للصق في أي مكان. وإن تبيّن أن الملف صورة ممسوحة بلا نص، تخبرك الأداة بذلك وتحيلك إلى التعرّف الضوئي بدل أن تسلّمك صندوقًا فارغًا. يُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
  },
}
