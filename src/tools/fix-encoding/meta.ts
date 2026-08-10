import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RefreshIcon } from '../../components/icons'

export const fixEncodingTool: Tool = {
  id: 'fix-encoding',
  name: 'Fix Garbled Text',
  nameAr: 'إصلاح النص المشوّه',
  tagline: 'Turn Ø§Ù„ back into العربية.',
  description:
    'Repair text that arrived as Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© or â€™ instead of readable characters — the classic mojibake you get when UTF-8 is opened as the wrong codepage. It works out which encoding mangled it, undoes the damage (twice over if it was double-mangled) and shows the alternative readings. Runs entirely in your browser.',
  category: 'Text',
  keywords: ['mojibake', 'question marks', 'weird symbols', 'strange characters', 'wrong characters', 'encoding', 'utf-8', 'garbled', 'broken characters', 'charset', 'ترميز', 'نص مشوه', 'رموز غريبة', 'windows-1256', 'csv'],
  status: 'stable',
  Icon: RefreshIcon,
  component: lazyTool(() => import('./FixEncodingTool')),
  ar: {
    name: 'إصلاح النص المشوّه',
    tagline: 'أعِد Ø§Ù„ إلى العربية.',
    description:
      'أصلح النص الذي وصل على شكل Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© أو â€™ بدل الحروف المقروءة — التشويه المعتاد حين يُفتح ترميز UTF-8 بترميز خاطئ. تكتشف الأداة الترميز الذي أفسده وتُلغي الضرر (مرتين إن تضاعف التشويه) وتعرض القراءات البديلة. يعمل بالكامل في متصفحك.',
  },
}
