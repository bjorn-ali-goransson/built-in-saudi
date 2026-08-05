import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ExchangeIcon } from '../../components/icons'

export const arabicNumeralsTool: Tool = {
  id: 'arabic-numerals',
  name: 'Arabic Numerals Converter',
  nameAr: 'محوّل الأرقام',
  tagline: 'Switch ٠١٢٣ to 0123 and back, anywhere in your text.',
  description:
    'Convert the digits in any text between Western (0123), Arabic-Indic (٠١٢٣) and Persian (۰۱۲۳) shapes — paste a sentence, a table or a whole document and only the numbers change. Decimal and thousands marks (٫ ٬) travel with them so amounts stay readable. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: ['arabic numerals', 'indic', 'digits', 'convert', 'هندية', 'أرقام', 'تحويل الأرقام', 'عربية', '٠١٢٣', '0123', 'persian'],
  status: 'stable',
  Icon: ExchangeIcon,
  component: lazyTool(() => import('./ArabicNumeralsTool')),
  ar: {
    name: 'محوّل الأرقام العربية والهندية',
    tagline: 'حوّل ٠١٢٣ إلى 0123 والعكس داخل أي نص.',
    description:
      'حوّل الأرقام داخل أي نص بين الأشكال الإنجليزية (0123) والهندية (٠١٢٣) والفارسية (۰۱۲۳) — الصق جملة أو جدولًا أو مستندًا كاملًا ولن يتغيّر سوى الأرقام. وتنتقل معها علامتا العشرية والآلاف (٫ ٬) لتبقى المبالغ مقروءة. يعمل بالكامل في متصفحك.',
  },
}
