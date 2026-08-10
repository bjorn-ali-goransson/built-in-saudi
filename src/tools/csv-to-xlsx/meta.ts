import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const csvToXlsxTool: Tool = {
  id: 'csv-to-xlsx',
  name: 'CSV to Excel',
  nameAr: 'CSV إلى إكسل',
  tagline: 'Convert without losing leading zeros.',
  description:
    'Turn a CSV into a real .xlsx, so opening it does not damage it. A CSV carries no types, so Excel guesses — and its guesses eat the leading zero off every phone number and national ID, and round a 16-digit IBAN into scientific notation. Here each column declares what it is, and the file is UTF-8 by definition, so Arabic arrives as Arabic. The conversion runs in your browser.',
  category: 'Converters',
  keywords: [
    'csv', 'xlsx', 'excel', 'convert', 'spreadsheet', 'leading zeros', 'scientific notation', 'iban', 'phone numbers', 'arabic csv', 'encoding', 'utf-8',
    'إكسل', 'تحويل', 'جدول', 'أصفار', 'آيبان', 'ترميز', 'عربي',
  ],
  inverse: 'xlsx-convert',
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./CsvToXlsxTool')),
  ar: {
    name: 'CSV إلى إكسل',
    tagline: 'حوّل دون أن تفقد الأصفار الأولى.',
    description:
      'حوّل ملف CSV إلى ملف ‎.xlsx‎ حقيقي، حتى لا يفسده مجرد فتحه. فملف CSV لا يحمل أنواعًا، فيخمّن إكسل — وتخمينه يأكل الصفر الأول من كل رقم جوال وهوية، ويقرّب رقم آيبان من ستة عشر رقمًا إلى صيغة أُسّية. أما هنا فيعلن كل عمود عن نوعه، والملف بترميز UTF-8 أصلًا، فتصل العربية عربيةً. وتجري العملية في متصفحك.',
  },
}
