import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalcIcon } from '../../components/icons'

export const loanCalculatorTool: Tool = {
  id: 'loan-calculator',
  name: 'Loan Calculator',
  tagline: 'Monthly payment, total interest and a schedule.',
  description:
    'Work out the monthly payment on a loan or mortgage from the amount, annual interest rate and term, with the total interest, total repaid and a year-by-year amortization breakdown. A neutral maths tool — not financial advice. Runs entirely in your browser.',
  category: 'Calculators',
  keywords: ['loan', 'mortgage', 'amortization', 'interest', 'monthly payment', 'finance', 'installment', 'قرض', 'تمويل', 'قسط'],
  status: 'stable',
  Icon: CalcIcon,
  component: lazyTool(() => import('./LoanCalculatorTool')),
  ar: {
    name: 'حاسبة القروض',
    tagline: 'القسط الشهري وإجمالي الفائدة وجدول السداد.',
    description:
      'احسب القسط الشهري لقرض أو تمويل عقاري من المبلغ ونسبة الفائدة السنوية والمدة، مع إجمالي الفائدة والمبلغ المسدَّد وجدول إطفاء سنوي. أداة حسابية محايدة — وليست نصيحة مالية. تعمل بالكامل في متصفحك.',
  },
}
