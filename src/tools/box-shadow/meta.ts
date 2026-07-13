import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShadowIcon } from '../../components/icons'

export const boxShadowTool: Tool = {
  id: 'box-shadow',
  name: 'Box Shadow Generator',
  tagline: 'Dial in a CSS box-shadow with a live preview.',
  description:
    'Adjust offset, blur, spread, colour, opacity and inset to design a CSS box-shadow, see it on a live preview tile, and copy the exact rule. Runs entirely in your browser.',
  category: 'Design',
  keywords: ['box shadow', 'css', 'shadow', 'generator', 'design', 'inset', 'blur', 'ظل', 'تصميم'],
  status: 'stable',
  Icon: ShadowIcon,
  component: lazyTool(() => import('./BoxShadowTool')),
  ar: {
    name: 'مولّد ظل الصندوق',
    tagline: 'اضبط ظل CSS مع معاينة حيّة.',
    description:
      'اضبط الإزاحة والتمويه والانتشار واللون والشفافية والظل الداخلي لتصميم ظل CSS، وشاهده على بلاطة معاينة حيّة، وانسخ القاعدة بدقّة. يعمل بالكامل في متصفحك.',
  },
}
