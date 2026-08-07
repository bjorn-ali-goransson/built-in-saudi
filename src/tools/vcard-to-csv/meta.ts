import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { UsersIcon } from '../../components/icons'

export const vcardToCsvTool: Tool = {
  id: 'vcard-to-csv',
  name: 'vCard to CSV',
  nameAr: 'vCard إلى CSV',
  tagline: 'Contacts export, made readable.',
  description:
    'Turn the .vcf your phone exports into a spreadsheet. Arabic names written the way Android encodes them come out as names rather than gibberish, an iPhone export keeps the numbers it hides behind item groups, and a contact with three phone numbers gets three columns instead of losing two. Download it as CSV or as an Excel file that keeps the leading zero on every mobile number. A contacts file is about as personal as a file gets — this one never leaves your device.',
  category: 'Files',
  keywords: [
    'vcf', 'vcard', 'contacts', 'contacts to csv', 'contacts to excel', 'spreadsheet', 'csv', 'export', 'phone contacts', 'address book', 'excel', 'convert', 'android', 'iphone', 'backup',
    'جهات الاتصال', 'تصدير', 'دفتر عناوين', 'تحويل', 'إكسل', 'نسخة احتياطية', 'أندرويد', 'آيفون',
  ],
  status: 'stable',
  Icon: UsersIcon,
  component: lazyTool(() => import('./VcardToCsvTool')),
  ar: {
    name: 'vCard إلى CSV',
    tagline: 'اجعل ملف جهات الاتصال مقروءًا.',
    description:
      'حوّل ملف ‎.vcf‎ الذي يصدّره هاتفك إلى جدول. فالأسماء العربية المكتوبة بالطريقة التي يرمّزها بها أندرويد تخرج أسماءً لا طلاسم، وتصدير آيفون يحتفظ بالأرقام التي يخفيها خلف المجموعات، ومن له ثلاثة أرقام يحصل على ثلاثة أعمدة بدل أن يضيع منها رقمان. ونزّله ملف CSV أو ملف إكسل يحفظ الصفر الأول في كل رقم جوال. وملف جهات الاتصال من أشد الملفات خصوصية — وهذا لا يغادر جهازك.',
  },
}
