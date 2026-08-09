import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalendarIcon } from '../../components/icons'

export const dueDateTool: Tool = {
  id: 'due-date',
  name: 'Pregnancy Due Date Calculator',
  nameAr: 'حاسبة الحمل وموعد الولادة',
  tagline: 'When the baby is due, in both calendars.',
  description:
    'Work out an estimated due date from your last period, the date of conception, or an IVF transfer — and see how many weeks and days along you are, which trimester that is, and every date in between. It adjusts for a cycle that is not 28 days, which is the thing most due-date calculators quietly get wrong, and gives every date in the Hijri calendar as well as the Gregorian one. Nothing is sent anywhere.',
  category: 'Calculators',
  keywords: [
    'pregnancy', 'due date', 'edd', 'gestation', 'weeks pregnant', 'trimester', 'conception',
    'ivf', 'lmp', 'last period', 'baby', 'birth', 'naegele', 'hijri',
    'حمل', 'حاسبة الحمل', 'موعد الولادة', 'الولادة', 'أسابيع الحمل', 'عمر الحمل',
    'الثلث الأول', 'أطفال الأنابيب', 'الدورة', 'جنين', 'هجري',
  ],
  status: 'stable',
  Icon: CalendarIcon,
  component: lazyTool(() => import('./DueDateTool')),
  ar: {
    name: 'حاسبة الحمل وموعد الولادة',
    tagline: 'متى موعد الولادة، بالتقويمين.',
    description:
      'احسبي موعد الولادة المتوقع من آخر دورة، أو من تاريخ حدوث الحمل، أو من تاريخ الإرجاع في أطفال الأنابيب — واعرفي كم أسبوعًا ويومًا مضى، وفي أي ثلثٍ أنتِ، وكل تاريخ بينهما. تراعي الأداة الدورة التي لا تساوي ٢٨ يومًا، وهو ما تتجاهله معظم الحاسبات بصمت، وتعطي كل تاريخ بالهجري كما بالميلادي. ولا يُرسل شيء إلى أي مكان.',
  },
}
