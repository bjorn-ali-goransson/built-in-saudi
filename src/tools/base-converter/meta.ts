import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BinaryIcon } from '../../components/icons'

export const baseConverterTool: Tool = {
  id: 'base-converter',
  name: 'Number Base Converter',
  tagline: 'Convert between binary, octal, decimal and hex.',
  description:
    'Convert a number between binary, octal, decimal, hexadecimal and any base from 2 to 36, all at once and in real time. Uses arbitrary-precision big integers so large values stay exact. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['base', 'binary', 'hex', 'hexadecimal', 'octal', 'decimal', 'radix', 'number', 'convert', 'ثنائي', 'ست عشري'],
  status: 'stable',
  Icon: BinaryIcon,
  component: lazyTool(() => import('./BaseConverterTool')),
  ar: {
    name: 'محوّل أنظمة الأعداد',
    tagline: 'حوّل بين الثنائي والثماني والعشري والست عشري.',
    description:
      'حوّل عددًا بين الثنائي والثماني والعشري والست عشري وأي أساس من 2 إلى 36، دفعةً واحدة وفي الوقت الحقيقي. يستخدم أعدادًا صحيحة كبيرة لدقة القيم الكبيرة. يعمل بالكامل في متصفحك.',
  },
}
