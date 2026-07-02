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
      name: 'Prayer Times',
      description:
        'Accurate daily prayer times using the Umm al-Qura method for your city or location — computed in your browser, with optional notifications a few minutes before each prayer.',
    },
    ar: {
      name: 'مواقيت الصلاة',
      description:
        'مواقيت صلاة يومية دقيقة بطريقة أم القرى لمدينتك أو موقعك — تُحسب داخل متصفحك، مع تنبيهات اختيارية قبل كل صلاة بدقائق.',
    },
  },
  {
    id: 'hijri-calendar',
    en: {
      name: 'Hijri Calendar',
      description:
        'Convert between Hijri and Gregorian dates (Umm al-Qura), see today’s Hijri date, and upcoming Islamic dates including Ramadan and the two Eids — computed in your browser.',
    },
    ar: {
      name: 'التقويم الهجري',
      description:
        'حوّل بين التاريخ الهجري والميلادي (أم القرى)، واعرف تاريخ اليوم الهجري، والمناسبات الإسلامية القادمة بما فيها رمضان والعيدان — تُحسب داخل متصفحك.',
    },
  },
  {
    id: 'qibla',
    en: {
      name: 'Qibla Locator',
      description:
        'Find the Qibla direction from your location — the exact bearing to the Kaaba in Makkah, a live compass where supported, and the distance. Computed in your browser.',
    },
    ar: {
      name: 'اتجاه القبلة',
      description:
        'حدّد اتجاه القبلة من موقعك — الاتجاه الدقيق إلى الكعبة في مكة، وبوصلة مباشرة حيثما تتوفّر، والمسافة. يُحسب داخل متصفحك.',
    },
  },
  {
    id: 'uuid-generator',
    en: { name: 'UUID Generator', description: 'Generate one or many RFC-4122 v4 UUIDs with optional formatting, entirely in your browser.' },
    ar: { name: 'مولّد UUID', description: 'أنشئ معرّفًا واحدًا أو عدة معرّفات UUID (v4) مع خيارات تنسيق، بالكامل داخل متصفحك.' },
  },
  {
    id: 'text-counter',
    en: { name: 'Word Counter', description: 'Live word, character, sentence and paragraph counts with reading-time estimates — Arabic-correct, in your browser.' },
    ar: { name: 'عدّاد الكلمات والحروف', description: 'عدّ مباشر للكلمات والحروف والجُمل والفقرات مع تقدير وقت القراءة — دقيق للعربية، داخل متصفحك.' },
  },
  {
    id: 'base64',
    en: { name: 'Base64 Convert', description: 'Encode and decode Base64 text with full UTF-8 support and a URL-safe option — entirely in your browser.' },
    ar: { name: 'ترميز وفكّ Base64', description: 'رمّز وفكّ نصوص Base64 بدعم كامل لـ UTF-8 وخيار آمن للروابط — بالكامل داخل متصفحك.' },
  },
  {
    id: 'date-diff',
    en: { name: 'Date Diff', description: 'Find the exact duration between two dates — years, months, days, plus total days and weeks. Runs entirely in your browser.' },
    ar: { name: 'الفرق بين تاريخين', description: 'احسب المدة الدقيقة بين تاريخين — سنوات وأشهر وأيام، وإجمالي الأيام والأسابيع. يعمل بالكامل داخل متصفحك.' },
  },
]
