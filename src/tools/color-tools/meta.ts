import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PaletteIcon } from '../../components/icons'

export const colorToolsTool: Tool = {
  id: 'color-tools',
  name: 'Color Picker & Palettes',
  nameAr: 'منتقي الألوان واللوحات',
  tagline: 'Pick, convert and build palettes (HEX · RGB · HSL).',
  description:
    'Pick a colour and read it as HEX, RGB and HSL — then generate harmonious palettes (complementary, analogous, triadic) and a shades/tints ramp, copying any swatch with a tap. All in your browser.',
  category: 'Design',
  keywords: ['color', 'colour', 'palette', 'hex', 'rgb', 'hsl', 'picker', 'ألوان', 'لوحة', 'منتقي الألوان'],
  status: 'stable',
  Icon: PaletteIcon,
  component: lazyTool(() => import('./ColorToolsTool')),
  ar: {
    name: 'منتقي الألوان واللوحات',
    tagline: 'اختر الألوان وحوّلها وابنِ لوحات (HEX · RGB · HSL).',
    description:
      'اختر لونًا واقرأه بصيغ HEX وRGB وHSL — ثم ولّد لوحات متناسقة (مكمّلة ومتجانسة وثلاثية) وتدرّجات فاتحة وداكنة، وانسخ أي لون بلمسة. كل ذلك داخل متصفحك.',
  },
}
