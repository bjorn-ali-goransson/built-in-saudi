import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CoinsIcon } from '../../components/icons'

export const earlySettlementTool: Tool = {
  id: 'early-settlement',
  name: 'Early Loan Settlement',
  nameAr: 'السداد المبكر للتمويل',
  tagline: 'What paying it off early costs — and saves.',
  description:
    'Work out what it costs to settle a personal finance early, and what that saves you against carrying on. The rule is the opposite of what most people assume: settling early does not mean paying the rest of the term cost. You pay the outstanding balance plus the term cost for the three months following repayment, worked out on a declining balance, and the rest of the term is waived. The three months is a ceiling set by SAMA, not a fee the lender chooses — so if a settlement quote comes back higher, that is worth asking about.',
  category: 'Saudi / Local',
  keywords: [
    'early settlement', 'early repayment', 'loan payoff', 'personal finance', 'sama', 'settle loan', 'pay off early', 'three months', 'declining balance', 'saving', 'bank', 'murabaha',
    'السداد المبكر', 'إطفاء التمويل', 'تمويل شخصي', 'قرض', 'ساما', 'مؤسسة النقد', 'رصيد متناقص', 'توفير', 'بنك',
  ],
  status: 'stable',
  Icon: CoinsIcon,
  component: lazyTool(() => import('./EarlySettlementTool')),
  ar: {
    name: 'السداد المبكر للتمويل',
    tagline: 'كم يكلّفك السداد المبكر، وكم يوفّر.',
    description:
      'احسب كلفة سداد تمويلك الشخصي مبكرًا، وكم يوفّر عليك ذلك مقارنةً بالاستمرار. والقاعدة عكس ما يظنه أكثر الناس: فالسداد المبكر لا يعني دفع بقية تكلفة الأجل. إنما تدفع الرصيد القائم مع تكلفة أجل الأشهر الثلاثة التالية للسداد، محسوبة على رصيد متناقص، ويُسقط باقي الأجل. والأشهر الثلاثة حدٌّ أعلى وضعته مؤسسة النقد لا رسمٌ يختاره الممول — فإن جاءك عرض سداد أعلى فالسؤال عنه في محله.',
  },
}
