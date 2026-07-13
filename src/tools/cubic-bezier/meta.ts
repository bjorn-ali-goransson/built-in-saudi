import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CurveIcon } from '../../components/icons'

export const cubicBezierTool: Tool = {
  id: 'cubic-bezier',
  name: 'Cubic Bezier Editor',
  tagline: 'Craft CSS easing curves and preview them.',
  description:
    'Drag the two control points to shape a CSS cubic-bezier easing curve, watch a live animation play it back, start from presets like ease-in-out, and copy the ready-to-paste value. Runs entirely in your browser.',
  category: 'Design',
  keywords: ['cubic bezier', 'easing', 'css', 'animation', 'transition', 'timing function', 'curve', 'منحنى', 'حركة', 'تنعيم'],
  status: 'stable',
  Icon: CurveIcon,
  component: lazyTool(() => import('./CubicBezierTool')),
  ar: {
    name: 'محرّر منحنى بيزييه',
    tagline: 'صمّم منحنيات تنعيم CSS وعاينها.',
    description:
      'اسحب نقطتي التحكّم لتشكيل منحنى تنعيم CSS من نوع cubic-bezier، وشاهد حركة حيّة تعيده، وابدأ من قوالب مثل ease-in-out، وانسخ القيمة الجاهزة للّصق. يعمل بالكامل في متصفحك.',
  },
}
