import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const timetableTool: Tool = {
  id: 'timetable',
  name: 'Weekly Timetable',
  tagline: 'A class or work timetable that starts on Sunday and reads right-to-left.',
  description:
    'Fill in a weekly timetable and print it. The week starts on Sunday, because Friday and Saturday are the weekend here and a Monday-first grid breaks the school week across the middle of the sheet — and in Arabic the columns reverse, not just the day names, so Sunday sits where the reader starts. Everything stays in your browser.',
  category: 'Generators',
  keywords: [
    'timetable', 'schedule', 'class schedule', 'school timetable', 'weekly planner',
    'lesson plan', 'periods', 'printable', 'teacher', 'university', 'study plan',
    'جدول', 'جدول أسبوعي', 'جدول دراسي', 'جدول الحصص', 'جدول المواد', 'حصص',
    'خطة أسبوعية', 'جدول الدوام', 'طباعة جدول',
  ],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./TimetableTool')),
  ar: {
    name: 'الجدول الأسبوعي',
    tagline: 'جدول حصص أو دوام يبدأ بالأحد ويُقرأ من اليمين.',
    description:
      'املأ جدولك الأسبوعي واطبعه. يبدأ الأسبوع بالأحد لأن الجمعة والسبت عطلة هنا، والجدول الذي يبدأ بالاثنين يقطع الأسبوع الدراسي في وسط الورقة — وفي العربية تنعكس الأعمدة لا أسماء الأيام وحدها، فيقع الأحد حيث يبدأ القارئ. ويبقى كل شيء داخل متصفحك.',
  },
}
