import type { Trouble } from './schedule'

/**
 * Numbers we generate go through the locale's own formatter.
 *
 * `toFixed` and template interpolation return Latin digits whatever the
 * locale, which is how an Arabic page ends up reading `3 أوقات` — the exact
 * failure `ovulation` and `retirement-age` both shipped once. A time the user
 * TYPED is left alone: it is their text, and the reference sheets write times
 * in Latin digits anyway.
 */
const n = (locale: 'en' | 'ar', x: number) =>
  x.toLocaleString(locale === 'ar' ? 'ar-SA' : 'en-GB')

export interface Strings {
  intro: string
  titleLabel: string
  noteLabel: string
  groupLabel: string
  weekend: string
  art: string
  activity: string
  time: string
  iconLabel: string
  clearIcon: string
  move: string
  settings: string
  menu: string
  hideArt: string
  longer: string
  shorter: string
  done: string
  suggestionsLabel: string
  addTo: (day: string) => string
  copyDay: (day: string) => string
  copiedDay: string
  dayStart: string
  dayEnd: string
  save: string
  newOne: string
  share: string
  copied: string
  download: string
  working: string
  empty: string
  starters: string
  mine: string
  untitled: string
  remove: string
  scanToEdit: string
  clashCount: (count: number) => string
  qrTooLong: (bytes: number) => string
  qrTooDense: (modules: number) => string
  trouble: (t: Trouble) => string
}

export const STR: Record<'en' | 'ar', Strings> = {
  en: {
    intro: 'Build a weekly activity schedule with an icon on every activity, keep as many as you like, and share the whole sheet as a link. Everything stays in your browser.',
    titleLabel: 'Title',
    noteLabel: 'Line under the title',
    groupLabel: 'Class',
    weekend: 'Include Friday and Saturday',
    art: 'Illustrated header and footer',
    activity: 'Activity',
    time: 'Time',
    iconLabel: 'Icon for this activity',
    clearIcon: 'No icon',
    move: 'Tap to edit. Drag to reorder — the rest of the day moves to make room, and another day will take it. Arrow keys do the same; hold Shift to change the length.',
    settings: 'Settings',
    menu: 'Schedules',
    hideArt: 'Remove the illustrations',
    longer: 'Fifteen minutes longer',
    shorter: 'Fifteen minutes shorter',
    done: 'Done',
    suggestionsLabel: 'Used before',
    addTo: (d) => `Add an activity to ${d}`,
    copyDay: (d) => `Copy ${d} to every other day`,
    copiedDay: 'Copied to the rest of the week.',
    dayStart: 'Day starts',
    dayEnd: 'Day ends',
    save: 'Save this schedule',
    newOne: 'Start a new one',
    share: 'Copy the share link',
    copied: 'Link copied',
    download: 'Download the PDF',
    working: 'Preparing…',
    empty: 'Add an activity to any day with +, then drag it where it belongs.',
    starters: 'Or start from a ready-made one:',
    mine: 'Your saved schedules',
    untitled: 'Untitled',
    remove: 'Delete',
    scanToEdit: 'Scan to edit this schedule',
    clashCount: (c) => `${n('en', c)} ${c === 1 ? 'activity overlaps another' : 'activities overlap others'} on the same day, or sit outside the hours the sheet covers. They are marked in red on the sheet, side by side so neither is hidden under the other.`,
    qrTooLong: (b) => `The link is ${n('en', b)} bytes and a QR code holds at most 2,953. The PDF still prints; it simply carries no code. Shorter activity names or fewer rows will bring it back — or share the link itself, which has no limit.`,
    qrTooDense: (m) => `The code would be ${n('en', m)} modules across, which printed on A4 is finer than a phone camera can resolve — so it would look like a working QR and not be one. The PDF still prints without it. Share the link instead, or shorten the sheet.`,
    trouble: (t) =>
      t.kind === 'overlap'
        ? `At the same time as ${t.with}.`
        : 'Outside the hours this sheet covers.',
  },
  ar: {
    intro: 'ابنِ جدول أنشطة أسبوعيًا بأيقونة لكل نشاط، واحفظ ما شئت من الجداول، وشارك الورقة كاملة برابط واحد. ويبقى كل شيء داخل متصفحك.',
    titleLabel: 'العنوان',
    noteLabel: 'سطر تحت العنوان',
    groupLabel: 'الفصل',
    weekend: 'أضف الجمعة والسبت',
    art: 'ترويسة وتذييل مزخرفان',
    activity: 'النشاط',
    time: 'الوقت',
    iconLabel: 'أيقونة هذا النشاط',
    clearIcon: 'بلا أيقونة',
    move: 'انقر للتحرير. واسحب لتغيير ترتيبه — فتتزحزح بقية اليوم لتفسح له، ويستقبله يوم آخر. والأسهم تفعل الشيء نفسه؛ واضغط Shift لتغيير مدته.',
    settings: 'الإعدادات',
    menu: 'الجداول',
    hideArt: 'أزل الزخارف',
    longer: 'أطول بربع ساعة',
    shorter: 'أقصر بربع ساعة',
    done: 'تم',
    suggestionsLabel: 'استُعمل من قبل',
    addTo: (d) => `أضف نشاطًا إلى ${d}`,
    copyDay: (d) => `انسخ ${d} إلى بقية الأيام`,
    copiedDay: 'نُسخ إلى بقية الأسبوع.',
    dayStart: 'يبدأ اليوم',
    dayEnd: 'ينتهي اليوم',
    save: 'احفظ هذا الجدول',
    newOne: 'ابدأ جدولًا جديدًا',
    share: 'انسخ رابط المشاركة',
    copied: 'تم نسخ الرابط',
    download: 'نزّل ملف PDF',
    working: 'جارٍ التجهيز…',
    empty: 'أضف نشاطًا إلى أي يوم بعلامة +، ثم اسحبه إلى موضعه.',
    starters: 'أو ابدأ من جدول جاهز:',
    mine: 'جداولك المحفوظة',
    untitled: 'بلا عنوان',
    remove: 'احذف',
    scanToEdit: 'امسح الرمز لتحرير هذا الجدول',
    clashCount: (c) => `${n('ar', c)} من الأنشطة يتداخل مع نشاط آخر في اليوم نفسه، أو يقع خارج ساعات الورقة. وهي مُعلَّمة بالأحمر على الورقة، ومرصوفة جنبًا إلى جنب كي لا يختفي أحدها تحت الآخر.`,
    qrTooLong: (b) => `طول الرابط ${n('ar', b)} بايت، ورمز الاستجابة يحمل ٢٩٥٣ بايت على الأكثر. وملف PDF يُطبع كما هو، غير أنه بلا رمز. واختصار أسماء الأنشطة أو تقليل الصفوف يعيده — أو شارك الرابط نفسه، فلا حدّ له.`,
    qrTooDense: (m) => `سيكون عرض الرمز ${n('ar', m)} وحدة، وهذا مطبوعًا على ورقة A4 أدقّ مما تستطيع كاميرا الهاتف تمييزه — فيبدو رمزًا صالحًا وليس كذلك. وملف PDF يُطبع بدونه. شارك الرابط بدلًا منه، أو اختصر الورقة.`,
    trouble: (t) =>
      t.kind === 'overlap'
        ? `في وقت «${t.with}» نفسه.`
        : 'خارج ساعات هذه الورقة.',
  },
}
