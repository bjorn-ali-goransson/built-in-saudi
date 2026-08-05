import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ClockIcon } from '../../components/icons'

export const cronBuilderTool: Tool = {
  id: 'cron-builder',
  name: 'Cron Builder',
  nameAr: 'مولّد تعبير الكرون',
  tagline: 'Pick a schedule, get the cron expression.',
  description:
    'Build a cron expression without remembering the field order — choose daily, weekly, monthly or every few minutes, and it writes the five fields for you. It then lists the next five times the schedule would actually fire, which is the only way to be sure you wrote what you meant. It also warns about the day-of-month and day-of-week trap, where cron fires when either matches rather than both.',
  category: 'Developer',
  keywords: ['cron', 'crontab', 'schedule', 'builder', 'generator', 'كرون', 'جدولة', 'مهام مجدولة', 'تعبير'],
  status: 'stable',
  Icon: ClockIcon,
  component: lazyTool(() => import('./CronBuilderTool')),
  ar: {
    name: 'مولّد تعبير الكرون',
    tagline: 'اختر جدولًا، واحصل على تعبير الكرون.',
    description:
      'ابنِ تعبير كرون دون أن تحفظ ترتيب الحقول — اختر يوميًا أو أسبوعيًا أو شهريًا أو كل بضع دقائق، وستكتب الأداة الحقول الخمسة نيابةً عنك. ثم تعرض المواعيد الخمسة القادمة التي سيعمل فيها الجدول فعلًا، وهي الطريقة الوحيدة للتأكد من أنك كتبت ما تقصده. وتنبّهك أيضًا إلى مأزق يوم الشهر ويوم الأسبوع، حيث يعمل الكرون إذا تطابق أحدهما لا كلاهما.',
  },
}
