import type { Dict } from './en'

// Arabic dictionary. Must match the shape of `en` (typed as Dict).
// Note: QR code is colloquially "باركود" in Saudi usage.
export const ar: Dict = {
  dir: 'rtl',
  nav: { tools: 'الأدوات', source: 'المصدر' },

  hero: {
    kicker: 'بُنِيَ في السعودية',
    title1: 'أدواتٌ صغيرةٌ ودقيقة.',
    title2: 'بلا إعلانات، بلا مقابل.',
    lede:
      'الأدوات اليومية التي تبحث عنها دائمًا — الباركود، والمُحوِّلات، والمُولِّدات — مجموعةٌ في صندوق أدوات واحد وصادق. مجانية وسريعة وخاصة: لا يُرفع أي شيء، وكل شيء يعمل داخل متصفحك.',
    badgeDevice: 'يعمل على جهازك',
    badgeNoAds: 'بلا تسجيل، بلا إعلانات',
    badgeOpen: 'مفتوح المصدر',
  },

  catalog: {
    title: 'صندوق الأدوات',
    count: (live: number, soon: number) => `${live} متاحة · ${soon} قادمة`,
    searchPlaceholder: 'ابحث عن أداة — جرّب «واي فاي»، «PDF»، «تحويل»…',
    searchAria: 'ابحث عن أداة',
    clear: 'مسح البحث',
    empty: (q: string) => `لا توجد أدوات تطابق «${q}» بعد — لكن صندوق الأدوات ينمو.`,
  },

  card: { comingSoon: 'قريباً', beta: 'تجريبي', open: 'افتح' },

  toolPage: { breadcrumb: 'الأدوات' },

  footer: {
    ethos: 'مجاني ومفتوح. بياناتك لا تغادر جهازك — كل أداة تعمل بالكامل داخل متصفحك.',
    made: 'صُنع بعناية في المملكة العربية السعودية',
    allTools: 'كل التطبيقات',
    github: 'GitHub',
    reportIssue: 'أبلغ عن مشكلة',
    privacy: 'الخصوصية',
    terms: 'الشروط',
  },

  notif: {
    title: 'مرحباً 👋',
    message:
      'وصلت أدوات جديدة — مواقيت الصلاة، ومولّد كلمات المرور، ومولّد الباركود. كلها مجانية وخاصة. والمزيد قادم.',
    open: 'فتح الإشعار',
    minimize: 'تصغير الإشعار',
    dismiss: 'إغلاق الإشعار',
  },

  notFound: {
    code: '404',
    title: 'لا شيء هنا',
    body: 'تعذّر العثور على هذه الصفحة. ربما تغيّر مكانها أو لم تكن موجودة أصلاً.',
    soonCode: 'قريباً',
    soonTitle: (tool: string) => `${tool} في الطريق`,
    soonBody:
      'هذه الأداة ضمن خارطة الطريق وقيد الإنشاء. عُد قريباً — أو استكشف الأدوات الجاهزة اليوم.',
    back: 'العودة إلى صندوق الأدوات',
  },

  langSuggest: {
    message: 'هذا الموقع متاح بالعربية. هل تريد التبديل؟',
    switch: 'التبديل إلى العربية',
    dismiss: 'ليس الآن',
  },
  languageName: 'العربية',
  switchLanguage: 'English',

  qr: {
    types: { link: 'رابط', text: 'نص', wifi: 'واي فاي', email: 'بريد', phone: 'هاتف' },
    fieldUrl: 'الموقع / الرابط',
    fieldText: 'النص',
    fieldSsid: 'اسم الشبكة (SSID)',
    fieldPassword: 'كلمة المرور',
    fieldSecurity: 'نوع الحماية',
    secWpa: 'WPA / WPA2 / WPA3',
    secWep: 'WEP',
    secNone: 'بدون (شبكة مفتوحة)',
    hidden: 'شبكة مخفية',
    fieldTo: 'إلى',
    fieldSubject: 'الموضوع',
    fieldMessage: 'الرسالة',
    fieldPhone: 'رقم الهاتف',
    style: 'التنسيق',
    errorCorrection: 'تصحيح الأخطاء',
    exportSize: 'حجم التصدير',
    quietZone: 'الهامش',
    foreground: 'اللون الأمامي',
    background: 'الخلفية',
    png: 'PNG',
    svg: 'SVG',
    copy: 'نسخ',
    copied: 'تم النسخ!',
    encodes: 'يُشفّر',
    empty: 'املأ الحقول لإنشاء الباركود الخاص بك.',
    privacy: 'يُنشأ محليًا — لا يُرفع أي شيء.',
    copyUnsupported: 'نسخ الصور غير مدعوم في هذا المتصفح — استخدم التنزيل بدلاً من ذلك.',
    share: 'مشاركة',
    download: 'تنزيل',
    advanced: 'إعدادات متقدمة',
    type: 'النوع',
    size: 'الحجم',
    sizeSmall: 'صغير',
    sizeMedium: 'متوسط',
    sizeLarge: 'كبير',
    sizeHD: 'فائق الدقة',
    sizeCustom: 'مخصص',
    theme: 'الثيم',
    randomTheme: 'فاجئني',
    dotStyle: 'النمط',
    frame: 'الإطار',
    logo: 'شعار في المنتصف',
    addLogo: 'إضافة صورة',
    removeLogo: 'إزالة',
    dots: { square: 'مربّع', dots: 'دوائر', rounded: 'مستدير', cube: 'مكعبات ثلاثية', liquid: 'سائل', emoji: 'إيموجي' },
    placeholderUrl: 'example.com',
    placeholderText: 'أي نص لتشفيره…',
    placeholderSsid: 'اسم شبكتي',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+966 5X XXX XXXX',
  },
}
