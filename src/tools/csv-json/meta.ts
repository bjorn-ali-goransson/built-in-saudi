import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const csvJsonTool: Tool = {
  id: 'csv-json',
  name: 'CSV ⇄ JSON',
  tagline: 'Convert between CSV and JSON, both ways.',
  description:
    'Paste CSV to get an array of JSON objects keyed by the header row, or paste JSON to get CSV back. Handles quoted fields, commas and newlines inside values. Everything is parsed in your browser — nothing is uploaded.',
  category: 'Converters',
  keywords: ['csv', 'json', 'convert', 'spreadsheet', 'data', 'table', 'parse', 'تحويل', 'بيانات'],
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./CsvJsonTool')),
  ar: {
    name: 'CSV ⇄ JSON',
    tagline: 'حوّل بين CSV وJSON في الاتجاهين.',
    description:
      'الصق CSV لتحصل على مصفوفة كائنات JSON مفهرسة بصف الترويسة، أو الصق JSON لتحصل على CSV. يتعامل مع الحقول المقتبسة والفواصل والأسطر داخل القيم. كل التحليل يجري في متصفحك — لا يُرفع أي شيء.',
  },
}
