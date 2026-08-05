import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SearchIcon } from '../../components/icons'

export const invisibleCharsTool: Tool = {
  id: 'invisible-chars',
  name: 'Invisible Character Finder',
  nameAr: 'كاشف المحارف الخفية',
  tagline: 'Find the characters you cannot see.',
  description:
    'Text copied from a web page, a PDF or a chatbot often carries characters that are present but invisible — zero-width spaces, direction marks, exotic spaces, stray control codes. They break exact matching, search and diffs in ways that look like a bug in your code. This shows exactly where each one is, names it, and removes the ones you choose.',
  category: 'Text',
  keywords: ['invisible', 'zero width', 'unicode', 'hidden characters', 'whitespace', 'bidi', 'clean text', 'محارف خفية', 'يونيكود', 'مسافات', 'تنظيف نص'],
  status: 'stable',
  Icon: SearchIcon,
  component: lazyTool(() => import('./InvisibleCharsTool')),
  ar: {
    name: 'كاشف المحارف الخفية',
    tagline: 'اعثر على المحارف التي لا تراها.',
    description:
      'النص المنسوخ من صفحة ويب أو ملف PDF أو روبوت محادثة يحمل غالبًا محارف موجودة لكنها غير مرئية — مسافات بعرض صفري وعلامات اتجاه ومسافات غريبة ورموز تحكّم. وهي تُفسد المطابقة الدقيقة والبحث والمقارنة بطريقة تبدو كخلل في كودك. تُظهر الأداة موضع كل محرف وتسمّيه وتزيل ما تختاره منها.',
  },
}
