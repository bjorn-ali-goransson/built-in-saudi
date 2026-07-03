import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CropIcon } from '../../components/icons'

export const imageCropperTool: Tool = {
  id: 'image-cropper',
  name: 'Image Cropper',
  nameAr: 'أداة قص الصور',
  tagline: 'Drag a crop box — square, 16:9 or free.',
  description:
    'Crop an image right in your browser: drag and resize the crop box, lock it to 1:1 / 4:3 / 16:9 or crop freely, see the exact output pixel size, and download as PNG/JPG/WebP. The crop runs at full resolution and the image is never uploaded.',
  category: 'Images',
  keywords: ['image', 'crop', 'cropper', 'trim', 'aspect ratio', 'square', 'avatar', 'قص الصور', 'اقتصاص', 'صور'],
  status: 'stable',
  Icon: CropIcon,
  component: lazyTool(() => import('./ImageCropperTool')),
  ar: {
    name: 'أداة قص الصور',
    tagline: 'اسحب مربّع القص — مربّع أو 16:9 أو حر.',
    description:
      'اقتصّ الصورة داخل متصفحك: اسحب مربّع القص وغيّر حجمه، أو ثبّته على 1:1 أو 4:3 أو 16:9 أو اقتصّ بحرية، وشاهد أبعاد الناتج بالبكسل، ونزّله بصيغة PNG/JPG/WebP. يجري القص بالدقة الكاملة ولا تُرفع الصورة أبدًا.',
  },
}
