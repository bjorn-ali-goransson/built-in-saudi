import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ActivityBoardIcon } from '../../components/icons'

// Named so it does NOT reach for what `timetable` already owns. That tool is
// "Weekly Timetable" / «الجدول الأسبوعي» and a bare `جدول أسبوعي` must keep
// going to it — so neither the name nor the keywords here carry that phrase,
// and the two link to each other instead. What this one owns is the ACTIVITY:
// an icon per entry, a picture a child who cannot read yet can follow, and a
// sheet that is shared rather than re-typed.
export const activityScheduleTool: Tool = {
  id: 'activity-schedule',
  name: 'Activity Schedule',
  nameAr: 'جدول الأنشطة',
  tagline: 'An illustrated routine sheet — an icon on every activity, and a link that carries the whole thing.',
  description:
    'Build a routine or activity schedule with an icon beside every entry, keep as many as you like in your browser, and share a whole sheet as one link — the schedule travels inside the link, so nothing is stored on any server. It remembers the icon you chose for an activity and offers back every name you have used before, across all your sheets, and it checks that the times in a row actually agree with each other. Prints as a PDF with a QR code that reopens the same sheet for editing.',
  category: 'Generators',
  keywords: [
    // NOT 'classroom schedule': it contains `timetable`'s exact indexed phrase
    // `class schedule`, and took the query off it at 339 to 289. The established
    // tool keeps the phrase — the rule this repo has applied seven times.
    'activity schedule', 'routine', 'daily routine', 'visual schedule', 'routine chart',
    'kids schedule', 'nursery', 'kindergarten', 'preschool',
    'day plan', 'planner', 'chart', 'icons', 'emoji schedule', 'wall chart',
    'share schedule', 'schedule link', 'qr schedule', 'printable schedule',
    'جدول الأنشطة', 'أنشطة', 'جدول يومي', 'روتين', 'روتين يومي', 'جدول الروضة',
    'روضة', 'حضانة', 'رياض أطفال', 'جدول الأطفال', 'جدول مصور', 'أيقونات',
    'خطة اليوم', 'جدول ملون', 'مشاركة جدول', 'طباعة جدول', 'رمز استجابة',
  ],
  status: 'stable',
  Icon: ActivityBoardIcon,
  component: lazyTool(() => import('./ActivityScheduleTool')),
  ar: {
    name: 'جدول الأنشطة',
    tagline: 'ورقة روتين مزخرفة — أيقونة لكل نشاط، ورابط يحمل الجدول كله.',
    description:
      'ابنِ جدول روتين أو أنشطة بأيقونة إلى جانب كل خانة، واحفظ ما شئت من الجداول داخل متصفحك، وشارك ورقة كاملة برابط واحد — فالجدول يسافر داخل الرابط ولا يُخزَّن على أي خادم. تتذكّر الأداة الأيقونة التي اخترتها لكل نشاط، وتعرض عليك كل اسم استعملته من قبل في جميع أوراقك، وتتحقّق من أن أوقات الصف الواحد متوافقة فعلًا. وتُطبع ملف PDF يحمل رمز استجابة يفتح الورقة نفسها للتحرير.',
  },
}
