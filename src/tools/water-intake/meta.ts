import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CloudIcon } from '../../components/icons'

export const waterIntakeTool: Tool = {
  id: 'water-intake',
  name: 'Water Intake Calculator',
  nameAr: 'حاسبة شرب الماء',
  tagline: 'How much water a 45°C day actually needs.',
  description:
    'Work out a day’s water from your body weight, then add what the heat, your activity and time in the sun genuinely cost you — because “eight glasses a day” describes a mild climate and says nothing useful about a Riyadh summer. It shows how the total is made up, warns when the figure gets too high to drink safely, and lays out how to fit it between iftar and suhoor while fasting.',
  category: 'Health',
  keywords: ['water', 'hydration', 'intake', 'daily water', 'heat', 'summer', 'ramadan', 'ماء', 'شرب الماء', 'ترطيب', 'حر', 'صيف', 'رمضان', 'صيام'],
  status: 'stable',
  Icon: CloudIcon,
  component: lazyTool(() => import('./WaterIntakeTool')),
  ar: {
    name: 'حاسبة شرب الماء اليومي',
    tagline: 'كم ماءً يحتاجه يومٌ حرارته ٤٥ درجة فعلًا.',
    description:
      'احسب ماء يومك من وزن جسمك، ثم أضف ما يكلّفك إياه الحر والنشاط والتعرّض للشمس فعلًا — فعبارة «ثمانية أكواب يوميًا» تصف مناخًا معتدلًا ولا تقول شيئًا مفيدًا عن صيف الرياض. تعرض الأداة كيف تكوّن المجموع، وتنبّه حين يرتفع الرقم فوق حدّ الشرب الآمن، وتشرح كيف توزّعه بين الإفطار والسحور في الصيام.',
  },
}
