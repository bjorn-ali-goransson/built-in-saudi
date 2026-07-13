import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { DiffIcon } from '../../components/icons'

export const textDiffTool: Tool = {
  id: 'text-diff',
  name: 'Text Diff',
  tagline: 'Compare two texts line by line.',
  description:
    'Paste two versions of a text and see a line-by-line diff — additions, removals and unchanged lines colour-coded, with a count of what changed. Useful for config, prose or code snippets. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['diff', 'compare', 'text', 'difference', 'changes', 'merge', 'مقارنة', 'فرق النص'],
  status: 'stable',
  Icon: DiffIcon,
  component: lazyTool(() => import('./TextDiffTool')),
  ar: {
    name: 'مقارنة النصوص',
    tagline: 'قارن نصّين سطرًا بسطر.',
    description:
      'الصق نسختين من نصّ لترى الفروق سطرًا بسطر — الإضافات والحذوفات والأسطر غير المتغيّرة بألوان مميّزة، مع عدّ لما تغيّر. مفيد للإعدادات أو النصوص أو مقاطع الشيفرة. يعمل بالكامل في متصفحك.',
  },
}
