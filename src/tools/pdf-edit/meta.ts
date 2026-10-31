import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EditIcon } from '../../components/icons'

export const pdfEditTool: Tool = {
  id: 'pdf-edit',
  name: 'Edit PDF',
  nameAr: 'تحرير PDF',
  tagline: 'Sign a PDF, fill in its form, or add text and move its images.',
  description:
    'A rudimentary PDF editor that runs entirely in your browser: select and move or delete images, and drop in new text with resize handles and line breaks. It edits the PDF’s content streams with pdf-lib and never uploads your file. Existing text can’t be edited or removed yet — the tool says so up front. The same page signs a PDF — draw your signature with a finger or mouse and place it exactly, with a magnifier — and fills in a PDF form, detecting its fields or letting you type anywhere on the page.',
  category: 'PDF',
  keywords: [
    'بي دي اف', 'pdf', 'edit', 'editor', 'edit pdf', 'delete image', 'remove text', 'add text', 'تحرير', 'تعديل pdf', 'حذف صورة', 'إضافة نص',
    // Merged in from Sign PDF and Fill PDF Form (November 2026).
    'sign', 'signature', 'e-sign', 'sign pdf', 'موقّع pdf', 'sign a document', 'توقيع', 'وقع', 'وقّع', 'توقيع مستند', 'وقّع المستند', 'عقد', 'توقيع عقد', 'توقيع pdf', 'إمضاء', 'التوقيع الإلكتروني',
    'form', 'fill', 'fillable', 'acroform', 'fill pdf', 'تعبئة', 'نموذج pdf', 'ملء نموذج', 'استمارة',
  ],
  aliases: ['Sign PDF', 'توقيع PDF', 'Fill PDF Form', 'تعبئة نموذج PDF'],
  status: 'stable',
  Icon: EditIcon,
  component: lazyTool(() => import('./PdfEditTool')),
  ar: {
    name: 'تحرير PDF',
    tagline: 'وقّع ملف PDF، أو املأ نموذجه، أو أضف نصًا وحرّك صوره.',
    description:
      'محرّر PDF مبدئي يعمل بالكامل داخل متصفحك: حدّد الصور وحرّكها أو احذفها، وأضِف نصًا جديدًا بمقابض لتغيير الحجم وفواصل أسطر. يحرّر محتوى الملف عبر pdf-lib ولا يرفع ملفك أبدًا. لا يمكن تعديل أو حذف النص الموجود بعد — والأداة تنبّهك لذلك مسبقًا. وتوقّع الصفحة نفسها ملف PDF — ارسم توقيعك بإصبعك أو بالفأرة وضعه بدقة مع عدسة مكبّرة — وتملأ نماذج PDF، فتكتشف حقولها أو تتيح لك الكتابة في أي مكان من الصفحة.',
  },
}
