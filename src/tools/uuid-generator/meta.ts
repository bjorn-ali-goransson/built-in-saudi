import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { HashIcon } from '../../components/icons'

export const uuidGeneratorTool: Tool = {
  id: 'uuid-generator',
  name: 'UUID Generator',
  tagline: 'Generate v4 UUIDs in bulk.',
  description:
    'Generate one or many RFC-4122 version-4 UUIDs with a click, with optional formatting (uppercase, no dashes, braces). Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['uuid', 'guid', 'id', 'random', 'v4', 'rfc 4122'],
  status: 'stable',
  Icon: HashIcon,
  component: lazyTool(() => import('./UuidGeneratorTool')),
  ar: {
    name: 'مولّد UUID',
    tagline: 'أنشئ معرّفات UUID (v4) بالجملة.',
    description:
      'أنشئ معرّفًا واحدًا أو عدة معرّفات UUID (النسخة 4) بنقرة واحدة، مع خيارات تنسيق (أحرف كبيرة، بدون شرطات، أقواس). يعمل بالكامل داخل متصفحك.',
  },
}
