import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SeedIcon } from '../../components/icons'

export const fakeDataTool: Tool = {
  id: 'fake-data',
  name: 'Fake Data Generator',
  tagline: 'Generate mock rows for testing — JSON or CSV.',
  description:
    'Generate realistic-looking sample records — names, emails, phones, cities, companies, dates and IDs — for seeding tests, mockups and demos. Pick the fields and count, then export as JSON or CSV. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['fake data', 'mock', 'sample', 'test data', 'seed', 'faker', 'json', 'csv', 'بيانات وهمية', 'اختبار'],
  status: 'stable',
  Icon: SeedIcon,
  component: lazyTool(() => import('./FakeDataTool')),
  ar: {
    name: 'مولّد بيانات وهمية',
    tagline: 'ولّد صفوفًا وهمية للاختبار — JSON أو CSV.',
    description:
      'ولّد سجلّات عيّنة واقعية المظهر — أسماء وبُرد إلكترونية وهواتف ومدن وشركات وتواريخ ومعرّفات — لتغذية الاختبارات والنماذج والعروض. اختر الحقول والعدد، ثم صدّر JSON أو CSV. يعمل بالكامل في متصفحك.',
  },
}
