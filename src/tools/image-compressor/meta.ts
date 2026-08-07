import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ImageIcon } from '../../components/icons'

export const imageCompressorTool: Tool = {
  id: 'image-compressor',
  name: 'Image Compressor',
  nameAr: 'ضاغط الصور',
  tagline: 'Shrink JPG/PNG/WebP — entirely on your device.',
  description:
    'Compress and resize images right in your browser — pick JPEG/WebP/PNG, a quality level and an optional max width, and see the before→after size and how much you saved. Unlike the ad-driven sites, the image is never uploaded — it never leaves your device.',
  category: 'Images',
  keywords: ['image', 'photo', 'picture', 'compress', 'compressor', 'resize', 'shrink', 'smaller', 'reduce', 'jpeg', 'webp', 'optimize', 'ضغط', 'صورة', 'ضغط الصور', 'تصغير', 'صور'],
  status: 'stable',
  Icon: ImageIcon,
  component: lazyTool(() => import('./ImageCompressorTool')),
  ar: {
    name: 'ضاغط الصور',
    tagline: 'صغّر JPG/PNG/WebP — على جهازك بالكامل.',
    description:
      'اضغط الصور وغيّر حجمها داخل متصفحك — اختر JPEG/WebP/PNG ومستوى الجودة وأقصى عرض اختياريًا، وشاهد الحجم قبل وبعد ونسبة التوفير. بخلاف المواقع المليئة بالإعلانات، لا تُرفع الصورة — لا تغادر جهازك.',
  },
}
