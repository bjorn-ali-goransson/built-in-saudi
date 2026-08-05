import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { GridIcon } from '../../components/icons'

export const paperGeneratorTool: Tool = {
  id: 'paper-generator',
  name: 'Printable Paper',
  nameAr: 'ورق للطباعة',
  tagline: 'Graph, dot grid, ruled, isometric — as a PDF.',
  description:
    'Make your own paper and print it: graph paper, dot grid, ruled lines, isometric, Cornell notes, music staves, and a four-line Arabic handwriting guide. Set the spacing in millimetres, the margin, the ink colour and how many pages. It downloads as a PDF rather than an image, so the spacing you asked for is the spacing that prints.',
  category: 'Generators',
  keywords: ['graph paper', 'dot grid', 'printable', 'ruled', 'isometric', 'cornell', 'handwriting', 'ورق مربعات', 'ورق نقاط', 'مسطر', 'طباعة', 'خط عربي', 'كراسة'],
  status: 'stable',
  Icon: GridIcon,
  component: lazyTool(() => import('./PaperGeneratorTool')),
  ar: {
    name: 'مولّد الورق للطباعة',
    tagline: 'مربعات ونقاط ومسطّر ومتساوي القياس — بصيغة PDF.',
    description:
      'اصنع ورقك واطبعه: ورق مربعات، ونقاط، ومسطّر، ومتساوي القياس، وملاحظات كورنيل، ومدرّج موسيقي، ومسطّر رباعي لتدريب الخط العربي. حدّد التباعد بالمليمتر والهامش ولون الحبر وعدد الصفحات. يُنزَّل بصيغة PDF لا صورة، فالتباعد الذي طلبته هو ما يُطبع فعلًا.',
  },
}
