import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalcIcon } from '../../components/icons'

export const admissionScoreTool: Tool = {
  id: 'admission-score',
  name: 'Weighted Admission Score',
  nameAr: 'النسبة الموزونة للقبول',
  tagline: 'And which subject is worth the most.',
  description:
    'Your weighted admission percentage from high school, Qudurat and Tahsili — at whatever weighting the university actually uses. The formula is exact and only the weights differ between universities and programmes, so they are yours to set rather than ours to guess, with the common ones ready to pick. It shows the same three scores under every common weighting, so you can see which university values what you already have. And it works out where your remaining points really are: at 30/30/40 a point of Tahsili is worth a third more than a point of school, so the same revision is not worth the same everywhere.',
  category: 'Saudi / Local',
  keywords: [
    'admission', 'weighted percentage', 'qudurat', 'gat', 'tahsili', 'university', 'college', 'score', 'ksu', 'kfupm', 'high school', 'gpa', 'nisbah',
    'النسبة الموزونة', 'القبول', 'القدرات', 'التحصيلي', 'الثانوية', 'جامعة', 'نسبة', 'قياس', 'موزونة',
  ],
  status: 'stable',
  Icon: CalcIcon,
  component: lazyTool(() => import('./AdmissionScoreTool')),
  ar: {
    name: 'النسبة الموزونة للقبول',
    tagline: 'وأي مادة أثمن من غيرها.',
    description:
      'نسبتك الموزونة للقبول من الثانوية والقدرات والتحصيلي — بأي ترجيح تستخدمه الجامعة فعلًا. فالمعادلة ثابتة ولا يختلف إلا الترجيح بين الجامعات والبرامج، فهو من إدخالك لا من تخميننا، والأشهر منه جاهز للاختيار. وتعرض الأداة الدرجات الثلاث نفسها بكل ترجيح شائع لترى أي جامعة تقدّر ما لديك أصلًا. وتبيّن لك أين نقاطك المتبقية حقًا: فعند 30/30/40 تساوي نقطة التحصيلي ثلث زيادة على نقطة الثانوية، والمذاكرة نفسها لا تساوي الشيء نفسه في كل موضع.',
  },
}
