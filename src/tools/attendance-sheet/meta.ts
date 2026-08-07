import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { TableIcon } from '../../components/icons'

export const attendanceSheetTool: Tool = {
  id: 'attendance-sheet',
  name: 'Attendance Sheet',
  nameAr: 'كشف الحضور',
  tagline: 'A printable register that knows the school week.',
  description:
    'Paste a class list and print a register: columns for school days, numbered sessions, or your own headings like Quiz 1 and Final. Weekend days are skipped, defaulted to Friday and Saturday — a sheet built on a Saturday-Sunday weekend prints two columns nobody ticks and misses two teaching days. Optional Hijri dates and a total column. Runs entirely in your browser.',
  category: 'Generators',
  keywords: [
    'attendance', 'register', 'mark sheet', 'grades', 'classroom', 'teacher', 'school', 'printable', 'roll call', 'class list',
    'حضور', 'كشف', 'درجات', 'رصد', 'فصل', 'معلم', 'مدرسة', 'طباعة', 'قائمة',
  ],
  status: 'stable',
  Icon: TableIcon,
  component: lazyTool(() => import('./AttendanceSheetTool')),
  ar: {
    name: 'كشف الحضور',
    tagline: 'سجل حضور للطباعة يعرف الأسبوع الدراسي.',
    description:
      'الصق قائمة فصلك واطبع سجلًا: أعمدة لأيام الدراسة، أو حصصًا مرقّمة، أو عناوين من عندك مثل «اختبار ١» و«النهائي». وتُتخطّى أيام العطلة، والافتراضي الجمعة والسبت — فالورقة المبنية على عطلة السبت والأحد تطبع عمودين لا يعلّم فيهما أحد وتسقط يومَي تدريس. مع تواريخ هجرية اختيارية وعمود للمجموع. تعمل داخل متصفحك بالكامل.',
  },
}
