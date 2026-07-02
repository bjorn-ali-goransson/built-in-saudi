import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TextIcon } from '../../components/icons'

export const caseConverterTool: Tool = {
  id: 'case-converter',
  name: 'Case Converter',
  nameAr: 'محوّل حالة الأحرف',
  tagline: 'UPPER, lower, Title, camelCase, snake_case…',
  description:
    'Convert text between every case at once — UPPERCASE, lowercase, Title Case, Sentence case, camelCase, PascalCase, snake_case, kebab-case and CONSTANT_CASE — with live output, a word/character count and one-tap copy. Arabic passes through untouched.',
  category: 'Text',
  keywords: ['case', 'converter', 'uppercase', 'lowercase', 'title case', 'camelcase', 'snake_case', 'kebab', 'حالة الأحرف', 'تحويل'],
  status: 'stable',
  Icon: TextIcon,
  component: lazyTool(() => import('./CaseConverterTool')),
  ar: {
    name: 'محوّل حالة الأحرف',
    tagline: 'أحرف كبيرة/صغيرة، camelCase، snake_case…',
    description:
      'حوّل النص بين جميع الحالات دفعةً واحدة — كبيرة، صغيرة، أول كل كلمة، أول الجملة، camelCase وPascalCase وsnake_case وkebab-case وCONSTANT_CASE — مع ناتج مباشر وعدّ للكلمات والأحرف ونسخ بلمسة. العربية تمرّ دون تغيير.',
  },
}
