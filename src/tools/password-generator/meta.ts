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
  keywords: ['password', 'passphrase', 'random', 'secure', 'generator', 'كلمة المرور'],
  status: 'stable',
  Icon: KeyIcon,
  component: lazyTool(() => import('./PasswordGeneratorTool')),
  ar: {
    name: 'مولّد كلمات المرور',
    tagline: 'كلمات مرور قوية تُنشأ محليًا على جهازك.',
    description:
      'أنشئ كلمات مرور وعبارات مرور قوية وعشوائية بالكامل داخل متصفحك. تحكّم في الطول ومجموعات الأحرف، أو أنشئ عبارة مرور سهلة التذكّر مبنية على كلمات — مع تقدير فوري للقوة. لا يُرسل أي شيء إلى أي مكان.',
  },
}
