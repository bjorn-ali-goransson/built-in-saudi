import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RedactIcon } from '../../components/icons'

export const pdfRedactTool: Tool = {
  id: 'pdf-redact',
  name: 'Redact a PDF',
  nameAr: 'حجب معلومات من PDF',
  tagline: 'Actually remove the text, not just cover it.',
  description:
    'Drag over anything that has to go. A black rectangle drawn in a PDF viewer hides nothing — the text stays in the file and can be selected, copied or extracted with one command, which has published witness names, salaries and medical records more than once. This rebuilds each page as an image, so the words genuinely cease to exist, then re-reads the export to prove none are left.',
  category: 'PDF',
  keywords: ['redact', 'pdf', 'black out', 'remove text', 'privacy', 'confidential', 'حجب', 'إخفاء', 'طمس', 'سري', 'خصوصية', 'مستند'],
  status: 'stable',
  Icon: RedactIcon,
  component: lazyTool(() => import('./PdfRedactTool')),
  ar: {
    name: 'حجب معلومات من ملف PDF',
    tagline: 'احذف النص فعلًا لا تغطّه فقط.',
    description:
      'اسحب فوق كل ما يجب إزالته. فالمربع الأسود المرسوم في قارئ PDF لا يخفي شيئًا — إذ يبقى النص في الملف ويمكن تحديده أو نسخه أو استخراجه بأمر واحد، وقد نشر ذلك أسماء شهود ورواتب وسجلات طبية أكثر من مرة. تعيد هذه الأداة بناء كل صفحة صورةً، فتزول الكلمات فعلًا، ثم تعيد قراءة الملف المُصدَّر لتثبت أنه لم يبقَ منها شيء.',
  },
}
