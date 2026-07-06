import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'

interface Section {
  h: string
  p: string[]
}

const STR: Record<'en' | 'ar', { title: string; updated: string; intro: string; sections: Section[] }> = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 6 July 2026',
    intro:
      'Built in Saudi is a toolbox of free, privacy-first online utilities. Our default is simple: almost every tool runs entirely in your browser, and your files and text never leave your device. This policy explains the few cases where data does reach our servers — chiefly the Book With Me scheduling tool — and exactly what we do with it.',
    sections: [
      {
        h: 'Tools that run in your browser',
        p: [
          'The vast majority of our tools (image, PDF, text, converter, calculator and Saudi/Islamic utilities) are 100% client-side. The files and text you work with are processed on your device and are never uploaded to us. We cannot see them.',
          'These tools may keep small preferences in your browser’s localStorage (for example your last-used settings). That never leaves your device.',
        ],
      },
      {
        h: 'Book With Me (the scheduling tool)',
        p: [
          'Book With Me needs a server to work, so it is our one clearly-badged exception. If you use it as a host, we store: your availability and meeting settings; your Google account’s basic profile (name, email, picture); a Google refresh token so we can check your calendar and add booked meetings; and, if you enable them, your push subscription and Telegram chat id.',
          'When someone books with you, we store that booking: the person’s name, email, an optional note, and the meeting time. We use it to create the calendar event and send confirmations.',
          'People who book with you provide their name and email only to make the booking. We use it solely to confirm and calendar the meeting — never for marketing.',
        ],
      },
      {
        h: 'Google user data',
        p: [
          'With your explicit consent, Book With Me uses the Google Calendar “events” and “free/busy” scopes for two purposes only: (1) to read your busy times so the booking page never offers a slot when you are busy, and (2) to create a calendar event when someone books with you. We store a refresh token to perform these actions on your behalf.',
          'Built in Saudi’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell this data, do not use it for advertising, and do not share it with third parties except as needed to provide the feature (Google itself).',
          'You can revoke our access at any time from your Google Account’s security settings (Third-party access), or by contacting us to delete your host record.',
        ],
      },
      {
        h: 'Email and notifications',
        p: [
          'Booking confirmations are sent by email through Resend (our email provider) and include a calendar invite. Optional booking alerts are sent via Web Push and, if you connect it, Telegram. These carry only the details needed for the notification.',
        ],
      },
      {
        h: 'Analytics',
        p: [
          'We use Google Analytics (GA4) to understand aggregate, anonymous usage — which tools are used and roughly where visitors come from. We do not use it to identify you and we do not sell analytics data.',
        ],
      },
      {
        h: 'Retention and deletion',
        p: [
          'Client-side tool data lives only in your browser until you clear it. For Book With Me, your host record and bookings are kept while your scheduling link is active. To delete your data, revoke Google access and email us and we will remove your host record and bookings.',
        ],
      },
      {
        h: 'Contact',
        p: ['Questions or deletion requests: hello@built-in-saudi.com.'],
      },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: ٦ يوليو ٢٠٢٦',
    intro:
      '«بُنِيَ في السعودية» صندوق أدوات مجانية تحترم خصوصيتك. الأصل بسيط: تعمل جميع الأدوات تقريبًا داخل متصفحك بالكامل، ولا تغادر ملفاتك ونصوصك جهازك. توضّح هذه السياسة الحالات القليلة التي تصل فيها بيانات إلى خوادمنا — خصوصًا أداة «احجز معي» — وما نفعله بها بالضبط.',
    sections: [
      {
        h: 'أدوات تعمل داخل متصفحك',
        p: [
          'الغالبية العظمى من أدواتنا (الصور وPDF والنصوص والمحوّلات والحاسبات والأدوات السعودية والإسلامية) تعمل بالكامل على جهازك. تُعالَج ملفاتك ونصوصك محليًا ولا تُرفع إلينا أبدًا، ولا يمكننا رؤيتها.',
          'قد تحفظ هذه الأدوات تفضيلات صغيرة في متصفحك (مثل آخر إعداداتك)، وهي لا تغادر جهازك.',
        ],
      },
      {
        h: 'أداة «احجز معي»',
        p: [
          'تحتاج «احجز معي» إلى خادم لتعمل، وهي استثناؤنا الوحيد الموسوم بوضوح. إن استخدمتها كمُضيف، نحفظ: أوقات فراغك وإعدادات الاجتماع؛ ومعلومات حسابك الأساسية في جوجل (الاسم والبريد والصورة)؛ ورمز تحديث من جوجل لنتحقق من تقويمك ونضيف الاجتماعات المحجوزة؛ وإن فعّلتها، اشتراك الإشعارات ومعرّف محادثة تيليجرام.',
          'عندما يحجز أحدهم معك، نحفظ ذلك الحجز: اسم الشخص وبريده وملاحظة اختيارية ووقت الاجتماع، لإنشاء حدث التقويم وإرسال التأكيدات.',
          'يقدّم من يحجزون معك أسماءهم وبريدهم لإتمام الحجز فقط، ونستخدمها حصريًا لتأكيد الموعد وجدولته — لا للتسويق.',
        ],
      },
      {
        h: 'بيانات مستخدم جوجل',
        p: [
          'بموافقتك الصريحة، تستخدم «احجز معي» صلاحيتَي «الأحداث» و«أوقات الانشغال» في تقويم جوجل لغرضين فقط: (١) قراءة أوقات انشغالك حتى لا تعرض صفحة الحجز وقتًا أنت مشغول فيه، و(٢) إنشاء حدث في التقويم عند الحجز. ونحفظ رمز تحديث للقيام بذلك نيابةً عنك.',
          'يلتزم «بُنِيَ في السعودية» في استخدامه ونقله للمعلومات الواردة من واجهات جوجل بسياسة بيانات مستخدم خدمات واجهات جوجل، بما في ذلك متطلبات الاستخدام المحدود. لا نبيع هذه البيانات، ولا نستخدمها للإعلانات، ولا نشاركها مع أطراف ثالثة إلا بالقدر اللازم لتقديم الميزة (جوجل نفسها).',
          'يمكنك إلغاء وصولنا في أي وقت من إعدادات أمان حساب جوجل (وصول الجهات الخارجية)، أو بمراسلتنا لحذف سجلك.',
        ],
      },
      {
        h: 'البريد والإشعارات',
        p: [
          'تُرسَل تأكيدات الحجز بالبريد عبر Resend (مزوّد البريد لدينا) وتتضمن دعوة تقويم. وتُرسَل التنبيهات الاختيارية عبر إشعارات الويب، وتيليجرام إن ربطته، ولا تحمل إلا تفاصيل الإشعار.',
        ],
      },
      {
        h: 'التحليلات',
        p: [
          'نستخدم Google Analytics (GA4) لفهم الاستخدام الإجمالي المجهول — أي الأدوات تُستخدم ومن أين يأتي الزوار تقريبًا. لا نستخدمه للتعرّف عليك ولا نبيع بيانات التحليلات.',
        ],
      },
      {
        h: 'الاحتفاظ والحذف',
        p: [
          'تبقى بيانات الأدوات في متصفحك حتى تمسحها. أما «احجز معي» فيُحفظ سجلك وحجوزاتك ما دام رابط الحجز نشطًا. لحذف بياناتك، ألغِ وصول جوجل وراسلنا وسنحذف سجلك وحجوزاتك.',
        ],
      },
      {
        h: 'التواصل',
        p: ['للأسئلة أو طلبات الحذف: hello@built-in-saudi.com.'],
      },
    ],
  },
}

export function PrivacyPage() {
  const { locale } = useLocale()
  const s = STR[locale]
  useDocumentMeta(locale, '/privacy', s.title, s.intro.slice(0, 155))
  return <LegalDoc title={s.title} updated={s.updated} intro={s.intro} sections={s.sections} />
}

export function LegalDoc({ title, updated, intro, sections }: { title: string; updated: string; intro: string; sections: Section[] }) {
  return (
    <div className="wrap py-[clamp(1.5rem,4vw,2.5rem)] max-w-[46rem] animate-[fadeUp_0.5s_ease_both]">
      <h1 className="font-display text-[clamp(1.6rem,4vw,2.1rem)] text-ink mb-1">{title}</h1>
      <p className="text-[0.85rem] text-ink-faint font-mono mb-5">{updated}</p>
      <p className="text-[0.98rem] text-ink-soft leading-relaxed mb-6">{intro}</p>
      <div className="flex flex-col gap-6">
        {sections.map((sec, i) => (
          <section key={i} className="flex flex-col gap-2">
            <h2 className="font-display text-[1.2rem] text-ink">{sec.h}</h2>
            {sec.p.map((para, j) => (
              <p key={j} className="text-[0.95rem] text-ink-soft leading-relaxed">{para}</p>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
