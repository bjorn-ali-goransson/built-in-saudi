import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { WheelIcon } from '../../components/icons'

export const randomPickerTool: Tool = {
  id: 'random-picker',
  name: 'Random Picker Wheel',
  tagline: 'Spin a wheel to pick a name or option fairly.',
  description:
    'Type your options, one per line, and spin a colourful wheel to pick one at random — great for names, prizes, chores or deciding where to eat. Uses the browser’s cryptographic randomness. Runs entirely in your browser.',
  category: 'Generators',
  keywords: ['random', 'picker', 'wheel', 'spinner', 'raffle', 'decision', 'name picker', 'عجلة', 'اختيار عشوائي', 'قرعة'],
  status: 'stable',
  Icon: WheelIcon,
  component: lazyTool(() => import('./RandomPickerTool')),
  ar: {
    name: 'عجلة الاختيار العشوائي',
    tagline: 'أدِر العجلة لاختيار اسم أو خيار بإنصاف.',
    description:
      'اكتب خياراتك، خيارًا في كل سطر، وأدِر عجلة ملوّنة لاختيار واحد عشوائيًا — مثالية للأسماء أو الجوائز أو المهام أو تقرير مكان الأكل. تستخدم العشوائية التشفيرية للمتصفح. تعمل بالكامل في متصفحك.',
  },
}
