import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PaletteIcon } from '../../components/icons'

export const colorPaletteTool: Tool = {
  id: 'color-palette',
  name: 'Palette from Image',
  nameAr: 'لوحة ألوان من صورة',
  tagline: 'Pull the real colours out of a photo or logo.',
  description:
    'Extract the palette from any image — the colours that are actually in it, ranked by how much of the picture each one covers, with hex, RGB and HSL for each. Export as CSS custom properties, a Tailwind colour block or JSON. The same image always gives the same palette, and nothing is uploaded.',
  category: 'Design',
  keywords: ['color palette', 'extract', 'dominant colors', 'image', 'hex', 'css', 'tailwind', 'ألوان', 'لوحة', 'استخراج', 'تصميم', 'صورة'],
  status: 'stable',
  Icon: PaletteIcon,
  component: lazyTool(() => import('./ColorPaletteTool')),
  ar: {
    name: 'استخراج لوحة الألوان من صورة',
    tagline: 'استخرج ألوان صورة أو شعار الحقيقية.',
    description:
      'استخرج لوحة الألوان من أي صورة — الألوان الموجودة فيها فعلًا، مرتّبة بحسب المساحة التي يغطيها كل لون، مع قيم hex وRGB وHSL لكل منها. صدّرها متغيّرات CSS أو كتلة ألوان Tailwind أو JSON. الصورة نفسها تعطي اللوحة نفسها دائمًا، ولا يُرفع شيء.',
  },
}
