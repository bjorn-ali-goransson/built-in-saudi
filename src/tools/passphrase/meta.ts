import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KeyIcon } from '../../components/icons'

export const passphraseTool: Tool = {
  id: 'passphrase',
  name: 'Passphrase Generator',
  nameAr: 'مولّد عبارات المرور',
  tagline: 'Four words you can remember, or dice you can trust.',
  description:
    'Build a passphrase from a 1296-word list — 10.3 bits a word, and short enough to type. You can also roll physical dice and enter the numbers, which is the original diceware method and the only version whose randomness you do not have to take on trust from a browser. There is an Arabic wordlist too. The entropy shown is computed from the actual list, and the crack time assumes the pessimistic case.',
  category: 'Generators',
  keywords: ['passphrase', 'diceware', 'password', 'dice', 'entropy', 'memorable', 'عبارة مرور', 'كلمة سر', 'نرد', 'عشوائية', 'أمان'],
  status: 'stable',
  Icon: KeyIcon,
  component: lazyTool(() => import('./PassphraseTool')),
  ar: {
    name: 'مولّد عبارات المرور',
    tagline: 'أربع كلمات تتذكّرها، أو نرد تثق به.',
    description:
      'ابنِ عبارة مرور من قائمة بـ١٢٩٦ كلمة — ١٠٫٣ بت لكل كلمة، وقصيرة بما يكفي للكتابة. ويمكنك أيضًا رمي نرد حقيقي وإدخال الأرقام، وهي طريقة الـdiceware الأصلية والنسخة الوحيدة التي لا تضطر لتصديق متصفح في عشوائيتها. وهناك قائمة كلمات عربية أيضًا. وتُحسب العشوائية المعروضة من القائمة الفعلية، ويفترض زمن الكسر أسوأ الحالات.',
  },
}
