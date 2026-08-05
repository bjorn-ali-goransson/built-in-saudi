import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { StegoIcon } from '../../components/icons'

export const batchWatermarkTool: Tool = {
  id: 'batch-watermark',
  name: 'Batch Watermark',
  nameAr: 'علامة مائية دفعة واحدة',
  tagline: 'The same mark on every photo, sized to each one.',
  description:
    'Watermark a whole folder of images at once with text or a logo, then download them as a zip. The mark is sized as a share of each image rather than in fixed pixels, so a 4000-pixel photo and an 800-pixel one come back looking the same instead of one carrying a postage stamp and the other a banner. Everything happens on your device.',
  category: 'Images',
  keywords: ['watermark', 'batch', 'bulk', 'logo', 'copyright', 'photos', 'علامة مائية', 'دفعة', 'شعار', 'حقوق', 'صور', 'حماية'],
  status: 'stable',
  Icon: StegoIcon,
  component: lazyTool(() => import('./BatchWatermarkTool')),
  ar: {
    name: 'علامة مائية على دفعة صور',
    tagline: 'العلامة نفسها على كل صورة، بمقاس يناسبها.',
    description:
      'ضع علامة مائية نصية أو شعارًا على مجلد صور كامل دفعة واحدة، ثم نزّلها في ملف مضغوط. ويُحسب حجم العلامة كنسبة من كل صورة لا ببكسلات ثابتة، فتعود صورة بعرض ٤٠٠٠ بكسل وأخرى بـ٨٠٠ متشابهتين بدل أن تحمل إحداهما طابع بريد والأخرى لافتة. كل شيء يجري على جهازك.',
  },
}
