import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { PlateIcon } from '../../components/icons'

export const saudiPlateTool: Tool = {
  id: 'saudi-plate',
  name: 'Saudi Plate Converter',
  nameAr: 'محوّل اللوحات السعودية',
  tagline: 'Read a plate in either script — Arabic ↔ Latin.',
  description:
    'Convert a Saudi vehicle plate between its Arabic and Latin halves. Only 17 Arabic letters appear on plates and each maps to one fixed Latin character (ح is J, م is Z), and the letters run in the opposite order on the Arabic side — so type a plate in either script and get both halves back exactly as they appear. Runs entirely in your browser.',
  category: 'Saudi / Local',
  keywords: [
    'plate', 'licence plate', 'license plate', 'car', 'vehicle', 'saudi', 'letters', 'arabic', 'latin', 'convert',
    'لوحة', 'لوحات', 'سيارة', 'مركبة', 'حروف', 'تحويل', 'إنجليزي', 'عربي',
  ],
  status: 'stable',
  Icon: PlateIcon,
  component: lazyTool(() => import('./SaudiPlateTool')),
  ar: {
    name: 'محوّل اللوحات السعودية',
    tagline: 'اقرأ اللوحة بأي خط — عربي ↔ لاتيني.',
    description:
      'حوّل لوحة مركبة سعودية بين جانبيها العربي واللاتيني. لا يظهر على اللوحات سوى ١٧ حرفًا عربيًا، ولكل حرف مقابل لاتيني واحد ثابت (ح هي J وم هي Z)، وتسير الحروف بترتيب معاكس في الجانب العربي — فاكتب اللوحة بأي خط واحصل على الجانبين كما يظهران تمامًا. يعمل داخل متصفحك بالكامل.',
  },
}
