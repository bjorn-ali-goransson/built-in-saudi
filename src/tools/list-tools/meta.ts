import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ListIcon } from '../../components/icons'

export const listToolsTool: Tool = {
  id: 'list-tools',
  name: 'List Tools',
  tagline: 'Sort, dedupe, trim and shuffle a list of lines.',
  description:
    'Paste a list, one item per line, and clean it up: sort alphabetically or numerically, remove duplicates and blank lines, trim whitespace, change case, reverse or shuffle. Live counts show items before and after. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['list', 'sort', 'dedupe', 'duplicates', 'unique', 'trim', 'shuffle', 'lines', 'قائمة', 'ترتيب', 'إزالة التكرار'],
  status: 'stable',
  Icon: ListIcon,
  component: lazyTool(() => import('./ListToolsTool')),
  ar: {
    name: 'أدوات القوائم',
    tagline: 'رتّب وأزل التكرار وشذّب واخلط قائمة أسطر.',
    description:
      'الصق قائمة، عنصرًا في كل سطر، ونظّفها: رتّب أبجديًا أو رقميًا، أزل المكرّرات والأسطر الفارغة، شذّب المسافات، غيّر الحالة، اعكس أو اخلط. تُظهر العدّادات العدد قبل وبعد. يعمل بالكامل في متصفحك.',
  },
}
