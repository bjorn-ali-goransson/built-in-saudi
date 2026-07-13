import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { AspectIcon } from '../../components/icons'

export const aspectRatioTool: Tool = {
  id: 'aspect-ratio',
  name: 'Aspect Ratio Calculator',
  tagline: 'Resize keeping the same proportions.',
  description:
    'Lock an aspect ratio and solve for the missing dimension: enter a width to get the matching height (or vice-versa), pick common presets like 16:9 or 4:3, and read the simplified ratio. Perfect for images, video and layout. Runs entirely in your browser.',
  category: 'Design',
  keywords: ['aspect ratio', 'resize', 'dimensions', 'width', 'height', '16:9', 'proportion', 'نسبة الأبعاد', 'تحجيم'],
  status: 'stable',
  Icon: AspectIcon,
  component: lazyTool(() => import('./AspectRatioTool')),
  ar: {
    name: 'حاسبة نسبة الأبعاد',
    tagline: 'غيّر الحجم مع الحفاظ على النسب.',
    description:
      'ثبّت نسبة الأبعاد واحسب البُعد الناقص: أدخل العرض لتحصل على الارتفاع المطابق أو العكس، اختر قوالب شائعة مثل 16:9 أو 4:3، واقرأ النسبة المبسّطة. مثالي للصور والفيديو والتخطيط. تعمل بالكامل في متصفحك.',
  },
}
