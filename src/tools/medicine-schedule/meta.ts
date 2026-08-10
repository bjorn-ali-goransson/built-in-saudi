import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ClockIcon } from '../../components/icons'

export const medicineScheduleTool: Tool = {
  id: 'medicine-schedule',
  name: 'Medicine Timing Planner',
  nameAr: 'مخطّط مواعيد الدواء',
  tagline: 'Space your doses — including inside a fasting day.',
  description:
    'Spread doses evenly across your waking day, or — the part no other planner does — across the window between iftar and suhoor, which is about ten hours rather than twenty-four. Each dose is anchored to the nearest prayer, which is easier to remember than a clock time, and it warns when four doses simply will not fit comfortably in a fasting night.',
  category: 'Health',
  keywords: ['medicine', 'medication', 'dose', 'reminder', 'schedule', 'ramadan', 'fasting', 'دواء', 'جرعات', 'مواعيد', 'رمضان', 'صيام', 'تذكير'],
  status: 'stable',
  Icon: ClockIcon,
  component: lazyTool(() => import('./MedicineScheduleTool')),
  ar: {
    name: 'مخطّط مواعيد الدواء',
    tagline: 'وزّع جرعاتك — حتى داخل يوم صيام.',
    description:
      'وزّع الجرعات بالتساوي على ساعات يقظتك، أو — وهو ما لا تفعله المخططات الأخرى — على النافذة بين الإفطار والسحور، وهي نحو عشر ساعات لا أربع وعشرين. وتُربط كل جرعة بأقرب صلاة لأنها أسهل في التذكّر من وقت الساعة، وتنبّهك الأداة حين لا تتسع ليلة الصيام لأربع جرعات بشكل مريح.',
  },
}
