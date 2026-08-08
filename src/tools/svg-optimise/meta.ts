import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CodeIcon } from '../../components/icons'

export const svgOptimiseTool: Tool = {
  id: 'svg-optimise',
  name: 'SVG Optimiser',
  nameAr: 'محسّن ملفات SVG',
  tagline: 'Strip the editor cruft without breaking the artwork.',
  description:
    'Shrink an SVG by removing Inkscape, Illustrator and Figma metadata, rounding coordinates, and squeezing out whitespace — then shows you the result rendered, so you can see nothing broke. Deliberately conservative: it will not merge paths, convert shapes or strip referenced ids, because those win more bytes and break real files silently.',
  category: 'Design',
  keywords: [
    // Both spellings. This site writes British English in its own copy while
    // a keyword list, written by a developer, tends to the American form —
    // measured: 8 of 12 -ise/-ize variants missed, 5 returning nothing at all.
    'optimizer','svg', 'optimise', 'optimize', 'minify', 'svgo', 'compress', 'icon', 'تحسين', 'تصغير', 'أيقونة', 'رسومات', 'ضغط'],
  status: 'stable',
  Icon: CodeIcon,
  component: lazyTool(() => import('./SvgOptimiseTool')),
  ar: {
    name: 'محسّن ملفات SVG',
    tagline: 'أزل بقايا برامج التحرير دون إفساد الرسم.',
    description:
      'صغّر ملف SVG بإزالة بيانات إنكسكيب وإليستريتور وفيغما، وتقريب الإحداثيات، وعصر المسافات — ثم يعرض لك الناتج مرسومًا لترى أن شيئًا لم ينكسر. متحفّظ عن قصد: لا يدمج المسارات ولا يحوّل الأشكال ولا يحذف معرّفًا مُشارًا إليه، فتلك تكسب بايتات أكثر وتُفسد ملفات حقيقية بصمت.',
  },
}
