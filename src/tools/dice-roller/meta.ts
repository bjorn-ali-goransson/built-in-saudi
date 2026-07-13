import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiceIcon } from '../../components/icons'

export const diceRollerTool: Tool = {
  id: 'dice-roller',
  name: 'Dice Roller',
  tagline: 'Roll any dice, or flip a coin — fairly.',
  description:
    'Roll any number of dice with any number of sides (d4 to d20 and beyond), see each result and the total, or flip a coin. Uses the browser’s cryptographic randomness for fair, unbiased results. Runs entirely in your browser.',
  category: 'Generators',
  keywords: ['dice', 'roll', 'd20', 'd6', 'coin flip', 'random', 'tabletop', 'rng', 'نرد', 'زهر', 'قطعة نقود'],
  status: 'stable',
  Icon: DiceIcon,
  component: lazyTool(() => import('./DiceRollerTool')),
  ar: {
    name: 'رامي النرد',
    tagline: 'ارمِ أي نرد أو اقلب عملة — بإنصاف.',
    description:
      'ارمِ أي عدد من حبّات النرد بأي عدد أوجه (من d4 إلى d20 وأكثر)، وشاهد كل نتيجة والمجموع، أو اقلب عملة. تستخدم العشوائية التشفيرية للمتصفح لنتائج عادلة غير متحيّزة. تعمل بالكامل في متصفحك.',
  },
}
