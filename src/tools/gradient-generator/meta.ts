import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GradientIcon } from '../../components/icons'

export const gradientGeneratorTool: Tool = {
  id: 'gradient-generator',
  name: 'CSS Gradient Generator',
  tagline: 'Build linear and radial CSS gradients.',
  description:
    'Design a CSS gradient from multiple colour stops — linear at any angle or radial — see it fill a live preview, and copy the exact background rule. Add, move and recolour stops freely. Runs entirely in your browser.',
  category: 'Design',
  keywords: ['gradient', 'css', 'linear', 'radial', 'background', 'color stops', 'design', 'تدرج', 'ألوان', 'تصميم'],
  status: 'stable',
  Icon: GradientIcon,
  component: lazyTool(() => import('./GradientGeneratorTool')),
  ar: {
    name: 'مولّد تدرّجات CSS',
    tagline: 'أنشئ تدرّجات CSS خطّية وشعاعية.',
    description:
      'صمّم تدرّج CSS من عدّة محطّات ألوان — خطّي بأي زاوية أو شعاعي — وشاهده يملأ معاينة حيّة، وانسخ قاعدة الخلفية بدقّة. أضف المحطّات وحرّكها وأعد تلوينها بحرّية. يعمل بالكامل في متصفحك.',
  },
}
