import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ExpandIcon } from '../../components/icons'

export const screenshotFrameTool: Tool = {
  id: 'screenshot-frame',
  name: 'Screenshot Beautifier',
  nameAr: 'تجميل لقطات الشاشة',
  tagline: 'Make a raw screenshot look deliberate.',
  description:
    'Paste or drop a screenshot and it comes back padded, rounded and sitting on a backdrop instead of floating on white — ready for a slide, a post or a README. Pick the shape (square, 16:9, story), the corner radius and the shadow, then export at up to 3× for a crisp result. Nothing is uploaded.',
  category: 'Images',
  keywords: ['screenshot', 'beautify', 'frame', 'mockup', 'padding', 'background', 'لقطة شاشة', 'تجميل', 'إطار', 'خلفية', 'تصميم'],
  status: 'stable',
  Icon: ExpandIcon,
  component: lazyTool(() => import('./ScreenshotFrameTool')),
  ar: {
    name: 'تجميل لقطات الشاشة',
    tagline: 'اجعل لقطة الشاشة تبدو مقصودة.',
    description:
      'الصق لقطة شاشة أو ألقِها لتعود بهوامش وحواف دائرية وخلفية بدل أن تطفو على بياض — جاهزة لشريحة أو منشور أو ملف README. اختر الشكل (مربع، ١٦:٩، ستوري) ونصف قطر الحواف والظل، ثم صدّر بدقة تصل إلى ٣ أضعاف. لا يُرفع شيء.',
  },
}
