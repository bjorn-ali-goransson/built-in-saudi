import type { Locale } from './index'

// Pure SEO data (no React imports) so the build-time prerender plugin in
// vite.config.ts can import it. When a tool goes LIVE, add its entry here.

export const siteMeta: Record<Locale, { title: string; description: string }> = {
  en: {
    title: 'Built in Saudi — Free, honest online tools',
    description:
      'A growing toolbox of fast, free, privacy-first utilities — no ads, no sign-ups, nothing uploaded. Everything runs in your browser. Proudly built in Saudi Arabia.',
  },
  ar: {
    title: 'بُنِيَ في السعودية — أدوات مجانية وصادقة على الإنترنت',
    description:
      'صندوقُ أدواتٍ متنامٍ من الأدوات المجانية التي تحترم خصوصيتك — بلا إعلانات، وبلا تسجيل، ولا يُرفع أي شيء. كل شيء يعمل داخل متصفحك. صُنع بفخر في السعودية.',
  },
}

export interface ToolSeo {
  id: string
  en: { name: string; description: string }
  ar: { name: string; description: string }
}

/** Live (routable) tools only — used to prerender /<locale>/tools/<id>/. */
export const liveToolSeo: ToolSeo[] = [
  {
    id: 'qr-code',
    en: {
      name: 'QR Code Generator',
      description:
        'Generate high-resolution QR codes for URLs, plain text, Wi-Fi networks, email and phone numbers — colours, size and error-correction, exported as PNG or SVG with no watermark. Runs entirely in your browser.',
    },
    ar: {
      name: 'مولّد الباركود',
      description:
        'أنشئ رموز باركود عالية الدقة للروابط والنصوص وشبكات الواي فاي والبريد وأرقام الهواتف — تحكّم في الألوان والحجم وتصحيح الأخطاء، وصدّر PNG أو SVG بدون علامة مائية. يعمل بالكامل داخل متصفحك.',
    },
  },
  {
    id: 'password-generator',
    en: {
      name: 'Password Generator',
      description:
        'Create strong random passwords and memorable passphrases entirely in your browser — adjustable length, character sets and a live strength estimate. Nothing is ever sent anywhere.',
    },
    ar: {
      name: 'مولّد كلمات المرور',
      description:
        'أنشئ كلمات مرور قوية وعبارات مرور سهلة التذكّر بالكامل داخل متصفحك — طول قابل للضبط ومجموعات أحرف وتقدير فوري للقوة. لا يُرسل أي شيء إلى أي مكان.',
    },
  },
  {
    id: 'prayer-times',
    en: {
      name: 'Prayer Times & Hijri Calendar',
      description:
        'Accurate daily prayer times using the Umm al-Qura method, today’s Hijri date, a Hijri ↔ Gregorian converter, and upcoming Islamic dates including Ramadan and the two Eids — computed in your browser.',
    },
    ar: {
      name: 'مواقيت الصلاة والتقويم الهجري',
      description:
        'مواقيت صلاة يومية دقيقة بطريقة أم القرى، وتاريخ اليوم الهجري، ومحوّل بين الهجري والميلادي، والمناسبات الإسلامية القادمة بما فيها رمضان والعيدان — تُحسب داخل متصفحك.',
    },
  },
]
