import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { BinaryIcon } from '../../components/icons'

export const imageBase64Tool: Tool = {
  id: 'image-base64',
  name: 'Image to Base64',
  tagline: 'A data URI you can paste into CSS, HTML or Markdown — and back.',
  description:
    'Turn an image into a data URI ready for CSS, HTML or Markdown, and paste one back to get the image. It takes the smaller path for SVG, transcodes an iPhone HEIC that no browser could otherwise show, and tells you what embedding actually costs. Runs entirely in your browser.',
  category: 'Converters',
  keywords: [
    'base64', 'image to base64', 'base64 to image', 'data uri', 'data url',
    'embed image', 'inline image', 'css background', 'encode image', 'decode base64',
    'svg data uri', 'png to base64', 'jpg to base64',
    'صورة إلى base64', 'ترميز الصور', 'تضمين صورة', 'صورة داخل CSS',
  ],
  status: 'stable',
  Icon: BinaryIcon,
  component: lazyTool(() => import('./ImageBase64Tool')),
  ar: {
    name: 'صورة إلى Base64',
    tagline: 'data URI تلصقه في CSS أو HTML أو ماركداون — وبالعكس.',
    description:
      'حوّل صورة إلى data URI جاهز لـCSS أو HTML أو ماركداون، وألصق واحدًا لاسترجاع الصورة. يسلك المسار الأصغر مع SVG، ويحوّل صور HEIC من الآيفون التي لا يعرضها متصفح آخر، ويخبرك بكلفة التضمين الحقيقية. يعمل بالكامل داخل متصفحك.',
  },
}
