import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SplitIcon } from '../../components/icons'

export const csvSplitTool: Tool = {
  id: 'csv-split',
  name: 'Split a CSV',
  nameAr: 'تقسيم ملف CSV',
  tagline: 'Break a big export into files you can actually send.',
  description:
    'Break one big spreadsheet into several smaller CSVs — by row count, by file size, or one file per value in a column, so a staff list becomes one file per department. Every part keeps the header row, and a byte-order mark is added by default so Excel reads Arabic correctly instead of turning it into mojibake. Downloads as a zip. Nothing is uploaded.',
  category: 'Files',
  keywords: [
    'csv', 'split', 'divide', 'chunk', 'large file', 'excel', 'xlsx', 'export', 'batch', 'zip', 'by column',
    'تقسيم', 'csv', 'ملف كبير', 'إكسل', 'تصدير', 'أجزاء', 'مضغوط',
  ],
  status: 'stable',
  Icon: SplitIcon,
  component: lazyTool(() => import('./CsvSplitTool')),
  ar: {
    name: 'تقسيم ملف CSV',
    tagline: 'جزّئ تصديرًا ضخمًا إلى ملفات يمكن إرسالها.',
    description:
      'قسّم جدولًا كبيرًا إلى ملفات CSV أصغر — بعدد الصفوف أو بحجم الملف أو ملفًا لكل قيمة في عمود، فتصير قائمة الموظفين ملفًا لكل إدارة. ويحتفظ كل جزء بصف العناوين، وتُضاف علامة ترتيب البايتات افتراضيًا ليقرأ إكسل العربية صحيحة بدل أن يحيلها رموزًا. ويُنزَّل الكل في ملف مضغوط. ولا يُرفع شيء.',
  },
}
