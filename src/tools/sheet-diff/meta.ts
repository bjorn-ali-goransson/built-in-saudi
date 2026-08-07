import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiffIcon } from '../../components/icons'

export const sheetDiffTool: Tool = {
  id: 'sheet-diff',
  name: 'Compare Spreadsheets',
  nameAr: 'مقارنة الجداول',
  tagline: 'What changed between two versions of a sheet.',
  description:
    'Compare two versions of the same spreadsheet — CSV or Excel — and see which rows were added, removed or changed, and exactly which cell changed in each. Rows are matched on a key column rather than their position, because by the time you need a diff somebody has already sorted or inserted something. Duplicate keys are reported instead of quietly picking one. Nothing is uploaded.',
  category: 'Files',
  keywords: [
    'compare', 'diff', 'spreadsheet', 'csv', 'excel', 'xlsx', 'changes', 'versions', 'rows', 'audit', 'reconcile',
    'مقارنة', 'فروق', 'جدول', 'إكسل', 'تغييرات', 'نسخ', 'صفوف', 'تدقيق',
  ],
  status: 'stable',
  Icon: DiffIcon,
  component: lazyTool(() => import('./SheetDiffTool')),
  ar: {
    name: 'مقارنة الجداول',
    tagline: 'ما الذي تغيّر بين نسختين من جدول.',
    description:
      'قارن نسختين من الجدول نفسه — CSV أو إكسل — وشاهد أي الصفوف أُضيفت وأيها حُذفت وأيها تغيّرت، وأي خلية تغيّرت في كل منها. وتُطابَق الصفوف على عمود مفتاح لا على مواضعها، لأنه حين تحتاج المقارنة يكون أحدهم قد فرز أو أدرج شيئًا. وتُذكر المفاتيح المكرّرة بدل اختيار أحدها في صمت. ولا يُرفع شيء.',
  },
}
