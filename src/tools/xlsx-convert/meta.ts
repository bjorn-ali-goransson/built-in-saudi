import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const xlsxConvertTool: Tool = {
  id: 'xlsx-convert',
  name: 'Excel to CSV / JSON',
  nameAr: 'إكسل إلى CSV أو JSON',
  tagline: 'Get the data out of an .xlsx, privately.',
  description:
    'Open an Excel .xlsx workbook in your browser and take the data out as CSV, TSV or JSON — nothing is uploaded. Reads every sheet, keeps blank cells in the right columns, and turns date cells back into real dates instead of the five-digit numbers a naive converter emits. Values only: formulas come out as the value the spreadsheet last calculated.',
  category: 'Converters',
  keywords: [
    'xlsx', 'excel', 'csv', 'json', 'spreadsheet', 'convert', 'export', 'tsv', 'sheet', 'data', 'offline',
    'إكسل', 'جدول', 'تحويل', 'بيانات', 'تصدير', 'ورقة', 'دون رفع',
  ],
  inverse: 'csv-to-xlsx',
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./XlsxConvertTool')),
  ar: {
    name: 'إكسل إلى CSV أو JSON',
    tagline: 'استخرج بيانات ملف ‎.xlsx‎ بخصوصية.',
    description:
      'افتح مصنّف إكسل ‎.xlsx‎ في متصفحك واستخرج بياناته بصيغة CSV أو TSV أو JSON — دون رفع أي شيء. يقرأ كل الأوراق، ويُبقي الخلايا الفارغة في أعمدتها الصحيحة، ويعيد خلايا التواريخ تواريخَ حقيقية بدل الأرقام ذات الخمس خانات التي تخرجها المحوّلات الساذجة. القيم فقط: فالمعادلات تخرج بالقيمة التي حسبها الجدول آخر مرة.',
  },
}
