import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BracesIcon } from '../../components/icons'

export const jsonToTypesTool: Tool = {
  id: 'json-to-types',
  name: 'JSON to TypeScript',
  tagline: 'Turn a JSON sample into TypeScript interfaces.',
  description:
    'Paste a JSON object or array and get clean TypeScript interfaces inferred from it — nested objects become their own interfaces, arrays are typed, and keys missing from some items become optional. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['json', 'typescript', 'types', 'interface', 'convert', 'schema', 'codegen', 'أنواع', 'تايب سكريبت'],
  status: 'stable',
  Icon: BracesIcon,
  component: lazyTool(() => import('./JsonToTypesTool')),
  ar: {
    name: 'JSON إلى TypeScript',
    tagline: 'حوّل عيّنة JSON إلى واجهات TypeScript.',
    description:
      'الصق كائن أو مصفوفة JSON لتحصل على واجهات TypeScript مستنبطة منها — تصبح الكائنات المتداخلة واجهات خاصة بها، وتُصنَّف المصفوفات، وتصير المفاتيح الغائبة من بعض العناصر اختيارية. تعمل بالكامل في متصفحك.',
  },
}
