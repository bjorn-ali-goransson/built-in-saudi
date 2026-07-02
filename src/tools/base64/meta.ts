import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CodeIcon } from '../../components/icons'

export const base64Tool: Tool = {
  id: 'base64',
  name: 'Base64 Convert',
  tagline: 'Encode and decode Base64 text — UTF-8 safe.',
  description:
    'Encode or decode Base64 text with full UTF-8 support (Arabic and emoji round-trip correctly), plus a URL-safe option. Runs entirely in your browser — your data is never uploaded.',
  category: 'Developer',
  keywords: ['base64', 'encode', 'decode', 'url-safe', 'data uri', 'ترميز'],
  status: 'stable',
  Icon: CodeIcon,
  component: lazyTool(() => import('./Base64Tool')),
  ar: {
    name: 'ترميز وفكّ Base64',
    tagline: 'رمّز وفكّ نصوص Base64 — بدعم كامل لـ UTF-8.',
    description:
      'رمّز أو فكّ ترميز نصوص Base64 مع دعم كامل لـ UTF-8 (العربية والرموز التعبيرية تعمل بشكل صحيح)، مع خيار آمن للروابط. يعمل بالكامل داخل متصفحك — لا تُرفع بياناتك.',
  },
}
