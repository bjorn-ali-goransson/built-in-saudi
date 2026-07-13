import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShieldIcon } from '../../components/icons'

export const fileEncryptTool: Tool = {
  id: 'file-encrypt',
  name: 'File Encryptor',
  tagline: 'Password-encrypt any file with AES-256.',
  description:
    'Encrypt any file with a password using AES-256-GCM (with a PBKDF2-derived key), then decrypt it later with the same password. The file and password never leave your browser — this is real, standard cryptography running entirely on your device.',
  category: 'Files',
  keywords: ['encrypt', 'decrypt', 'aes', 'password', 'file', 'security', 'crypto', 'تشفير', 'فك تشفير', 'ملف'],
  status: 'stable',
  Icon: ShieldIcon,
  component: lazyTool(() => import('./FileEncryptTool')),
  ar: {
    name: 'مشفّر الملفات',
    tagline: 'شفّر أي ملف بكلمة مرور عبر AES-256.',
    description:
      'شفّر أي ملف بكلمة مرور باستخدام AES-256-GCM (بمفتاح مشتقّ عبر PBKDF2)، ثم فُكّ تشفيره لاحقًا بالكلمة نفسها. لا يغادر الملف ولا كلمة المرور متصفحك — تشفير قياسي حقيقي يعمل بالكامل على جهازك.',
  },
}
