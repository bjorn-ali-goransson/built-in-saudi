import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CropIcon } from '../../components/icons'

export const imageRearrangeTool: Tool = {
  id: 'image-rearrange',
  name: 'Rearrange Image',
  nameAr: 'إعادة ترتيب الصورة',
  tagline: 'Cut pieces out of a screenshot, drop in other images, and move or turn them.',
  description:
    'Open a screenshot or photo, drag out the parts you want to move, then slide, turn and resize those pieces anywhere on the image. You can also drop in another picture — a logo, a photo, a second screenshot — and place it wherever you like, so two images become one. Useful for tidying a screenshot, covering something up, or rearranging a layout before you send it. Everything happens in your browser: nothing is ever uploaded, and you can save the result or share it straight from your device.',
  category: 'Images',
  keywords: ['rearrange', 'move', 'rotate', 'screenshot', 'cut', 'crop', 'collage', 'edit image',
    'put one image on another', 'place an image on a photo',
    'قص', 'تحريك', 'تدوير', 'لقطة شاشة', 'ترتيب', 'ضع صورة فوق صورة'],
  status: 'beta',
  Icon: CropIcon,
  component: lazyTool(() => import('./ImageRearrangeTool')),
  ar: {
    name: 'إعادة ترتيب الصورة',
    tagline: 'اقتطع أجزاءً من لقطة الشاشة وأضِف صورًا أخرى، ثم حرّكها أو أدِرها.',
    description:
      'افتح لقطة شاشة أو صورة، واسحب لتحديد الأجزاء التي تريد تحريكها، ثم انقلها وأدِرها وغيّر حجمها في أي مكان على الصورة. ويمكنك أيضًا إضافة صورة أخرى — شعار أو صورة أو لقطة ثانية — ووضعها حيث تشاء، فتصير الصورتان واحدة. مفيد لترتيب لقطة شاشة أو تغطية شيء أو إعادة ترتيب تصميم قبل إرساله. كل شيء يجري في متصفحك: لا يُرفع أي شيء أبدًا، ويمكنك حفظ النتيجة أو مشاركتها مباشرة من جهازك.',
  },
}
