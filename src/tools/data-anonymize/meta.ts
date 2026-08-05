import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RedactIcon } from '../../components/icons'

export const dataAnonymizeTool: Tool = {
  id: 'data-anonymize',
  name: 'Data Anonymizer',
  nameAr: 'إخفاء البيانات الشخصية',
  tagline: 'Strip the personal data before you share a file.',
  description:
    'Before you send a spreadsheet to a colleague, a vendor or a chatbot, remove the parts that identify a person — emails, phone numbers, IBANs, Saudi ID and iqama numbers, card numbers, IPs. Mask them, redact them, or replace each value with a stable label so the data still joins on itself. It runs entirely in this page, which is rather the point.',
  category: 'Text',
  keywords: ['anonymize', 'redact', 'pii', 'mask', 'privacy', 'sanitize', 'إخفاء', 'بيانات شخصية', 'خصوصية', 'حجب', 'تعمية'],
  status: 'stable',
  Icon: RedactIcon,
  component: lazyTool(() => import('./DataAnonymizeTool')),
  ar: {
    name: 'إخفاء البيانات الشخصية',
    tagline: 'أزل البيانات الشخصية قبل مشاركة ملف.',
    description:
      'قبل أن ترسل جدولًا إلى زميل أو مورّد أو روبوت محادثة، أزل ما يدل على الأشخاص — البُرد الإلكترونية وأرقام الهواتف وأرقام الآيبان وأرقام الهوية والإقامة وأرقام البطاقات وعناوين IP. أخفِها أو احجبها أو استبدل كل قيمة بعلامة ثابتة لتبقى البيانات قابلة للربط. تعمل الأداة داخل هذه الصفحة بالكامل، وهذا هو المقصود.',
  },
}
