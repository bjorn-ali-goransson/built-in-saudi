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
  resize: string
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
  fromLinkTitle: string
  fromLinkBody: string
  clashTitle: string
  clashCount: (count: number) => string
  qrProblemTitle: string
  qrTooLong: (bytes: number) => string
  qrTooDense: (modules: number) => string
  whyAxisTitle: string
  whyAxisBody: string
  whyIconTitle: string
  whyIconBody: string
  whyShareTitle: string
  whyShareBody: string
  related: string
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
    move: 'Drag to reorder — the rest of the day moves to make room. Arrow keys do the same; hold Shift to change the length.',
    resize: 'Drag to change how long it lasts',
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
    fromLinkTitle: 'Opened from a link',
    fromLinkBody: 'This schedule came from the link or the QR code you followed. It is not saved on this device yet — edit it freely and press Save when you want to keep it. Nothing was fetched from a server: the whole sheet travelled inside the link itself.',
    clashTitle: 'Two things at once',
    clashCount: (c) => `${n('en', c)} ${c === 1 ? 'activity overlaps another' : 'activities overlap others'} on the same day, or sit outside the hours the sheet covers. They are marked in red on the sheet, side by side so neither is hidden under the other.`,
    qrProblemTitle: 'This schedule will not fit in a QR code',
    qrTooLong: (b) => `The link is ${n('en', b)} bytes and a QR code holds at most 2,953. The PDF still prints; it simply carries no code. Shorter activity names or fewer rows will bring it back — or share the link itself, which has no limit.`,
    qrTooDense: (m) => `The code would be ${n('en', m)} modules across, which printed on A4 is finer than a phone camera can resolve — so it would look like a working QR and not be one. The PDF still prints without it. Share the link instead, or shorten the sheet.`,
    whyAxisTitle: 'One axis, and the days are free to differ',
    whyAxisBody: 'The sheet this was built from repeats a time column inside all five day cards — the same value written five times, so five things that can drift apart. It had a period written 9:30 – 9:30, another 10:00 – 19:30, and a third that lost its end time. Here there is one axis down the side and activities sit on it, which is how a real schedule works. Within a day they are an ORDER: drag a lesson where you want it and the rest of the day moves to make room, keeping its own start, each activity’s own length, and the breaks where they were — so a day cannot grow a hole, run long, or put two things at once. The days are not locked to each other, though: a different order, a longer lesson or an early finish on Thursday are the ordinary shape of a week.',
    whyIconTitle: 'The icon remembers, across every schedule',
    whyIconBody: 'Pick an icon for an activity once and every later cell with that name gets it — in this sheet and in next term’s. Spelling is folded the way Arabic needs it, so «قرآن» and «القرآن» are the same activity rather than two. Until you choose, the icon is guessed from the words in the name; a guess never overrules a choice.',
    whyShareTitle: 'The link carries the schedule, not a lookup',
    whyShareBody: 'Everything after the # in the share link IS the schedule, compressed into a dictionary of the names and times it repeats. That part of a URL is never sent to a server, so there is nothing stored anywhere, no account, and no link to expire. The QR code on the PDF is the same link, which is why it is large: it is carrying the sheet rather than pointing at it.',
    related: 'A plain grid with no icons: Weekly Timetable',
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
    move: 'اسحب لتغيير ترتيبه — وتتزحزح بقية اليوم لتفسح له. والأسهم تفعل الشيء نفسه؛ واضغط Shift لتغيير مدته.',
    resize: 'اسحب لتغيير مدة النشاط',
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
    fromLinkTitle: 'فُتح من رابط',
    fromLinkBody: 'جاء هذا الجدول من الرابط أو رمز الاستجابة الذي فتحته، وهو غير محفوظ على هذا الجهاز بعد — حرّره كما تشاء واضغط «احفظ» إن أردت الإبقاء عليه. ولم يُجلب شيء من أي خادم: فالورقة كلها سافرت داخل الرابط نفسه.',
    clashTitle: 'شيئان في وقت واحد',
    clashCount: (c) => `${n('ar', c)} من الأنشطة يتداخل مع نشاط آخر في اليوم نفسه، أو يقع خارج ساعات الورقة. وهي مُعلَّمة بالأحمر على الورقة، ومرصوفة جنبًا إلى جنب كي لا يختفي أحدها تحت الآخر.`,
    qrProblemTitle: 'هذا الجدول لا يتسع في رمز استجابة',
    qrTooLong: (b) => `طول الرابط ${n('ar', b)} بايت، ورمز الاستجابة يحمل ٢٩٥٣ بايت على الأكثر. وملف PDF يُطبع كما هو، غير أنه بلا رمز. واختصار أسماء الأنشطة أو تقليل الصفوف يعيده — أو شارك الرابط نفسه، فلا حدّ له.`,
    qrTooDense: (m) => `سيكون عرض الرمز ${n('ar', m)} وحدة، وهذا مطبوعًا على ورقة A4 أدقّ مما تستطيع كاميرا الهاتف تمييزه — فيبدو رمزًا صالحًا وليس كذلك. وملف PDF يُطبع بدونه. شارك الرابط بدلًا منه، أو اختصر الورقة.`,
    whyAxisTitle: 'محور واحد، والأيام حرة أن تختلف',
    whyAxisBody: 'الورقة التي بُنيت عنها هذه الأداة تكرّر عمود الوقت داخل أيام الأسبوع الخمسة — القيمة نفسها مكتوبة خمس مرات، فخمسة أشياء قابلة للانحراف. وقد جاء فيها ٩:٣٠ – ٩:٣٠، و١٠:٠٠ – ١٩:٣٠، وفترة سقط منها وقت النهاية. وهنا محور واحد على الجانب تجلس عليه الأنشطة، وهكذا تعمل الجداول الحقيقية. وداخل اليوم الواحد هي ترتيب: اسحب الحصة إلى موضعها فتتزحزح بقية اليوم لتفسح لها، مع بقاء بداية اليوم، ومدة كل نشاط، ومواضع الفسح كما هي — فلا يصير في اليوم ثقب، ولا يطول عن حدّه، ولا يقع فيه شيئان في وقت واحد. غير أن الأيام ليست مقيَّدة ببعضها: فترتيب مختلف، أو حصة أطول، أو انصراف مبكر يوم الخميس، هو الشكل المعتاد للأسبوع.',
    whyIconTitle: 'الأيقونة تتذكّر، عبر كل جداولك',
    whyIconBody: 'اختر أيقونة لنشاط مرة واحدة، فتأخذها كل خانة تحمل الاسم نفسه لاحقًا — في هذه الورقة وفي ورقة الفصل القادم. وتُوحَّد الإملاء بما تقتضيه العربية، فـ«قرآن» و«القرآن» نشاط واحد لا اثنان. وقبل أن تختار، تُخمَّن الأيقونة من كلمات الاسم؛ ولا يَنسخ التخمينُ اختيارًا.',
    whyShareTitle: 'الرابط يحمل الجدول، لا إشارة إليه',
    whyShareBody: 'ما بعد علامة # في رابط المشاركة هو الجدولُ نفسه، مضغوطًا في قاموس للأسماء والأوقات التي تتكرر فيه. وهذا الجزء من الرابط لا يُرسل إلى أي خادم، فلا شيء مخزَّن في أي مكان، ولا حساب، ولا رابط ينتهي. ورمز الاستجابة في ملف PDF هو الرابط ذاته، ولهذا هو كبير: فهو يحمل الورقة لا يشير إليها.',
    related: 'شبكة بسيطة بلا أيقونات: الجدول الأسبوعي',
    trouble: (t) =>
      t.kind === 'overlap'
        ? `في وقت «${t.with}» نفسه.`
        : 'خارج ساعات هذه الورقة.',
  },
}
