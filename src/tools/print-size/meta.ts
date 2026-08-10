import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RulerIcon } from '../../components/icons'

export const printSizeTool: Tool = {
  id: 'print-size',
  name: 'Photo Print Size',
  tagline: 'How big it can be printed before the pixels show.',
  description:
    'Work out how large a photo can be printed at A4, A3 or any size before the pixel grid becomes visible — read from the picture itself rather than a number you have to look up, and worked out for the distance you will actually view it from. Runs entirely in your browser.',
  category: 'Images',
  keywords: [
    'print size', 'dpi', 'ppi', 'resolution', 'print resolution', 'photo print',
    'how big can i print', 'poster size', 'a4', 'a3', 'megapixels',
    'pixels per inch', '300 dpi', 'print quality', 'viewing distance',
    'مقاس الطباعة', 'دقة الطباعة', 'طباعة صورة', 'دقة الصورة للطباعة', 'حجم الطباعة',
  ],
  status: 'stable',
  Icon: RulerIcon,
  component: lazyTool(() => import('./PrintSizeTool')),
  ar: {
    name: 'مقاس الطباعة',
    tagline: 'إلى أي مقاس تُطبع قبل أن تظهر البكسلات.',
    description:
      'اعرف إلى أي مقاس يمكن طباعة صورة على A4 أو A3 أو أي مقاس قبل أن تظهر شبكة البكسلات — محسوبًا من الصورة نفسها لا من رقم تبحث عنه، وللمسافة التي ستنظر منها فعلًا. يعمل بالكامل داخل متصفحك.',
  },
}
