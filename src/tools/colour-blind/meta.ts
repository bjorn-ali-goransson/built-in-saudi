import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ContrastIcon } from '../../components/icons'

export const colourBlindTool: Tool = {
  id: 'colour-blind',
  name: 'Colour Blindness Simulator',
  nameAr: 'محاكي عمى الألوان',
  tagline: 'Which of your colours stop being different.',
  description:
    'See a palette or an image as someone with colour vision deficiency sees it — and, more usefully, which pairs of your colours collapse into the same thing. Around one man in twelve has some form of it, so a chart or a status badge that relies on red-versus-green is unreadable to a real share of your users. Simulated with the Machado matrices in linear light, not by dropping a channel.',
  category: 'Design',
  keywords: ['colour blind', 'color blind', 'deuteranopia', 'protanopia', 'accessibility', 'a11y', 'palette', 'عمى الألوان', 'إتاحة', 'ألوان', 'تباين', 'تصميم'],
  status: 'stable',
  Icon: ContrastIcon,
  component: lazyTool(() => import('./ColourBlindTool')),
  ar: {
    name: 'محاكي عمى الألوان',
    tagline: 'أي ألوانك يفقد تمايزه.',
    description:
      'شاهد لوحة ألوان أو صورة كما يراها من لديه قصور في رؤية الألوان — والأهم، أي أزواج ألوانك تنهار إلى الشيء نفسه. فنحو رجل من كل اثني عشر لديه شكل من أشكاله، ما يعني أن رسمًا بيانيًا أو شارة حالة تعتمد على الأحمر مقابل الأخضر غير مقروءة لشريحة حقيقية من مستخدميك. المحاكاة بمصفوفات ماتشادو في الضوء الخطي، لا بإسقاط قناة لونية.',
  },
}
