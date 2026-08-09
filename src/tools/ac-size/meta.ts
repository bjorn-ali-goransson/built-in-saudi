import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CloudIcon } from '../../components/icons'

export const acSizeTool: Tool = {
  id: 'ac-size',
  name: 'Air Conditioner Size Calculator',
  nameAr: 'حاسبة مقاس المكيف',
  tagline: 'What a 45°C summer actually needs.',
  description:
    'Work out the cooling a room needs here rather than in a temperate country — the rule of thumb the American calculators use is about a third of what a Gulf summer asks for. It adjusts for sun, top floor, ceiling height, occupants and kitchens, converts between tons and BTU, rounds to a size you can actually buy, and warns when that size is so far above the requirement that it will short-cycle instead of dehumidifying. Nothing is uploaded.',
  category: 'Calculators',
  keywords: [
    'air conditioner', 'ac', 'aircon', 'btu', 'ton', 'tonnage', 'cooling',
    'split unit', 'room size', 'hvac', 'sizing', 'capacity', 'summer',
    'مكيف', 'تكييف', 'مقاس المكيف', 'طن', 'وحدة حرارية', 'تبريد', 'سبليت',
    'قدرة المكيف', 'حجم الغرفة', 'صيف',
  ],
  status: 'beta',
  Icon: CloudIcon,
  component: lazyTool(() => import('./AcSizeTool')),
  ar: {
    name: 'حاسبة مقاس المكيف',
    tagline: 'ما يحتاجه صيف بـ٤٥ درجة فعلًا.',
    description:
      'احسب التبريد الذي تحتاجه الغرفة هنا لا في بلد معتدل — فالقاعدة التي تستخدمها الحاسبات الأمريكية نحو ثلث ما يتطلبه صيف الخليج. تراعي الأداة الشمس والدور العلوي وارتفاع السقف وعدد الأشخاص والمطابخ، وتحوّل بين الطن ووحدات BTU، وتقرّب إلى مقاس تجده في السوق، وتنبّه حين يزيد ذلك المقاس عن الحاجة بما يجعله يتوقف سريعًا بدل أن يسحب الرطوبة. ولا يُرفع شيء.',
  },
}
