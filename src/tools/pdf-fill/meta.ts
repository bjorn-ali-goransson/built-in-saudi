import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { FormIcon } from '../../components/icons'

export const pdfFillTool: Tool = {
  id: 'pdf-fill',
  name: 'Fill PDF Form',
  nameAr: 'تعبئة نموذج PDF',
  tagline: 'Fill any PDF form — as a tidy form or right on the page.',
  description:
    'Fill in PDF forms in your browser. Interactive fields are detected automatically — descriptive forms become a clean web form, others get editable boxes right on the page — and PDFs with no fields let you drop text anywhere. Export a filled (optionally flattened) PDF with pdf-lib, never uploaded.',
  category: 'PDF',
  keywords: ['pdf', 'form', 'fill', 'fillable', 'acroform', 'fill pdf', 'تعبئة', 'نموذج pdf', 'ملء نموذج', 'استمارة'],
  status: 'stable',
  Icon: FormIcon,
  component: lazyTool(() => import('./PdfFillTool')),
  ar: {
    name: 'تعبئة نموذج PDF',
    tagline: 'عبّئ أي نموذج PDF — كنموذج مرتّب أو مباشرةً على الصفحة.',
    description:
      'عبّئ نماذج PDF داخل متصفحك. تُكتشف الحقول التفاعلية تلقائيًا — النماذج ذات الأسماء الواضحة تتحوّل إلى نموذج ويب أنيق، وغيرها تحصل على مربعات قابلة للتحرير على الصفحة — والملفات بلا حقول تتيح لك إضافة نص في أي مكان. صدّر ملفًا معبّأً (وقابلًا للتثبيت) عبر pdf-lib، دون رفعه أبدًا.',
  },
}
