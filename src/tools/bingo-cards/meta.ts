import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BingoIcon } from '../../components/icons'

export const bingoCardsTool: Tool = {
  id: 'bingo-cards',
  name: 'Bingo Cards',
  nameAr: 'بطاقات بينغو',
  tagline: 'Unique printable cards from your own word list.',
  description:
    'Turn a list of words, names or numbers into printable bingo cards — 3×3, 4×4 or 5×5, with an optional free centre. Every card is checked against the others so no two players get the same one, and it tells you honestly when your list is too short to make as many distinct cards as you asked for. Comes with a shuffled call list, because reading them out in the order you typed rewards whoever has the top of your list. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'bingo', 'cards', 'printable', 'classroom', 'game', 'teacher', 'party', 'icebreaker', 'call list', 'random',
    'بينغو', 'بطاقات', 'طباعة', 'صف', 'لعبة', 'معلم', 'حفلة', 'قائمة نداء', 'عشوائي',
  ],
  status: 'stable',
  Icon: BingoIcon,
  component: lazyTool(() => import('./BingoCardsTool')),
  ar: {
    name: 'بطاقات بينغو',
    tagline: 'بطاقات فريدة للطباعة من قائمتك أنت.',
    description:
      'حوّل قائمة كلمات أو أسماء أو أرقام إلى بطاقات بينغو قابلة للطباعة — ٣×٣ أو ٤×٤ أو ٥×٥، مع مربّع حر اختياري في الوسط. تُقارن كل بطاقة بغيرها فلا يحصل لاعبان على البطاقة نفسها، وتخبرك بصراحة حين تكون قائمتك أقصر من أن تصنع العدد الذي طلبته من البطاقات المختلفة. ومعها قائمة نداء مخلوطة، لأن القراءة بترتيب ما كتبته تكافئ من لديه أوائل قائمتك. تعمل داخل متصفحك بالكامل.',
  },
}
