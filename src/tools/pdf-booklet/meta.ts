import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MergeIcon } from '../../components/icons'

export const pdfBookletTool: Tool = {
  id: 'pdf-booklet',
  name: 'Booklet & N-up',
  nameAr: 'كتيّب وتوفير ورق',
  tagline: 'Reorder pages so a printed stack folds into a booklet.',
  description:
    'Impose a PDF for printing: booklet order so a folded, stapled stack reads correctly, or two and four pages to a sheet to save paper. A booklet is not pages 1,2,3,4 on sheets — the outermost sheet carries the last page beside the first and the sequence walks inwards, which is why printing 2-up and folding gives you a scrambled mess. Right-to-left binding for Arabic documents.',
  category: 'PDF',
  keywords: ['بي دي اف', 'booklet', 'imposition', 'n-up', '2-up', 'print', 'fold', 'saddle stitch', 'pdf', 'كتيب', 'طباعة', 'ترتيب الصفحات', 'توفير ورق', 'طي'],
  status: 'stable',
  Icon: MergeIcon,
  component: lazyTool(() => import('./PdfBookletTool')),
  ar: {
    name: 'ترتيب الكتيّب وتوفير الورق',
    tagline: 'أعد ترتيب الصفحات ليُطوى المطبوع إلى كتيّب.',
    description:
      'رتّب ملف PDF للطباعة: ترتيب كتيّب ليُقرأ بشكل صحيح بعد الطي والتدبيس، أو صفحتين وأربع صفحات في الورقة لتوفير الورق. فالكتيّب ليس صفحات ١ و٢ و٣ و٤ على الأوراق — إذ تحمل الورقة الخارجية الصفحة الأخيرة بجوار الأولى ويسير التسلسل نحو الداخل، ولهذا تعطيك طباعة صفحتين في ورقة ثم الطي فوضى مبعثرة. مع تجليد من اليمين للمستندات العربية.',
  },
}
