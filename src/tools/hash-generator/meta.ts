import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { HashIcon } from '../../components/icons'

export const hashGeneratorTool: Tool = {
  id: 'hash-generator',
  name: 'Hash Generator',
  nameAr: 'مولّد البصمة (Hash)',
  tagline: 'SHA-1/256/384/512 of text or a file.',
  description:
    'Compute the SHA-1, SHA-256, SHA-384 or SHA-512 of any text or file — hex and Base64, copied in a tap. Files are hashed locally and never uploaded, so tokens and sensitive files stay on your device.',
  category: 'Generators',
  keywords: ['hash', 'sha', 'sha256', 'sha-256', 'sha512', 'checksum', 'digest', 'بصمة', 'تجزئة', 'هاش'],
  status: 'stable',
  Icon: HashIcon,
  component: lazyTool(() => import('./HashGeneratorTool')),
  ar: {
    name: 'مولّد البصمة (Hash)',
    tagline: 'حساب SHA-1/256/384/512 لنص أو ملف.',
    description:
      'احسب SHA-1 أو SHA-256 أو SHA-384 أو SHA-512 لأي نص أو ملف — بصيغة ست عشرية وBase64، وانسخ بلمسة. تُحسب الملفات محليًا ولا تُرفع، فتبقى الرموز والملفات الحساسة على جهازك.',
  },
}
