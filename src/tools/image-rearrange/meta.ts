import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CropIcon } from '../../components/icons'

export const imageRearrangeTool: Tool = {
  id: 'image-rearrange',
  name: 'Rearrange Image',
  nameAr: 'إعادة ترتيب الصورة',
  tagline: 'Cut pieces out of a screenshot and move or rotate them.',
  description:
    'Open a screenshot or photo, drag out the parts you want to move, then slide and rotate those pieces anywhere on the image — useful for tidying a screenshot, covering something up, or rearranging a layout before you send it. Everything happens in your browser: the picture is never uploaded, and you can save the result or share it straight from your device.',
  category: 'Images',
  keywords: ['rearrange', 'move', 'rotate', 'screenshot', 'cut', 'crop', 'collage', 'edit image', 'قص', 'تحريك', 'تدوير', 'لقطة شاشة', 'ترتيب'],
  status: 'beta',
  Icon: CropIcon,
  component: lazyTool(() => import('./ImageRearrangeTool')),
  ar: {
    name: 'إعادة ترتيب الصورة',
    tagline: 'اقتطع أجزاءً من لقطة الشاشة وحرّكها أو أدِرها.',
    description:
      'افتح لقطة شاشة أو صورة، واسحب لتحديد الأجزاء التي تريد تحريكها، ثم انقلها وأدِرها في أي مكان على الصورة — مفيد لترتيب لقطة شاشة أو تغطية شيء أو إعادة ترتيب تصميم قبل إرساله. كل شيء يجري في متصفحك: لا تُرفع الصورة أبدًا، ويمكنك حفظ النتيجة أو مشاركتها مباشرة من جهازك.',
  },
}
