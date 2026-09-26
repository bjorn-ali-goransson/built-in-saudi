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
  weekend: string
  art: string
  activity: string
  time: string
  iconLabel: string
  clearIcon: string
  fix: string
  alignRow: string
  alignAll: string
  addRow: string
  removeRow: string
  save: string
  newOne: string
  share: string
  copied: string
  download: string
  working: string
  empty: string
  mine: string
  untitled: string
  remove: string
  scanToEdit: string
  fromLinkTitle: string
  fromLinkBody: string
  harmonyTitle: string
  harmonyCount: (count: number) => string
  qrProblemTitle: string
  qrTooLong: (bytes: number) => string
  qrTooDense: (modules: number) => string
  whyHarmonyTitle: string
  whyHarmonyBody: string
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
    weekend: 'Include Friday and Saturday',
    art: 'Illustrated header and footer',
    activity: 'Activity',
    time: 'Time',
    iconLabel: 'Icon for this activity',
    clearIcon: 'No icon',
    fix: 'Match',
    alignRow: 'Line up row',
    alignAll: 'Line up every row',
    addRow: 'Add a row',
    removeRow: 'Remove the last row',
    save: 'Save this schedule',
    newOne: 'Start a new one',
    share: 'Copy the share link',
    copied: 'Link copied',
    download: 'Download the PDF',
    working: 'Preparing…',
    empty: 'Type an activity into any day and the sheet fills in.',
    mine: 'Your saved schedules',
    untitled: 'Untitled',
    remove: 'Delete',
    scanToEdit: 'Scan to edit this schedule',
    fromLinkTitle: 'Opened from a link',
    fromLinkBody: 'This schedule came from the link or the QR code you followed. It is not saved on this device yet — edit it freely and press Save when you want to keep it. Nothing was fetched from a server: the whole sheet travelled inside the link itself.',
    harmonyTitle: 'Some times do not line up',
    harmonyCount: (c) => `${n('en', c)} ${c === 1 ? 'time disagrees' : 'times disagree'} with the rest of their row, or cannot be read as a period at all. Each one is marked on the sheet with the time the rest of that row uses.`,
    qrProblemTitle: 'This schedule will not fit in a QR code',
    qrTooLong: (b) => `The link is ${n('en', b)} bytes and a QR code holds at most 2,953. The PDF still prints; it simply carries no code. Shorter activity names or fewer rows will bring it back — or share the link itself, which has no limit.`,
    qrTooDense: (m) => `The code would be ${n('en', m)} modules across, which printed on A4 is finer than a phone camera can resolve — so it would look like a working QR and not be one. The PDF still prints without it. Share the link instead, or shorten the sheet.`,
    whyHarmonyTitle: 'Why it checks the times across a row',
    whyHarmonyBody: 'The sheet this was built from — a real kindergarten wall chart — had four rows where one day had drifted from the rest: a period written 9:30 – 9:30, another 10:00 – 19:30, a third that simply lost its end time. Nobody proof-reads a wall chart column by column, which is exactly why a tool should. The time lives on each cell rather than on the row, because a single time per row would make the disagreement impossible to represent — and the chart on the wall says it happens anyway.',
    whyIconTitle: 'The icon remembers, across every schedule',
    whyIconBody: 'Pick an icon for an activity once and every later cell with that name gets it — in this sheet and in next term’s. Spelling is folded the way Arabic needs it, so «قرآن» and «القرآن» are the same activity rather than two. Until you choose, the icon is guessed from the words in the name; a guess never overrules a choice.',
    whyShareTitle: 'The link carries the schedule, not a lookup',
    whyShareBody: 'Everything after the # in the share link IS the schedule, compressed into a dictionary of the names and times it repeats. That part of a URL is never sent to a server, so there is nothing stored anywhere, no account, and no link to expire. The QR code on the PDF is the same link, which is why it is large: it is carrying the sheet rather than pointing at it.',
    related: 'A plain grid with no icons: Weekly Timetable',
    trouble: (t) => {
      if (t.kind === 'odd') return `The rest of this row says ${t.expected}.`
      if (t.kind === 'missing') return `No time. The row says ${t.expected}.`
      if (t.kind === 'backwards') return 'This ends before it starts.'
      return 'This starts and ends at the same minute.'
    },
  },
  ar: {
    intro: 'ابنِ جدول أنشطة أسبوعيًا بأيقونة لكل نشاط، واحفظ ما شئت من الجداول، وشارك الورقة كاملة برابط واحد. ويبقى كل شيء داخل متصفحك.',
    titleLabel: 'العنوان',
    noteLabel: 'سطر تحت العنوان',
    weekend: 'أضف الجمعة والسبت',
    art: 'ترويسة وتذييل مزخرفان',
    activity: 'النشاط',
    time: 'الوقت',
    iconLabel: 'أيقونة هذا النشاط',
    clearIcon: 'بلا أيقونة',
    fix: 'وحّد',
    alignRow: 'وحّد الصف',
    alignAll: 'وحّد كل الصفوف',
    addRow: 'أضف صفًا',
    removeRow: 'احذف آخر صف',
    save: 'احفظ هذا الجدول',
    newOne: 'ابدأ جدولًا جديدًا',
    share: 'انسخ رابط المشاركة',
    copied: 'تم نسخ الرابط',
    download: 'نزّل ملف PDF',
    working: 'جارٍ التجهيز…',
    empty: 'اكتب نشاطًا في أي يوم وستمتلئ الورقة.',
    mine: 'جداولك المحفوظة',
    untitled: 'بلا عنوان',
    remove: 'احذف',
    scanToEdit: 'امسح الرمز لتحرير هذا الجدول',
    fromLinkTitle: 'فُتح من رابط',
    fromLinkBody: 'جاء هذا الجدول من الرابط أو رمز الاستجابة الذي فتحته، وهو غير محفوظ على هذا الجهاز بعد — حرّره كما تشاء واضغط «احفظ» إن أردت الإبقاء عليه. ولم يُجلب شيء من أي خادم: فالورقة كلها سافرت داخل الرابط نفسه.',
    harmonyTitle: 'بعض الأوقات غير متوافقة',
    harmonyCount: (c) => `${n('ar', c)} من الأوقات يخالف بقية صفه، أو لا يُقرأ كفترة زمنية أصلًا. وكل واحد منها مُعلَّم على الورقة بالوقت الذي تستعمله بقية الصف.`,
    qrProblemTitle: 'هذا الجدول لا يتسع في رمز استجابة',
    qrTooLong: (b) => `طول الرابط ${n('ar', b)} بايت، ورمز الاستجابة يحمل ٢٩٥٣ بايت على الأكثر. وملف PDF يُطبع كما هو، غير أنه بلا رمز. واختصار أسماء الأنشطة أو تقليل الصفوف يعيده — أو شارك الرابط نفسه، فلا حدّ له.`,
    qrTooDense: (m) => `سيكون عرض الرمز ${n('ar', m)} وحدة، وهذا مطبوعًا على ورقة A4 أدقّ مما تستطيع كاميرا الهاتف تمييزه — فيبدو رمزًا صالحًا وليس كذلك. وملف PDF يُطبع بدونه. شارك الرابط بدلًا منه، أو اختصر الورقة.`,
    whyHarmonyTitle: 'لماذا تُفحص الأوقات عبر الصف الواحد',
    whyHarmonyBody: 'الورقة التي بُنيت عنها هذه الأداة — جدول روضة معلّق على جدار — فيها أربعة صفوف انحرف فيها يوم واحد عن بقية أيامه: فترة مكتوبة ٩:٣٠ – ٩:٣٠، وأخرى ١٠:٠٠ – ١٩:٣٠، وثالثة سقط منها وقت النهاية. ولا أحد يراجع جدولًا معلّقًا عمودًا عمودًا، وهذا وحده سبب كافٍ لأن تفعله الأداة. والوقت مرتبط بكل خانة لا بالصف، لأن وقتًا واحدًا للصف يجعل الاختلاف غير قابل للتمثيل أصلًا — والجدار يقول إنه يقع رغم ذلك.',
    whyIconTitle: 'الأيقونة تتذكّر، عبر كل جداولك',
    whyIconBody: 'اختر أيقونة لنشاط مرة واحدة، فتأخذها كل خانة تحمل الاسم نفسه لاحقًا — في هذه الورقة وفي ورقة الفصل القادم. وتُوحَّد الإملاء بما تقتضيه العربية، فـ«قرآن» و«القرآن» نشاط واحد لا اثنان. وقبل أن تختار، تُخمَّن الأيقونة من كلمات الاسم؛ ولا يَنسخ التخمينُ اختيارًا.',
    whyShareTitle: 'الرابط يحمل الجدول، لا إشارة إليه',
    whyShareBody: 'ما بعد علامة # في رابط المشاركة هو الجدولُ نفسه، مضغوطًا في قاموس للأسماء والأوقات التي تتكرر فيه. وهذا الجزء من الرابط لا يُرسل إلى أي خادم، فلا شيء مخزَّن في أي مكان، ولا حساب، ولا رابط ينتهي. ورمز الاستجابة في ملف PDF هو الرابط ذاته، ولهذا هو كبير: فهو يحمل الورقة لا يشير إليها.',
    related: 'شبكة بسيطة بلا أيقونات: الجدول الأسبوعي',
    trouble: (t) => {
      if (t.kind === 'odd') return `بقية هذا الصف تقول ${t.expected}.`
      if (t.kind === 'missing') return `بلا وقت. والصف يقول ${t.expected}.`
      if (t.kind === 'backwards') return 'ينتهي قبل أن يبدأ.'
      return 'يبدأ وينتهي في الدقيقة نفسها.'
    },
  },
}
