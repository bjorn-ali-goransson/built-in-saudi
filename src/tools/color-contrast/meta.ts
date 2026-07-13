import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ContrastIcon } from '../../components/icons'

export const colorContrastTool: Tool = {
  id: 'color-contrast',
  name: 'Contrast Checker',
  tagline: 'Check text colour contrast against WCAG.',
  description:
    'Pick a text and background colour and see their WCAG 2.1 contrast ratio, with clear pass/fail badges for AA and AAA at normal and large text sizes — plus a live preview. Great for accessible, readable design. Runs entirely in your browser.',
  category: 'Design',
  keywords: ['contrast', 'wcag', 'accessibility', 'a11y', 'color', 'colour', 'ratio', 'aa', 'aaa', 'تباين', 'وصول'],
  status: 'stable',
  Icon: ContrastIcon,
  component: lazyTool(() => import('./ColorContrastTool')),
  ar: {
    name: 'فاحص التباين',
    tagline: 'افحص تباين ألوان النص وفق WCAG.',
    description:
      'اختر لون النص والخلفية لترى نسبة التباين وفق WCAG 2.1، مع شارات نجاح/رسوب واضحة لمستويي AA وAAA لأحجام النص العادية والكبيرة — مع معاينة حيّة. مثالي لتصميم مقروء وسهل الوصول. يعمل بالكامل في متصفحك.',
  },
}
