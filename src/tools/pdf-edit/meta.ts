import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EditIcon } from '../../components/icons'

export const pdfEditTool: Tool = {
  id: 'pdf-edit',
  name: 'Edit PDF',
  nameAr: 'تحرير PDF',
  tagline: 'Move or delete images, delete text, and add your own — in the browser.',
  description:
    'A rudimentary PDF editor that runs entirely in your browser: select and move or delete images, delete existing text runs, and drop in new text with resize handles and line breaks. It edits the PDF’s content streams with pdf-lib and never uploads your file. Existing text can’t be re-typed and selections are approximate — the tool says so up front.',
  category: 'PDF',
  keywords: ['pdf', 'edit', 'editor', 'edit pdf', 'delete image', 'remove text', 'add text', 'تحرير', 'تعديل pdf', 'حذف صورة', 'إضافة نص'],
  status: 'beta',
  Icon: EditIcon,
  component: lazyTool(() => import('./PdfEditTool')),
  ar: {
    name: 'تحرير PDF',
    tagline: 'حرّك أو احذف الصور، احذف النص، وأضِف نصك — داخل المتصفح.',
    description:
      'محرّر PDF مبدئي يعمل بالكامل داخل متصفحك: حدّد الصور وحرّكها أو احذفها، احذف مقاطع النص الموجودة، وأضِف نصًا جديدًا بمقابض لتغيير الحجم وفواصل أسطر. يحرّر محتوى الملف عبر pdf-lib ولا يرفع ملفك أبدًا. لا يمكن إعادة كتابة النص الموجود والتحديدات تقريبية — والأداة تنبّهك لذلك مسبقًا.',
  },
}
