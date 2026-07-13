import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CoinsIcon } from '../../components/icons'

export const zakatCalculatorTool: Tool = {
  id: 'zakat-calculator',
  name: 'Zakat Calculator',
  tagline: 'Work out zakat on your wealth at 2.5%.',
  description:
    'Add up your zakatable assets — cash, gold and silver, trade goods and money owed to you — subtract short-term debts, and see 2.5% due once your net wealth is above the niṣāb and has been held for a lunar year. A helping tool, not a fatwa. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: ['zakat', 'zakah', 'nisab', 'wealth', 'charity', 'islam', '2.5%', 'زكاة', 'نصاب', 'حول'],
  status: 'stable',
  Icon: CoinsIcon,
  component: lazyTool(() => import('./ZakatCalculatorTool')),
  ar: {
    name: 'حاسبة الزكاة',
    tagline: 'احسب زكاة مالك بنسبة 2.5%.',
    description:
      'اجمع أموالك التي تجب فيها الزكاة — النقد والذهب والفضة وعروض التجارة والديون المرجوّة لك — واطرح الديون قصيرة الأجل، لترى 2.5% الواجبة متى بلغ صافي مالك النصاب وحال عليه الحول. أداة مُعينة وليست فتوى. تعمل بالكامل في متصفحك.',
  },
}
