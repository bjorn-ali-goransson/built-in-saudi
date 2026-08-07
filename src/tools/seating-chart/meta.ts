import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GridIcon } from '../../components/icons'

export const seatingChartTool: Tool = {
  id: 'seating-chart',
  name: 'Seating Chart',
  nameAr: 'مخطط جلوس الفصل',
  tagline: 'Seat a class, keeping the wrong pairs apart.',
  description:
    'Paste your class list, set the room out in rows and desks, and get a printable seating chart. Name the pairs who must not sit together and it works around them — and says so plainly when the room is too full to manage it, rather than quietly seating them side by side. Every chart has a code, so a reprint seats the same people in the same desks. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'seating', 'chart', 'classroom', 'class', 'plan', 'desks', 'teacher', 'school', 'printable', 'random', 'students',
    'مخطط جلوس', 'فصل', 'مقاعد', 'معلم', 'مدرسة', 'طباعة', 'توزيع', 'طلاب',
  ],
  status: 'stable',
  Icon: GridIcon,
  component: lazyTool(() => import('./SeatingChartTool')),
  ar: {
    name: 'مخطط جلوس الفصل',
    tagline: 'وزّع الفصل مع إبعاد من لا يجلسان معًا.',
    description:
      'الصق قائمة فصلك، ورتّب القاعة صفوفًا ومقاعد، واحصل على مخطط جلوس قابل للطباعة. سمِّ من يجب ألا يجلسا معًا فيتفادى الأداة ذلك — وتقول لك صراحةً حين تكون القاعة أضيق من أن يتحقق، بدل أن تُجلسهما متجاورين في صمت. ولكل مخطط رمز، فتُجلس إعادةُ الطباعة الطلابَ أنفسهم في المقاعد نفسها. يعمل داخل متصفحك بالكامل.',
  },
}
