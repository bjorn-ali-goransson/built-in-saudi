import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SlugIcon } from '../../components/icons'

export const slugifyTool: Tool = {
  id: 'slugify',
  name: 'Slugify',
  tagline: 'Turn a title into a clean URL slug.',
  description:
    'Convert a title or heading into a clean, URL-safe slug — lowercased, accents stripped, spaces and punctuation turned into hyphens, with a basic Arabic-to-Latin transliteration. Choose the separator and case. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['slug', 'slugify', 'url', 'permalink', 'seo', 'transliterate', 'kebab', 'سلаг', 'رابط', 'عنوان'],
  status: 'stable',
  Icon: SlugIcon,
  component: lazyTool(() => import('./SlugifyTool')),
  ar: {
    name: 'مولّد الروابط اللطيفة',
    tagline: 'حوّل عنوانًا إلى «سلَگ» نظيف للرابط.',
    description:
      'حوّل عنوانًا إلى «سلَگ» نظيف آمن للروابط — أحرف صغيرة، بلا تشكيل، والمسافات وعلامات الترقيم تصبح شرطات، مع تحويل تقريبي من العربية إلى اللاتينية. اختر الفاصل والحالة. يعمل بالكامل في متصفحك.',
  },
}
