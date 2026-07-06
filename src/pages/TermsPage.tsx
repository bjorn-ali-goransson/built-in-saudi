import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { LegalDoc } from './PrivacyPage'

const STR = {
  en: {
    title: 'Terms of Use',
    updated: 'Last updated: 6 July 2026',
    intro:
      'These simple terms cover your use of Built in Saudi (built-in-saudi.com) and its tools, including Book With Me.',
    sections: [
      {
        h: 'The service',
        p: [
          'Built in Saudi is a free set of online tools, provided as-is with no warranties. We aim to keep it accurate and available but can’t guarantee it will be uninterrupted or error-free.',
        ],
      },
      {
        h: 'Acceptable use',
        p: [
          'Use the tools lawfully. Don’t use Book With Me to send spam, harass people, or misrepresent who you are. We may disable a scheduling link that is abused.',
        ],
      },
      {
        h: 'Bookings',
        p: [
          'A booking made through Book With Me is an arrangement between the host and the person booking. Built in Saudi provides the scheduling tool but is not a party to, and not responsible for, the meeting itself.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'To the extent permitted by law, Built in Saudi is not liable for any indirect or consequential loss arising from use of the tools, including missed or double-booked meetings.',
        ],
      },
      {
        h: 'Changes',
        p: ['We may update these terms or a tool at any time. Continued use means you accept the current version.'],
      },
      {
        h: 'Contact',
        p: ['Questions: hello@built-in-saudi.com.'],
      },
    ],
  },
  ar: {
    title: 'شروط الاستخدام',
    updated: 'آخر تحديث: ٦ يوليو ٢٠٢٦',
    intro:
      'تغطي هذه الشروط البسيطة استخدامك لـ«بُنِيَ في السعودية» (built-in-saudi.com) وأدواته، بما في ذلك «احجز معي».',
    sections: [
      {
        h: 'الخدمة',
        p: [
          '«بُنِيَ في السعودية» مجموعة أدوات مجانية تُقدَّم كما هي دون ضمانات. نسعى لإبقائها دقيقة ومتاحة، لكن لا نضمن أن تكون دون انقطاع أو أخطاء.',
        ],
      },
      {
        h: 'الاستخدام المقبول',
        p: [
          'استخدم الأدوات بشكل قانوني. لا تستخدم «احجز معي» لإرسال رسائل مزعجة أو مضايقة الآخرين أو انتحال الهوية. قد نعطّل رابط حجز يُساء استخدامه.',
        ],
      },
      {
        h: 'الحجوزات',
        p: [
          'الحجز عبر «احجز معي» ترتيب بين المُضيف والشخص الحاجز. نوفّر أداة الجدولة فقط، ولسنا طرفًا في الاجتماع نفسه ولا مسؤولين عنه.',
        ],
      },
      {
        h: 'المسؤولية',
        p: [
          'بالقدر الذي يسمح به القانون، لا يتحمّل «بُنِيَ في السعودية» أي خسارة غير مباشرة أو تبعية ناتجة عن استخدام الأدوات، بما في ذلك الاجتماعات الفائتة أو المحجوزة مرتين.',
        ],
      },
      {
        h: 'التغييرات',
        p: ['قد نحدّث هذه الشروط أو أي أداة في أي وقت. استمرارك في الاستخدام يعني قبول النسخة الحالية.'],
      },
      {
        h: 'التواصل',
        p: ['للأسئلة: hello@built-in-saudi.com.'],
      },
    ],
  },
}

export function TermsPage() {
  const { locale } = useLocale()
  const s = STR[locale]
  useDocumentMeta(locale, '/terms', s.title, s.intro.slice(0, 155))
  return <LegalDoc title={s.title} updated={s.updated} intro={s.intro} sections={s.sections} />
}
