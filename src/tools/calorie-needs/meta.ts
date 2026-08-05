import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalcIcon } from '../../components/icons'

export const calorieNeedsTool: Tool = {
  id: 'calorie-needs',
  name: 'Calorie & BMI Calculator',
  nameAr: 'حاسبة السعرات ومؤشر الكتلة',
  tagline: 'Your daily burn, target and a sane macro split.',
  description:
    'Work out how much you actually burn in a day and what to eat for your goal — resting burn, total daily burn, a calorie target for losing, holding or gaining, and a reasonable protein/carb/fat split. It also gives your BMI and the healthy weight range for your height. Uses the Mifflin-St Jeor equation, which measures closest to reality; older calculators still use Harris-Benedict and read high.',
  category: 'Calculators',
  keywords: ['calorie', 'tdee', 'bmr', 'bmi', 'macros', 'deficit', 'weight', 'diet', 'سعرات', 'حرق', 'وزن', 'مؤشر كتلة', 'حمية', 'بروتين'],
  status: 'stable',
  Icon: CalcIcon,
  component: lazyTool(() => import('./CalorieNeedsTool')),
  ar: {
    name: 'حاسبة السعرات ومؤشر كتلة الجسم',
    tagline: 'حرقك اليومي وهدفك وتوزيع معقول للعناصر.',
    description:
      'احسب كم تحرق فعلًا في اليوم وماذا تأكل لهدفك — الحرق في الراحة، والحرق اليومي الكلي، وهدف سعرات للإنقاص أو المحافظة أو الزيادة، وتوزيعًا معقولًا للبروتين والكربوهيدرات والدهون. وتعطيك أيضًا مؤشر كتلة جسمك ونطاق الوزن الصحي لطولك. تستخدم معادلة ميفلين-سانت جيور الأقرب للواقع؛ بينما لا تزال حاسبات قديمة تستخدم هاريس-بنديكت فتعطي أرقامًا مرتفعة.',
  },
}
