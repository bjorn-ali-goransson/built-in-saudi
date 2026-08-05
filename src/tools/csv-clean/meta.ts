import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const csvCleanTool: Tool = {
  id: 'csv-clean',
  name: 'CSV Cleaner',
  nameAr: 'منظّف ملفات CSV',
  tagline: 'Tidy a messy CSV: trim, dedupe, drop the blanks.',
  description:
    'Clean up a CSV without opening a spreadsheet — trim stray spaces, drop blank rows and entirely empty columns, and remove duplicate rows. It detects the separator itself (Excel in an Arabic or European locale writes semicolons and never warns you) and flags rows whose field count does not match the header, which is what usually breaks an import. Nothing is uploaded.',
  category: 'Developer',
  keywords: ['csv', 'clean', 'deduplicate', 'trim', 'excel', 'delimiter', 'tidy', 'تنظيف', 'مكرر', 'جدول', 'فاصلة', 'بيانات'],
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./CsvCleanTool')),
  ar: {
    name: 'منظّف ملفات CSV',
    tagline: 'رتّب ملف CSV فوضويًا: شذّب، وأزل التكرار والفراغات.',
    description:
      'نظّف ملف CSV دون فتح برنامج جداول — شذّب المسافات الزائدة، واحذف الصفوف الفارغة والأعمدة الفارغة تمامًا، وأزل الصفوف المكرّرة. تكتشف الأداة الفاصل بنفسها (إكسل في اللغة العربية أو الأوروبية يكتب فاصلة منقوطة دون أن ينبّهك)، وتُظهر الصفوف التي يختلف عدد حقولها عن العناوين، وهو ما يُفسد الاستيراد عادةً. لا يُرفع شيء.',
  },
}
