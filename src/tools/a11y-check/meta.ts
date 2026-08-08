import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShieldIcon } from '../../components/icons'

export const a11yCheckTool: Tool = {
  id: 'a11y-check',
  name: 'Accessibility Checker',
  nameAr: 'فاحص إتاحة الوصول',
  tagline: 'Paste HTML, see what a screen reader cannot.',
  description:
    'Paste markup and get the accessibility problems that are decidable from the HTML alone: images with no alt attribute (and alt text that is really just the file name), headings that skip a level, links that say only "click here", form fields with no label, buttons with no accessible name, duplicate ids, and positive tabindex. Everything runs in your browser — which is also why it reads what you paste rather than fetching a URL, since fetching someone else’s page needs a server. It is explicit about the half it cannot judge: whether alt text is meaningful, whether a keyboard user can finish a form, whether a modal traps focus. A clean result is a floor, not a pass.',
  category: 'Web',
  keywords: [
    // 'wcag' leads. The contrast checker lists it second and was winning a
    // bare "wcag" on keyword position alone — but it covers ONE success
    // criterion, and the standard as a whole is this tool. Same editorial
    // judgement as sha256 leading the hash generator over HMAC.
    'wcag', 'accessibility', 'a11y', 'screen reader', 'alt text', 'missing alt', 'heading order',
    'aria', 'form label', 'accessible name', 'tabindex', 'duplicate id', 'html check', 'audit',
    'إتاحة الوصول', 'إمكانية الوصول', 'قارئ الشاشة', 'نص بديل', 'ترتيب العناوين', 'تسمية الحقول',
    'فحص html', 'معايير الوصول',
  ],
  status: 'stable',
  Icon: ShieldIcon,
  component: lazyTool(() => import('./A11yCheckTool')),
  ar: {
    name: 'فاحص إتاحة الوصول',
    tagline: 'الصق HTML وشاهد ما لا يراه قارئ الشاشة.',
    description:
      'الصق الوسم واحصل على مشكلات إتاحة الوصول التي يمكن الحكم عليها من HTML وحده: صور بلا نص بديل (ونص بديل ليس إلا اسم الملف)، وعناوين تقفز مستوى، وروابط لا تقول إلا «اضغط هنا»، وحقول بلا تسمية، وأزرار بلا اسم يُنطق، ومعرّفات مكررة، وtabindex موجب. وكل شيء يجري في متصفحك — ولهذا يقرأ ما تلصقه بدل جلب رابط، فجلب صفحة غيرك يحتاج خادمًا. وهي صريحة في النصف الذي لا تستطيع الحكم عليه: أذو معنى هو النص البديل، وهل يستطيع مستخدم لوحة المفاتيح إكمال النموذج، وهل تحبس النافذة المنبثقة التركيز. والنتيجة النظيفة حدٌّ أدنى لا شهادة.',
  },
}
