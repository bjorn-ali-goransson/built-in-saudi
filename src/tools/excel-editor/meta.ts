import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SpreadsheetIcon } from '../../components/icons'

export const excelEditorTool: Tool = {
  id: 'excel-editor',
  name: 'Spreadsheet Editor',
  nameAr: 'محرر الجداول',
  tagline: 'Open, edit and save Excel spreadsheets in your browser — formulas, charts and live co-editing.',
  description:
    'A real spreadsheet that runs entirely in your browser. Open .xlsx, .ods and .csv files, edit with over 160 functions, cross-sheet references and named ranges, format cells, merge, freeze panes, sort, filter, add drop-down lists, conditional colours, charts and pictures, then save back to the same file or download it as Excel. Workbooks are kept in this browser, never uploaded. Invite others to edit live, browser to browser, with you as the owner whose copy is the truth.',
  category: 'Office',
  keywords: [
    // Merged in November 2026 from the tools this one replaced.
    'csv to excel', 'csv to xlsx', 'excel to csv', 'xlsx to csv', 'excel to json', 'تحويل csv إلى اكسل','excel', 'xlsx', 'spreadsheet', 'edit excel online', 'open xlsx', 'excel editor', 'excel online free', 'sheets', 'workbook', 'formulas', 'csv editor', 'ods', 'collaborative spreadsheet', 'إكسل', 'اكسل', 'جدول بيانات', 'جداول', 'تعديل ملف اكسل', 'فتح ملف xlsx', 'محرر اكسل', 'صيغ'],
  status: 'beta',
  Icon: SpreadsheetIcon,
  component: lazyTool(() => import('./ExcelEditorTool')),
  ar: {
    name: 'محرر الجداول',
    tagline: 'افتح جداول إكسل وعدّلها واحفظها في متصفحك — صيغ ومخططات وتحرير مشترك مباشر.',
    description:
      'جدول بيانات حقيقي يعمل بالكامل في متصفحك. افتح ملفات ‎.xlsx و‎.ods و‎.csv وعدّلها بأكثر من ١٦٠ دالة ومراجع بين الأوراق ونطاقات مسماة، ونسّق الخلايا وادمجها وجمّد الأجزاء وافرز وصفِّ وأضف قوائم منسدلة وألوانًا شرطية ومخططات وصورًا، ثم احفظ في الملف نفسه أو نزّله بصيغة إكسل. تبقى المصنفات في هذا المتصفح ولا تُرفع. ادعُ آخرين للتحرير مباشرة من متصفح إلى متصفح، وأنت المالك الذي نسخته هي المرجع.',
  },
}
