import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PenIcon } from '../../components/icons'

export const svgEditorTool: Tool = {
  id: 'svg-editor',
  name: 'SVG Editor',
  tagline: 'Edit SVG markup and export it optimised.',
  description:
    'Paste or drop an SVG, see it render live, and copy or download a cleaned-up version. The optimiser (SVGOMG-style, sane defaults) strips editor cruft — comments, metadata, Inkscape/Illustrator namespaces — collapses whitespace and rounds coordinates, so your icons ship lean. Runs entirely in your browser; nothing is uploaded.',
  category: 'Developer',
  keywords: ['svg', 'editor', 'optimize', 'optimise', 'svgo', 'svgomg', 'minify', 'vector', 'icon', 'markup', 'clean', 'سفج', 'تحسين'],
  status: 'beta',
  Icon: PenIcon,
  component: lazyTool(() => import('./SvgEditorTool')),
  ar: {
    name: 'محرّر SVG',
    tagline: 'حرّر كود SVG وصدّره مُحسَّنًا.',
    description:
      'الصق أو أفلت ملف SVG، وشاهده يُعرض مباشرةً، وانسخ أو نزّل نسخة منظّفة. يزيل المُحسِّن (بأسلوب SVGOMG وبإعدادات معقولة) فضلات المحرّرات — التعليقات والبيانات الوصفية ومساحات أسماء Inkscape/Illustrator — ويطوي المسافات ويقرّب الإحداثيات، فتخرج أيقوناتك خفيفة. يعمل بالكامل في متصفحك؛ لا يُرفع أي شيء.',
  },
}
