import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { ShieldIcon } from '../../components/icons'

export const totpTool: Tool = {
  id: 'totp',
  name: '2FA Code Generator',
  nameAr: 'مولّد رموز التحقق',
  tagline: 'Six-digit 2FA codes, generated on your device.',
  description:
    'Turn a two-factor secret into the rolling six-digit code, exactly as an authenticator app would (RFC 6238 TOTP, SHA-1/256/512, 6 or 8 digits). Paste the base32 secret or the whole otpauth:// link from a setup QR. The secret is used with your browser’s own crypto and never leaves the page — and it is only stored if you tick the box.',
  category: 'Generators',
  keywords: ['2fa', 'totp', 'otp', 'authenticator', 'two factor', 'mfa', 'رمز التحقق', 'المصادقة الثنائية', 'otpauth', 'google authenticator'],
  status: 'stable',
  Icon: ShieldIcon,
  component: lazyTool(() => import('./TotpTool')),
  ar: {
    name: 'مولّد رموز التحقق الثنائي',
    tagline: 'رموز تحقق من ست خانات، تُولَّد على جهازك.',
    description:
      'حوّل مفتاح التحقق الثنائي إلى الرمز المتجدّد من ست خانات، تمامًا كما يفعل تطبيق المصادقة (معيار RFC 6238، وخوارزميات SHA-1 و256 و512، بست أو ثماني خانات). الصق مفتاح base32 أو رابط ‎otpauth://‎ كاملًا من رمز الإعداد. يُستخدم المفتاح عبر تعمية المتصفح نفسه ولا يغادر الصفحة أبدًا — ولا يُحفظ إلا إذا فعّلت الخيار بنفسك.',
  },
}
