import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SlidesIcon } from '../../components/icons'

export const powerpointEditorTool: Tool = {
  id: 'powerpoint-editor',
  name: 'Presentation Editor',
  nameAr: 'محرر العروض',
  tagline: 'Open, edit and present PowerPoint decks in your browser — layouts, themes, notes and live co-editing.',
  description:
    'A presentation editor that runs entirely in your browser. Open .pptx files or a Markdown outline, build slides with layouts, themes, shapes, pictures and tables, write speaker notes, and present full screen with a presenter view and a second audience window. Arabic slides read right to left. Save back to the same file or download as PowerPoint or an outline. Decks are kept in this browser, never uploaded, and you can invite others to edit live, browser to browser, with you as the owner whose copy is the truth.',
  category: 'Office',
  keywords: ['powerpoint', 'slides', 'presentation', 'pptx', 'powerpoint editor', 'edit powerpoint online', 'open pptx', 'presentation maker', 'slide deck', 'pitch deck', 'make a presentation', 'presenter view', 'باوربوينت', 'بوربوينت', 'عرض تقديمي', 'عروض تقديمية', 'شرائح', 'تعديل ملف باوربوينت', 'فتح ملف pptx', 'إنشاء عرض تقديمي'],
  status: 'beta',
  Icon: SlidesIcon,
  component: lazyTool(() => import('./PowerPointEditorTool')),
  ar: {
    name: 'محرر العروض',
    tagline: 'افتح عروض باوربوينت وعدّلها واعرضها في متصفحك — تخطيطات وسمات وملاحظات وتحرير مشترك مباشر.',
    description:
      'محرر عروض تقديمية يعمل بالكامل في متصفحك. افتح ملفات ‎.pptx أو مخططًا بصيغة Markdown، وأنشئ شرائح بتخطيطات وسمات وأشكال وصور وجداول، واكتب ملاحظات المتحدث، واعرض بملء الشاشة مع عرض المقدم ونافذة ثانية للجمهور. الشرائح العربية تُقرأ من اليمين إلى اليسار. احفظ في الملف نفسه أو نزّله بصيغة باوربوينت أو مخطط نصي. تبقى العروض في هذا المتصفح ولا تُرفع، ويمكنك دعوة آخرين للتحرير مباشرة من متصفح إلى متصفح، وأنت المالك الذي نسخته هي المرجع.',
  },
}
