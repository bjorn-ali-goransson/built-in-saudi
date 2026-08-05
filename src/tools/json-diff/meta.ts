import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiffIcon } from '../../components/icons'

export const jsonDiffTool: Tool = {
  id: 'json-diff',
  name: 'JSON Diff',
  nameAr: 'مقارنة JSON',
  tagline: 'Compare two JSON documents by value, not by line.',
  description:
    'A line diff on JSON is close to useless: reformatting or reordering keys makes every line look changed while the data is identical, and a real change deep in a nested object gets buried. This compares values by path and lists exactly what was added, removed or changed — with an option to treat arrays as unordered.',
  category: 'Developer',
  keywords: ['json', 'diff', 'compare', 'structural', 'api', 'config', 'مقارنة', 'اختلاف', 'فروقات', 'تكوين'],
  status: 'stable',
  Icon: DiffIcon,
  component: lazyTool(() => import('./JsonDiffTool')),
  ar: {
    name: 'مقارنة ملفات JSON',
    tagline: 'قارن مستندَي JSON بالقيمة لا بالسطر.',
    description:
      'المقارنة السطرية لملفات JSON عديمة الجدوى تقريبًا: إعادة التنسيق أو ترتيب المفاتيح تجعل كل سطر يبدو متغيّرًا والبيانات نفسها، ويضيع التغيير الحقيقي داخل كائن متداخل. تقارن هذه الأداة القيم بالمسار وتسرد ما أُضيف وما حُذف وما تغيّر بالضبط — مع خيار التعامل مع المصفوفات كغير مرتّبة.',
  },
}
