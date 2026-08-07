import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ListIcon } from '../../components/icons'

export const pptxToTextTool: Tool = {
  id: 'pptx-to-text',
  name: 'PowerPoint to Text',
  nameAr: 'بوربوينت إلى نص',
  tagline: 'Every slide, in order, plus the notes.',
  description:
    'Pull the words out of a .pptx — every slide in the right order, with the speaker notes if you want them. Useful when you have the deck but not PowerPoint, or when what you need is the text itself: to quote it, translate it, or search it. Slides are ordered by their real number rather than by filename, so slide 10 does not land between 1 and 2. The file is read in your browser and never uploaded.',
  category: 'Text',
  keywords: [
    'pptx', 'powerpoint', 'slides', 'deck', 'presentation', 'to text', 'speaker notes', 'extract', 'convert', 'open pptx', 'read slides',
    'بوربوينت', 'شرائح', 'عرض تقديمي', 'نص', 'استخراج', 'ملاحظات', 'تحويل', 'فتح',
  ],
  status: 'stable',
  Icon: ListIcon,
  component: lazyTool(() => import('./PptxToTextTool')),
  ar: {
    name: 'بوربوينت إلى نص',
    tagline: 'كل شريحة بترتيبها، ومعها الملاحظات.',
    description:
      'استخرج كلمات ملف ‎.pptx‎ — كل شريحة بترتيبها الصحيح، ومعها ملاحظات المُقدِّم إن أردتها. مفيد حين يكون لديك العرض دون بوربوينت، أو حين يكون ما تحتاجه هو النص نفسه: لتقتبسه أو تترجمه أو تبحث فيه. وتُرتَّب الشرائح برقمها الحقيقي لا باسم الملف، فلا تقع الشريحة العاشرة بين الأولى والثانية. ويُقرأ الملف في متصفحك ولا يُرفع أبدًا.',
  },
}
