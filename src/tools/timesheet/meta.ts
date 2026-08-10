import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ClockIcon } from '../../components/icons'

export const timesheetTool: Tool = {
  id: 'timesheet',
  name: 'Time Card Calculator',
  nameAr: 'حاسبة ساعات العمل',
  tagline: 'Add up a week of shifts, breaks and overtime.',
  description:
    'Total a week of shifts with breaks, overnight shifts and overtime, and read it both as hours and minutes and as the decimal hours a payroll system asks for — 7:20 is 7.33, not 7.20, which is where hand-totalled sheets go wrong. It knows the Saudi standard day of 8 hours, the 6-hour Ramadan day, and overtime at 150%, all as defaults you can change. Nothing is uploaded.',
  category: 'Time & Date',
  keywords: [
    'timesheet', 'time card', 'timecard', 'hours', 'work hours', 'shift', 'shifts',
    'overtime', 'break', 'payroll', 'clock in', 'clock out', 'night shift', 'ramadan',
    'decimal hours', 'weekly hours',
    'ساعات العمل', 'جدول الدوام', 'دوام', 'وردية', 'ورديات', 'عمل إضافي',
    'إضافي', 'استراحة', 'رواتب', 'رمضان', 'حساب الساعات',
  ],
  status: 'beta',
  Icon: ClockIcon,
  component: lazyTool(() => import('./TimesheetTool')),
  ar: {
    name: 'حاسبة ساعات العمل',
    tagline: 'اجمع أسبوعًا من الورديات والاستراحات والعمل الإضافي.',
    description:
      'اجمع أسبوعًا من الورديات مع الاستراحات والورديات الليلية والعمل الإضافي، واقرأه بالساعات والدقائق وبالساعات العشرية التي يطلبها نظام الرواتب — فـ٧:٢٠ تساوي ٧٫٣٣ لا ٧٫٢٠، وعند هذا التحويل تقع أخطاء الجداول اليدوية. وتعرف الأداة اليوم السعودي المعتاد بثماني ساعات، ويوم رمضان بست، والإضافي بـ١٥٠٪، وكلها قيم افتراضية يمكنك تغييرها. ولا يُرفع شيء.',
  },
}
