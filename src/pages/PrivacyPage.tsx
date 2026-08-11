import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../i18n'
import { useDocumentMeta } from '../lib/useDocumentMeta'
import { Button, Spinner } from '../components/ui'
import { myData, type MyDataReport } from '../lib/bookingApi'
import { loadGis, GOOGLE_CLIENT_ID } from '../lib/cvApi'

interface Section {
  h: string
  p: string[]
}

const STR: Record<'en' | 'ar', { title: string; updated: string; intro: string; sections: Section[] }> = {
  en: {
    title: 'Privacy Policy',
    updated: 'Last updated: 5 August 2026',
    intro:
      'Built in Saudi is a toolbox of free, privacy-first online utilities. Our default is simple: almost every tool runs entirely in your browser, and your files and text never leave your device. This policy explains the few cases where data does reach our servers — scheduling, the CV optimizer, short links, calls and prayer alerts — with a dedicated section for each, and exactly what we do with it.',
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
        h: 'Book With Me — Google Calendar data',
        p: [
          'With your explicit consent, Book With Me uses the Google Calendar “events” scope for two purposes only: (1) to read your events so the booking page never offers a slot when you already have something on your calendar, and (2) to create a calendar event when someone books with you (including a Google Meet link if you enabled it). We never modify or delete your existing events, and we store a refresh token only to perform these two actions on your behalf.',
          'Built in Saudi’s use and transfer of information received from Google APIs adheres to the Google API Services User Data Policy, including the Limited Use requirements. We do not sell this data, do not use it for advertising, and do not share it with third parties except as needed to provide the feature (Google itself).',
          'All data is transmitted over an encrypted connection (HTTPS/TLS) and stored in Google Cloud (Firestore) with restricted access; the refresh token is held only as a server-side secret and is never exposed to the browser.',
          'You can revoke our access at any time from your Google Account’s security settings (Third-party access), or by contacting us to delete your host record.',
        ],
      },
      {
        h: 'ATS CV Optimizer',
        p: [
          'Your CV file is read inside your browser — the file itself is never uploaded to us. Only the extracted plain text is sent to our server, which passes it to OpenAI to rewrite it into the structured result and to apply any answers or edits you make.',
          'We do not store the content of your CV on our servers — unless you tick “Save for later”. By default we keep only a small per-user counter (tied to your Google account) to enforce the free limits and prevent abuse — such as how many CVs you generated today and how many edits you have made.',
          'If you tick “Save for later”, your CV is saved on your device; and if you then choose “Save to my account”, the resulting CV (as structured text, never the original file you uploaded) is stored on our servers so you can resume it on any device. It is kept for 6 months, and you can remove it anytime by unticking the box or via “Delete my data” below.',
          'Sign-in here uses Google only to confirm you are a real person (your name and email). This tool requests no Google Calendar, Drive or other scopes.',
          'The extracted text is processed by OpenAI purely to generate your CV. Per OpenAI’s API policy, data sent through the API is not used to train their models. We send only the CV text you provide, nothing more.',
        ],
      },
      {
        h: 'Link Shortener',
        p: [
          'The Link Shortener needs a server to redirect visitors, so it stores the links you create: the original URL, the short code, a click counter, and your Google account id/email as the owner. Sign-in uses Google only to confirm you are a real person and to tie links to you; it requests no Calendar, Drive or other scopes.',
          'Short links are kept for 6 months and then expire and are deleted automatically. You can delete any link yourself at any time from the tool, and “Delete my data” below removes every link you own.',
        ],
      },
      {
        h: 'Calls and call links',
        p: [
          'Calls is peer-to-peer: video, audio, whiteboard, chat and files go straight between browsers — our server only relays the initial connection handshake and never sees any of that content.',
          'A personal “call me” link is anonymous: we store only your device’s push subscription under a random code (no name required, no account) so people can ring you. It is kept for 6 months after its last use, then deleted; you can remove it anytime from the Calls tool, or when a call comes in. Because it isn’t tied to an account, “Delete my data” below can’t find it — you remove it yourself.',
        ],
      },
      {
        h: 'Prayer times, adhkar and your location',
        p: [
          'Prayer times, qibla direction and the Hijri calendar are calculated on your device. Your coordinates are not sent to us to work them out.',
          'If you choose “my location” instead of picking a city from the list, your browser asks a third-party service (BigDataCloud) to turn those coordinates into a city name for the label the tool shows. That single lookup goes straight from your browser and we never see it; picking a city from the list makes no request at all.',
          'Switching on prayer or adhkar alerts is different, and this is the one place where your location is stored. A notification has to arrive when you are not on the site, so we save your coordinates, timezone, city label and your device’s notification subscription on our server, and use them only to work out when each alert is due.',
          'That record is anonymous — no account is attached to it — so “Delete my data” below cannot find it. Turn alerts off in the Prayer Times or Adhkar tool and it is deleted immediately. It is also deleted automatically after 90 days if your device stops accepting notifications.',
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
          'We use Google Analytics (GA4) to understand aggregate usage — which tools are used and roughly where visitors come from. We do not use it to identify you and we do not sell analytics data.',
          'It runs in cookieless mode: Analytics is configured with client storage switched off, so it sets no cookies and stores no identifier in your browser. Each visit is counted on its own, and there is nothing left behind to recognise you on your next one. We also disable Google Signals and ad personalisation, and IP addresses are anonymised.',
          'We also use a second, privacy-focused analytics service (analytics.ali-web-services.com) for the same aggregate page-view counts. It runs without cookies too, sends no personal data, and stores no identifier in your browser.',
          'Because of this, the site sets no analytics cookies at all — so there is no cookie banner to click, and nothing to opt out of.',
        ],
      },
      {
        h: 'Retention and deletion',
        p: [
          'Client-side tool data lives only in your browser until you clear it. For Book With Me, your host record and bookings are kept while your scheduling link is active. To delete your data, revoke Google access and email us and we will remove your host record and bookings.',
          'The ATS CV Optimizer stores no CV content — only short-lived usage counters that reset over time, so there is nothing of yours to delete there.',
          'Short links you create are kept for 6 months, then expire and are deleted automatically; you can also delete them yourself at any time.',
          'Prayer and adhkar alert subscriptions (which hold your coordinates) are deleted the moment you turn alerts off, and automatically after 90 days of inactivity. Personal call links are deleted 6 months after their last use, or whenever you remove them.',
        ],
      },
      {
        h: 'Contact',
        p: ['Questions or deletion requests: bjorn.a.goransson@gmail.com.'],
      },
    ],
  },
  ar: {
    title: 'سياسة الخصوصية',
    updated: 'آخر تحديث: ٥ أغسطس ٢٠٢٦',
    intro:
      '«بُنِيَ في السعودية» صندوق أدوات مجانية تحترم خصوصيتك. الأصل بسيط: تعمل جميع الأدوات تقريبًا داخل متصفحك بالكامل، ولا تغادر ملفاتك ونصوصك جهازك. توضّح هذه السياسة الحالات القليلة التي تصل فيها بيانات إلى خوادمنا — الحجز، ومحسِّن السيرة الذاتية، والروابط المختصرة، والمكالمات، وتنبيهات الصلاة — ولكلٍّ قسم مستقل، وما نفعله بها بالضبط.',
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
        h: '«احجز معي» — بيانات تقويم جوجل',
        p: [
          'بموافقتك الصريحة، تستخدم «احجز معي» صلاحية «الأحداث» في تقويم جوجل لغرضين فقط: (١) قراءة أحداثك لحساب أوقات انشغالك حتى لا تعرض صفحة الحجز وقتًا أنت مشغول فيه، و(٢) إنشاء حدث في التقويم عند الحجز (مع رابط Google Meet إن فعّلته). لا نعدّل أو نحذف أحداثك القائمة، ونحفظ رمز تحديث فقط للقيام بهذين الإجراءين نيابةً عنك.',
          'يلتزم «بُنِيَ في السعودية» في استخدامه ونقله للمعلومات الواردة من واجهات جوجل بسياسة بيانات مستخدم خدمات واجهات جوجل، بما في ذلك متطلبات الاستخدام المحدود. لا نبيع هذه البيانات، ولا نستخدمها للإعلانات، ولا نشاركها مع أطراف ثالثة إلا بالقدر اللازم لتقديم الميزة (جوجل نفسها).',
          'تُنقل جميع البيانات عبر اتصال مُعمّى (HTTPS/TLS) وتُخزَّن في Google Cloud (Firestore) بصلاحيات وصول مقيّدة؛ ويُحفظ رمز التحديث كسرٍّ في الخادم فقط ولا يُكشف للمتصفح إطلاقًا.',
          'يمكنك إلغاء وصولنا في أي وقت من إعدادات أمان حساب جوجل (وصول الجهات الخارجية)، أو بمراسلتنا لحذف سجلك.',
        ],
      },
      {
        h: 'محسِّن السيرة الذاتية (ATS)',
        p: [
          'يُقرأ ملف سيرتك داخل متصفحك — ولا يُرفع الملف نفسه إلينا أبدًا. يُرسَل النص المستخرج فقط إلى خادمنا، الذي يمرّره إلى OpenAI لإعادة كتابته في النتيجة المنظّمة ولتطبيق أي إجابات أو تعديلات تجريها.',
          'لا نخزّن محتوى سيرتك على خوادمنا — إلا إذا فعّلت «احفظ للاحقًا». افتراضيًا نحتفظ فقط بعدّاد صغير لكل مستخدم (مرتبط بحساب جوجل) لفرض الحدود المجانية ومنع الإساءة — مثل عدد السير التي أنشأتها اليوم وعدد التعديلات.',
          'إذا فعّلت «احفظ للاحقًا»، تُحفظ سيرتك على جهازك؛ وإن اخترت بعدها «احفظ في حسابي»، تُخزَّن السيرة الناتجة (كنصّ منظَّم، وليس الملف الأصلي الذي رفعته) على خوادمنا لتستأنفها على أي جهاز. تُحفظ لمدة ٦ أشهر، ويمكنك إزالتها في أي وقت بإلغاء تفعيل الخانة أو عبر «احذف بياناتي» أدناه.',
          'تسجيل الدخول هنا يستخدم جوجل فقط للتأكد أنك شخص حقيقي (اسمك وبريدك). ولا تطلب هذه الأداة أي صلاحيات تقويم أو Drive أو غيرها.',
          'يُعالَج النص المستخرج بواسطة OpenAI لإنشاء سيرتك فقط. ووفق سياسة واجهة OpenAI، لا تُستخدم البيانات المُرسَلة عبر الواجهة لتدريب نماذجها. ونرسل نص سيرتك فقط لا غير.',
        ],
      },
      {
        h: 'اختصار الروابط',
        p: [
          'يحتاج مختصِر الروابط إلى خادم لإعادة توجيه الزوار، لذا يخزّن الروابط التي تنشئها: الرابط الأصلي، والرمز القصير، وعدّاد النقرات، ومعرّف/بريد حساب جوجل كمالك. يُستخدم تسجيل الدخول عبر جوجل فقط للتأكد أنك شخص حقيقي ولربط الروابط بك، ولا يطلب أي صلاحيات تقويم أو Drive أو غيرها.',
          'تُحفظ الروابط القصيرة لمدة ٦ أشهر ثم تنتهي وتُحذف تلقائيًا. ويمكنك حذف أي رابط بنفسك في أي وقت من الأداة، كما يزيل «احذف بياناتي» أدناه كل روابطك.',
        ],
      },
      {
        h: 'المكالمات وروابط الاتصال',
        p: [
          'المكالمات تجري مباشرةً بين الأجهزة: الفيديو والصوت والسبورة والدردشة والملفات تنتقل بين المتصفحات مباشرةً — خادمنا يمرّر فقط مصافحة الاتصال الأولى ولا يرى أيًّا من ذلك المحتوى.',
          'رابط «اتصل بي» الشخصي مجهول: نخزّن فقط اشتراك الإشعارات لجهازك تحت رمز عشوائي (بدون اسم وبدون حساب) ليتمكن الناس من الاتصال بك. يُحفظ ٦ أشهر من آخر استخدام ثم يُحذف، ويمكنك إزالته في أي وقت من أداة المكالمات أو عند ورود مكالمة. ولأنه غير مرتبط بحساب، لا يستطيع «احذف بياناتي» أدناه العثور عليه — تزيله بنفسك.',
        ],
      },
      {
        h: 'أوقات الصلاة والأذكار وموقعك',
        p: [
          'تُحسب أوقات الصلاة واتجاه القبلة والتقويم الهجري على جهازك، ولا تُرسَل إحداثياتك إلينا لحسابها.',
          'إذا اخترت «موقعي» بدل اختيار مدينة من القائمة، فإن متصفحك يسأل خدمة خارجية (BigDataCloud) لتحويل تلك الإحداثيات إلى اسم مدينة يظهر في الأداة. يذهب هذا الطلب الواحد من متصفحك مباشرةً ولا نراه نحن؛ أما اختيار مدينة من القائمة فلا يُرسل أي طلب إطلاقًا.',
          'أما تفعيل تنبيهات الصلاة أو الأذكار فمختلف، وهو الموضع الوحيد الذي يُخزَّن فيه موقعك. فالإشعار يجب أن يصلك وأنت خارج الموقع، لذلك نحفظ إحداثياتك ومنطقتك الزمنية واسم مدينتك واشتراك الإشعارات لجهازك على خادمنا، ونستخدمها فقط لحساب موعد كل تنبيه.',
          'هذا السجل مجهول — لا حساب مرتبط به — لذا لا يستطيع «احذف بياناتي» أدناه العثور عليه. أوقف التنبيهات من أداة أوقات الصلاة أو الأذكار فيُحذف فورًا. ويُحذف تلقائيًا بعد ٩٠ يومًا إذا توقّف جهازك عن قبول الإشعارات.',
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
          'نستخدم Google Analytics (GA4) لفهم الاستخدام الإجمالي — أي الأدوات تُستخدم ومن أين يأتي الزوار تقريبًا. لا نستخدمه للتعرّف عليك ولا نبيع بيانات التحليلات.',
          'ويعمل بوضع بلا كوكيز: أُوقفنا تخزين البيانات في المتصفح، فلا يضع أي كوكي ولا يحفظ أي معرّف لديك. تُحتسب كل زيارة على حدة، ولا يبقى شيء يتعرّف عليك في زيارتك القادمة. كما عطّلنا Google Signals وتخصيص الإعلانات، وتُخفى عناوين IP.',
          'كما نستخدم خدمة تحليلات ثانية تُعنى بالخصوصية (analytics.ali-web-services.com) لأغراض احتساب مشاهدات الصفحات الإجمالية نفسها. وهي أيضًا تعمل بلا كوكيز، ولا تُرسل أي بيانات شخصية، ولا تحفظ أي معرّف في متصفحك.',
          'ولهذا لا يضع الموقع أي كوكيز تحليلات إطلاقًا — فلا يوجد إشعار كوكيز تضغط عليه، ولا شيء تنسحب منه.',
        ],
      },
      {
        h: 'الاحتفاظ والحذف',
        p: [
          'تبقى بيانات الأدوات في متصفحك حتى تمسحها. أما «احجز معي» فيُحفظ سجلك وحجوزاتك ما دام رابط الحجز نشطًا. لحذف بياناتك، ألغِ وصول جوجل وراسلنا وسنحذف سجلك وحجوزاتك.',
          'لا يخزّن محسِّن السيرة الذاتية أي محتوى — بل عدّادات استخدام قصيرة العمر تتجدد مع الوقت، فلا يوجد ما يُحذف هناك.',
          'تُحفظ الروابط القصيرة التي تنشئها لمدة ٦ أشهر ثم تنتهي وتُحذف تلقائيًا، ويمكنك أيضًا حذفها بنفسك في أي وقت.',
          'تُحذف اشتراكات تنبيهات الصلاة والأذكار (التي تحوي إحداثياتك) فور إيقاف التنبيهات، وتلقائيًا بعد ٩٠ يومًا من الخمول. وتُحذف روابط الاتصال الشخصية بعد ٦ أشهر من آخر استخدام، أو متى أزلتها.',
        ],
      },
      {
        h: 'التواصل',
        p: ['للأسئلة أو طلبات الحذف: bjorn.a.goransson@gmail.com.'],
      },
    ],
  },
}

export function PrivacyPage() {
  const { locale } = useLocale()
  const s = STR[locale]
  useDocumentMeta(locale, '/privacy', s.title, s.intro.slice(0, 155))
  return (
    <>
      <LegalDoc title={s.title} updated={s.updated} intro={s.intro} sections={s.sections} />
      <DeleteMyData locale={locale} />
    </>
  )
}

/** Sign in with Google to see everything stored for you, and delete it. */
function DeleteMyData({ locale }: { locale: 'en' | 'ar' }) {
  const t = locale === 'ar'
    ? { h: 'بياناتي', p: 'سجّل الدخول بحساب Google لترى كل ما نخزّنه عنك وتحذفه بنقرة واحدة.', page: 'صفحة حجز', none: 'لا شيء', bookings: 'حجوزات', cv: 'مرات استخدام مولّد السيرة', savedCv: 'سيرة محفوظة', links: 'روابط مختصرة', prompt: 'مرات تحليل الموجّهات', diac: 'مرات التشكيل', todos: 'قوائم مهام', todosShared: 'قوائم مشتركة معك', yes: 'نعم', del: 'احذف كل بياناتي', deleting: 'جارٍ الحذف…', done: 'حُذفت جميع بياناتك.', err: 'حدث خطأ، حاول مجددًا.', nothing: 'لا نخزّن أي بيانات باسمك.', localH: 'هذا المتصفح', localP: 'تتذكّر بعض الأدوات اختياراتك في هذا المتصفح فقط (الأسماء، القوائم المحفوظة، التفضيلات) — لا تُرفع إلى أي خادم. امسح كل ذلك من هنا؛ يؤثر على هذا الجهاز فقط ولا يمكن التراجع عنه.', clearLocal: 'امسح بيانات هذا المتصفح', confirmLocal: 'اضغط مرة أخرى للتأكيد', clearedLocal: (n: number) => `تم مسح ${n} عنصرًا من هذا المتصفح.`, download: 'تنزيل بياناتي', browserItems: (n: number) => `لديك ${n} عنصرًا مخزّنًا في هذا المتصفح.`, serverTotal: (n: number) => `نحتفظ بـ ${n} إدخالًا يخصّك.` }
    : { h: 'My data', p: 'Sign in with Google to see everything we store for you and delete it in one click.', page: 'Booking page', none: 'none', bookings: 'Bookings', cv: 'CV generator runs', savedCv: 'Saved CV', links: 'Short links', prompt: 'Prompt analyses', diac: 'Diacritization runs', todos: 'To-do lists', todosShared: 'To-do lists shared with you', yes: 'yes', del: 'Delete all my data', deleting: 'Deleting…', done: 'All your data has been deleted.', err: 'Something went wrong — please try again.', nothing: 'We store nothing under your account.', localH: 'This browser', localP: 'Some tools remember your choices in this browser only (names, saved lists, preferences) — none of it is uploaded anywhere. Clear all of it here; this affects only this device and can’t be undone.', clearLocal: 'Clear this browser’s data', confirmLocal: 'Click again to confirm', clearedLocal: (n: number) => `Cleared ${n} item${n === 1 ? '' : 's'} from this browser.`, download: 'Download my data', browserItems: (n: number) => `You have ${n} item${n === 1 ? '' : 's'} stored in this browser.`, serverTotal: (n: number) => `We hold ${n} ${n === 1 ? 'entry' : 'entries'} for you.` }
  const [idToken, setIdToken] = useState('')
  const [report, setReport] = useState<MyDataReport | null>(null)
  const [status, setStatus] = useState<'idle' | 'loading' | 'deleting' | 'done' | 'error'>('idle')
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    loadGis().then((gis) => {
      if (cancelled) return
      gis.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (r) => {
          setIdToken(r.credential)
          setStatus('loading')
          try { const res = await myData(r.credential); setReport(res.report); setStatus('idle') } catch { setStatus('error') }
        },
      })
      if (btnRef.current) gis.renderButton(btnRef.current, { theme: 'outline', size: 'medium', text: 'signin_with' })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  async function del() {
    if (!idToken) return
    setStatus('deleting')
    try { await myData(idToken, true); setStatus('done'); setReport((r) => (r ? { ...r, bookingPage: null, bookings: 0, cvRuns: 0, savedCv: false, shortLinks: 0, promptRuns: 0, diacritizeRuns: 0, todoLists: 0, todoListsSharedWithMe: 0 } : r)) } catch { setStatus('error') }
  }

  // Local (this-browser-only) data — independent of the server "my data" above. A
  // two-click confirm since it wipes every tool's remembered choices at once.
  const [localMsg, setLocalMsg] = useState('')
  const [confirmLocal, setConfirmLocal] = useState(false)
  const localCount = (() => { try { return localStorage.length + sessionStorage.length } catch { return 0 } })()
  function clearLocal() {
    if (!confirmLocal) { setConfirmLocal(true); return }
    let n = 0
    try { n = localStorage.length; localStorage.clear() } catch { /* */ }
    try { sessionStorage.clear() } catch { /* */ }
    setConfirmLocal(false); setLocalMsg(t.clearedLocal(n))
  }
  // Download everything we hold in THIS browser (plus the signed-in account report,
  // if loaded) as one JSON file — a self-serve data export.
  function downloadData() {
    const grab = (s: Storage) => { const o: Record<string, string> = {}; try { for (let i = 0; i < s.length; i++) { const k = s.key(i); if (k) o[k] = s.getItem(k) ?? '' } } catch { /* */ } return o }
    const dump = { exportedAt: new Date().toISOString(), origin: location.origin, localStorage: grab(localStorage), sessionStorage: grab(sessionStorage), ...(report ? { account: report } : {}) }
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a'); a.href = url; a.download = 'built-in-saudi-my-data.json'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const empty = report && !report.bookingPage && report.bookings === 0 && report.cvRuns === 0 && !report.savedCv && (report.shortLinks || 0) === 0 && (report.promptRuns || 0) === 0 && (report.diacritizeRuns || 0) === 0 && (report.todoLists || 0) === 0 && (report.todoListsSharedWithMe || 0) === 0
  // How many rows we hold server-side — shown before the delete so the user knows
  // exactly what they're removing.
  const serverTotal = report ? (report.bookingPage ? 1 : 0) + report.bookings + report.cvRuns + (report.savedCv ? 1 : 0) + (report.shortLinks || 0) + (report.promptRuns || 0) + (report.diacritizeRuns || 0) + (report.todoLists || 0) + (report.todoListsSharedWithMe || 0) : 0

  return (
    <div className="wrap max-w-[46rem] pb-[clamp(1.5rem,4vw,2.5rem)]">
      <section className="flex flex-col gap-3 rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5">
        <h2 className="font-display text-[1.2rem] text-ink">{t.h}</h2>
        <p className="text-[0.95rem] text-ink-soft leading-relaxed">{t.p}</p>
        {!report && <div ref={btnRef} data-testid="mydata-signin" className="[color-scheme:light]" />}
        {status === 'loading' && <Spinner className="size-5" />}
        {report && (
          status === 'done' || empty ? (
            <p className="text-[0.95rem] font-semibold text-green-700">{status === 'done' ? t.done : t.nothing}</p>
          ) : (
            <div className="flex flex-col gap-2">
              <ul className="text-[0.9rem] text-ink-soft flex flex-col gap-1 [&_b]:text-ink">
                <li>{t.page}: <b>{report.bookingPage ? `✓ (${report.bookingPage.meetingTypes})` : t.none}</b></li>
                <li>{t.bookings}: <b>{report.bookings}</b></li>
                <li>{t.cv}: <b>{report.cvRuns}</b></li>
                {report.savedCv && <li>{t.savedCv}: <b>✓</b></li>}
                <li>{t.links}: <b>{report.shortLinks || 0}</b></li>
                <li>{t.prompt}: <b>{report.promptRuns || 0}</b></li>
                <li>{t.diac}: <b>{report.diacritizeRuns || 0}</b></li>
                <li>{t.todos}: <b>{report.todoLists || 0}</b></li>
                {!!report.todoListsSharedWithMe && <li>{t.todosShared}: <b>{report.todoListsSharedWithMe}</b></li>}
              </ul>
              <p className="text-[0.9rem] font-semibold text-ink" data-testid="mydata-total">{t.serverTotal(serverTotal)}</p>
              <Button variant="primary" data-testid="mydata-delete" disabled={status === 'deleting'} onClick={del} className="self-start !bg-gold-500 !border-gold-500 hover:!bg-gold-400">
                {status === 'deleting' ? t.deleting : t.del}
              </Button>
            </div>
          )
        )}
        {status === 'error' && <p className="text-[0.9rem] text-gold-500">{t.err}</p>}
      </section>

      <section className="flex flex-col gap-3 rounded-lg border border-[color:var(--line)] bg-[var(--surface)] p-5 mt-4">
        <h2 className="font-display text-[1.2rem] text-ink">{t.localH}</h2>
        <p className="text-[0.95rem] text-ink-soft leading-relaxed">{t.localP}</p>
        <p className="text-[0.9rem] font-semibold text-ink" data-testid="local-count">{t.browserItems(localCount)}</p>
        {localMsg
          ? <p className="text-[0.95rem] font-semibold text-green-700" data-testid="local-cleared">{localMsg}</p>
          : (
            <div className="flex flex-wrap gap-2">
              <Button data-testid="download-data" onClick={downloadData}>{t.download}</Button>
              <Button data-testid="clear-local" onClick={clearLocal} className={confirmLocal ? '!bg-gold-500 !border-gold-500 hover:!bg-gold-400 !text-white' : ''}>
                {confirmLocal ? t.confirmLocal : t.clearLocal}
              </Button>
            </div>
          )}
      </section>
    </div>
  )
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
