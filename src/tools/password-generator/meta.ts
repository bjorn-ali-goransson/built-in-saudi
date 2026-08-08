import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { KeyIcon } from '../../components/icons'

export const passwordGeneratorTool: Tool = {
  id: 'password-generator',
  name: 'Password Generator',
  tagline: 'Strong, memorable passwords — generated locally.',
  description:
    'Create strong random passwords and passphrases entirely in your browser. Tune length and character sets, or generate a memorable word-based passphrase — with a live strength estimate. Nothing is ever sent anywhere.',
  category: 'Generators',
  // The Arabic side was one word — 'كلمة المرور' — while the strength checker
  // had 'قوة' and 'قوية' added during the evaluative-words fix. So «كلمة مرور
  // قوية», which plainly means "make me a strong password", went to the
  // checker. The English twin of this ("strong password") was measured and
  // fixed; the Arabic one survived because the benches were 10% Arabic.
  keywords: [
    // The Arabic NAME was the real problem, not the keywords: it was «مولّد
    // كلمات المرور» — the PLURAL — and «كلمات» does not contain «كلمة», so the
    // name could never match what a person types. Renamed to the singular,
    // which is the rule this file already records for فاتورة and ترجمة.
    // The phrase still leads here because earlier keywords score higher.
    'كلمة مرور قوية', 'كلمة المرور', 'قوية', 'إنشاء كلمة مرور', 'مولد كلمات المرور', 'عشوائية', 'آمنة',
    'password', 'passphrase', 'random', 'secure', 'generator',
  ],
  status: 'stable',
  Icon: KeyIcon,
  component: lazyTool(() => import('./PasswordGeneratorTool')),
  ar: {
    name: 'مولّد كلمة المرور',
    tagline: 'كلمات مرور قوية تُنشأ محليًا على جهازك.',
    description:
      'أنشئ كلمات مرور وعبارات مرور قوية وعشوائية بالكامل داخل متصفحك. تحكّم في الطول ومجموعات الأحرف، أو أنشئ عبارة مرور سهلة التذكّر مبنية على كلمات — مع تقدير فوري للقوة. لا يُرسل أي شيء إلى أي مكان.',
  },
}
