import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PenIcon } from '../../components/icons'

export const svgEditorTool: Tool = {
  id: 'svg-editor',
  name: 'SVG Editor',
  tagline: 'Draw and edit vector graphics, then export clean SVG.',
  description:
    'A lightweight vector editor: draw rectangles, ellipses, lines, freehand paths and text on a canvas, then select, move, resize and restyle them — with layers, undo/redo and pan/zoom. Import an existing SVG to keep editing it, flip to the live code view any time, and export an optimised (SVGOMG-style) file that strips editor cruft and rounds coordinates. Runs entirely in your browser; nothing is uploaded.',
  category: 'Developer',
  keywords: ['svg', 'editor', 'vector', 'draw', 'inkscape', 'illustrator', 'shapes', 'optimize', 'optimise', 'svgo', 'svgomg', 'minify', 'icon', 'markup', 'سفج', 'رسم', 'محرر'],
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
