import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiffIcon } from '../../components/icons'

export const imageDiffTool: Tool = {
  id: 'image-diff',
  name: 'Compare Images',
  nameAr: 'مقارنة صورتين',
  tagline: 'See exactly which pixels moved.',
  description:
    'Compare two images pixel by pixel and see exactly what changed — differences highlighted, side by side, or under a slider. Two things it refuses to fudge. Images of different sizes are not scaled to fit: only the overlapping region is compared, and the pixels left out are counted and named, because scaling one to match the other reports a difference on every pixel — true and useless. And the tolerance is adjustable and explained: two screenshots of the same page on different machines disagree on thousands of pixels by a level or two, so at zero tolerance every glyph edge lights up and the real change vanishes in the noise. Both images are read on your device and neither is uploaded.',
  category: 'Images',
  keywords: [
    'compare images', 'image diff', 'visual diff', 'pixel diff', 'spot the difference',
    'before and after', 'screenshot comparison', 'regression', 'two images', 'find differences',
    'مقارنة صورتين', 'فرق الصور', 'مقارنة بصرية', 'قبل وبعد', 'اختلاف الصور', 'مقارنة لقطات',
  ],
  status: 'stable',
  Icon: DiffIcon,
  component: lazyTool(() => import('./ImageDiffTool')),
  ar: {
    name: 'مقارنة صورتين',
    tagline: 'شاهد أي البكسلات تغيّرت بالضبط.',
    description:
      'قارن صورتين بكسلًا بكسل وشاهد ما تغيّر بالضبط — بإبراز الفروق أو جنبًا إلى جنب أو تحت شريط. وأمران لا تتساهل فيهما: الصورتان المختلفتان في المقاس لا تُحجَّم إحداهما لتطابق الأخرى، بل تُقارَن المنطقة المشتركة فقط وتُحتسب البكسلات المتروكة وتُذكر، لأن التحجيم يبلّغ عن فرق في كل بكسل وهذا صحيح وعديم الفائدة. والتسامح قابل للضبط ومشروح: لقطتان للصفحة نفسها من جهازين تختلفان في آلاف البكسلات بدرجة أو درجتين، فعند التسامح صفرًا تضيء حواف كل حرف ويختفي التغيير الحقيقي. وتُقرأ الصورتان على جهازك ولا تُرفع أي منهما.',
  },
}
