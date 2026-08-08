import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ExchangeIcon } from '../../components/icons'

export const francoArabicTool: Tool = {
  id: 'franco-arabic',
  name: 'Franco-Arabic Converter',
  nameAr: 'محوّل الفرانكو',
  tagline: 'Turn 3arabizi into real Arabic script, and back.',
  description:
    'Convert Franco-Arabic — the chat alphabet where 3 is ع, 7 is ح and 5 is خ — into proper Arabic writing, or go the other way. Common words are recognised whole so the result reads like Arabic rather than a cipher, and the letters that are genuinely ambiguous (s could be س or ص) are listed so you can check them.',
  category: 'Arabic',
  keywords: ['franco', 'arabizi', '3arabizi', 'transliteration', 'chat alphabet', 'arabic', 'فرانكو', 'عربيزي', 'تحويل', 'كتابة عربية', 'دردشة'],
  status: 'stable',
  Icon: ExchangeIcon,
  component: lazyTool(() => import('./FrancoArabicTool')),
  ar: {
    name: 'محوّل الفرانكو إلى عربي',
    tagline: 'حوّل العربيزي إلى حروف عربية حقيقية، والعكس.',
    description:
      'حوّل الفرانكو — أبجدية الدردشة حيث ٣ تعني ع و٧ تعني ح و٥ تعني خ — إلى كتابة عربية سليمة، أو اعكس الاتجاه. تُعرف الكلمات الشائعة ككلمات كاملة ليقرأ الناتج كعربية لا كشيفرة، وتُذكر الحروف الملتبسة فعلًا (فـs قد تكون س أو ص) لتراجعها بنفسك.',
  },
}
