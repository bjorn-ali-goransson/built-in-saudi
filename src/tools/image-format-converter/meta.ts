import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RefreshIcon } from '../../components/icons'

export const imageFormatConverterTool: Tool = {
  id: 'image-format-converter',
  name: 'Image Converter',
  nameAr: 'محوّل صيغ الصور',
  tagline: 'PNG ↔ JPG ↔ WebP — on your device.',
  description:
    'Convert images between PNG, JPG and WebP entirely in your browser — with a quality control for the lossy formats and a background colour when flattening a transparent PNG to JPG. The image is never uploaded, unlike the ad-heavy "PNG to JPG" sites.',
  category: 'Images',
  // HEIC leads. The site decodes it everywhere an image is taken (libheif, see
  // CLAUDE.md #226) and NO tool indexed the word — so "heic", the thing an
  // iPhone owner on Android actually types, returned no tool at all. A shipped
  // capability nobody can name is not a shipped capability.
  keywords: [
    'heic', 'heic to jpg', 'webp to jpg', 'png to jpg', 'jpg to png',
    'heif', 'iphone photo', 'jpg', 'png', 'webp', 'jpeg', 'image', 'convert', 'converter', 'format',
    'هيك', 'صور آيفون', 'تحويل الصور', 'صيغة', 'صور',
  ],
  status: 'stable',
  Icon: RefreshIcon,
  component: lazyTool(() => import('./ImageFormatConverterTool')),
  ar: {
    name: 'محوّل صيغ الصور',
    tagline: 'PNG ↔ JPG ↔ WebP — على جهازك.',
    description:
      'حوّل الصور بين PNG وJPG وWebP داخل متصفحك بالكامل — مع تحكّم في الجودة للصيغ ذات الفقد، ولون خلفية عند تسطيح PNG الشفاف إلى JPG. لا تُرفع الصورة أبدًا، بخلاف مواقع «PNG إلى JPG» المليئة بالإعلانات.',
  },
}
