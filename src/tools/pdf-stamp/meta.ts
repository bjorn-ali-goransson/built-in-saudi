import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EditIcon } from '../../components/icons'

export const pdfStampTool: Tool = {
  id: 'pdf-stamp',
  name: 'Page Numbers & Watermark',
  nameAr: 'ترقيم الصفحات والعلامة المائية',
  tagline: 'Number the pages, add a header, footer or watermark.',
  description:
    'Stamp a PDF without flattening it — page numbers in any position and format including Arabic-Indic, a header, a footer and a diagonal watermark. You can start numbering after the cover and say what number that page should carry, so the printed number matches the contents. The text underneath stays searchable and selectable, because only the stamp is drawn on top.',
  category: 'PDF',
  keywords: ['page numbers', 'watermark', 'header', 'footer', 'stamp', 'pdf', 'ترقيم', 'علامة مائية', 'ترويسة', 'تذييل', 'ختم', 'صفحات'],
  status: 'stable',
  Icon: EditIcon,
  component: lazyTool(() => import('./PdfStampTool')),
  ar: {
    name: 'ترقيم صفحات PDF والعلامة المائية',
    tagline: 'رقّم الصفحات وأضف ترويسة أو تذييلًا أو علامة مائية.',
    description:
      'اختم ملف PDF دون تسطيحه — أرقام صفحات بأي موضع وصيغة بما فيها الأرقام الهندية، وترويسة وتذييل وعلامة مائية مائلة. ويمكنك بدء الترقيم بعد الغلاف وتحديد الرقم الذي تحمله تلك الصفحة، ليطابق الرقم المطبوع المحتوى. ويبقى النص تحتها قابلًا للبحث والتحديد، لأن الختم وحده هو ما يُرسم فوقه.',
  },
}
