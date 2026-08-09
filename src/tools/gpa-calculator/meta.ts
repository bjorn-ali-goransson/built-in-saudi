import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CalcIcon } from '../../components/icons'

export const gpaCalculatorTool: Tool = {
  id: 'gpa-calculator',
  name: 'GPA Calculator',
  nameAr: 'حاسبة المعدل التراكمي',
  tagline: 'The Saudi 5.00 scale, and an honest conversion to 4.00.',
  description:
    'Work out a GPA course by course on the Saudi 5.00 scale or on 4.00, with the overall classification and your cumulative average — and convert between the scales grade by grade rather than with the (GPA ÷ 5) × 4 shortcut every other site uses. They disagree, because a fail is worth 1.00 out of 5 and 0.00 out of 4, so the shortcut flatters a weak record. Your marks stay in your browser.',
  category: 'Calculators',
  keywords: [
    'gpa', 'cgpa', 'grade point average', 'cumulative', 'university', 'college',
    'student', 'grades', 'credits', 'transcript', '5.0 scale', '4.0 scale',
    'gpa conversion', 'honours', 'ksu', 'kau',
    'المعدل التراكمي', 'حساب المعدل', 'معدل', 'الجامعة', 'الدرجات', 'الساعات المعتمدة',
    'التقدير', 'تحويل المعدل', 'من 5', 'من 4', 'طالب', 'كلية',
  ],
  status: 'beta',
  Icon: CalcIcon,
  component: lazyTool(() => import('./GpaCalculatorTool')),
  ar: {
    name: 'حاسبة المعدل التراكمي',
    tagline: 'مقياس ٥٫٠٠ السعودي، وتحويل صادق إلى ٤٫٠٠.',
    description:
      'احسب معدلك مقررًا مقررًا على مقياس ٥٫٠٠ السعودي أو على ٤٫٠٠، مع التقدير العام والمعدل التراكمي — وحوّل بين المقياسين تقديرًا بتقدير لا بمعادلة (المعدل ÷ ٥) × ٤ التي تستخدمها بقية المواقع. والطريقتان تختلفان، لأن الراسب يساوي ١٫٠٠ من خمسة و٠٫٠٠ من أربعة، فالاختصار يُجمّل السجل الضعيف. وتبقى درجاتك في متصفحك.',
  },
}
