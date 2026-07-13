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

/** Standalone (non-tool) pages that also get prerendered at /<locale>/<id>/. */
export const staticPageSeo: ToolSeo[] = [
  {
    id: 'privacy',
    en: { name: 'Privacy Policy', description: 'How Built in Saudi handles your data: almost everything runs in your browser and never leaves your device; the Book With Me scheduling tool and its Google Calendar use are explained in full.' },
    ar: { name: 'سياسة الخصوصية', description: 'كيف يتعامل «بُنِيَ في السعودية» مع بياناتك: يعمل كل شيء تقريبًا داخل متصفحك ولا يغادر جهازك؛ مع شرحٍ كامل لأداة «احجز معي» واستخدامها لتقويم جوجل.' },
  },
  {
    id: 'terms',
    en: { name: 'Terms of Use', description: 'The simple terms covering your use of Built in Saudi and its free tools, including Book With Me.' },
    ar: { name: 'شروط الاستخدام', description: 'الشروط البسيطة التي تغطي استخدامك لـ«بُنِيَ في السعودية» وأدواته المجانية، بما في ذلك «احجز معي».' },
  },
]

/** Live (routable) tools only — used to prerender /<locale>/tools/<id>/. */
export const liveToolSeo: ToolSeo[] = [
  {
    id: 'calls',
    en: { name: 'Private Call', description: 'Start a private, peer-to-peer video call from one shareable invite image (QR + link). Video, screen-share, a shared whiteboard, chat and file-drop go straight between browsers over WebRTC — only the initial handshake touches a tiny relay that never sees your call. Public STUN, no recording, small groups.' },
    ar: { name: 'مكالمة خاصة', description: 'ابدأ مكالمة فيديو خاصة مباشرة بين الأجهزة من صورة دعوة واحدة (رمز QR + رابط). الفيديو ومشاركة الشاشة والسبورة المشتركة والدردشة وإرسال الملفات تنتقل مباشرة بين المتصفحات عبر WebRTC — فقط المصافحة الأولى تمر بمُرحِّل صغير لا يرى مكالمتك. STUN عام، بلا تسجيل، لمجموعات صغيرة.' },
  },
  {
    id: 'prompt-analyzer',
    en: { name: 'Prompt Analyzer', description: 'Paste an LLM system prompt and one AI pass scores it 1–5 across eight dimensions — purpose coherence, context-vs-instruction harmony, spikiness, shoutiness, contradictions, framing, an escape hatch and downstream stakes — as a spider chart, with concrete issues listed. One analysis per 24 hours.' },
    ar: { name: 'محلّل الموجّهات', description: 'الصق موجّه نظام لنموذج لغوي فيقيّمه مرور واحد للذكاء الاصطناعي من ١ إلى ٥ عبر ثمانية أبعاد — تماسك الغرض وتناغم السياق مع التعليمات والحدّة والصياح والتناقضات والصياغة ومنفذ الخروج والاستخدام اللاحق — كمخطط عنكبوتي مع سرد المشكلات. تحليل واحد كل ٢٤ ساعة.' },
  },
  {
    id: 'regex-tester',
    en: { name: 'Regex Tester', description: 'Write a regular expression and see every match highlighted in your test text as you type, with capture groups and a live match count. Uses the native JavaScript engine, entirely in your browser — nothing is uploaded.' },
    ar: { name: 'مختبِر التعابير النمطية', description: 'اكتب تعبيرًا نمطيًا وشاهد كل مطابقة مُظلّلة في نصك أثناء الكتابة، مع مجموعات الالتقاط وعدّ حيّ للمطابقات. يستخدم محرّك JavaScript بالكامل في متصفحك — لا يُرفع أي شيء.' },
  },
  {
    id: 'jwt-decoder',
    en: { name: 'JWT Decoder', description: 'Paste a JSON Web Token to decode its header and payload into readable JSON, with expiry and issued-at times shown in local time. Decoding happens entirely in your browser — the token is never uploaded and the signature is not verified.' },
    ar: { name: 'مفكّك رموز JWT', description: 'الصق رمز JSON Web Token لفكّ ترويسته وحمولته إلى JSON مقروء، مع أوقات الانتهاء والإصدار بالتوقيت المحلي. يتم الفكّ بالكامل في متصفحك — لا يُرفع الرمز ولا يُتحقَّق من التوقيع.' },
  },
  {
    id: 'cron-explainer',
    en: { name: 'Cron Explainer', description: 'Paste a 5-field cron expression and get a plain-language description of when it runs, plus the next several run times in your local timezone. Supports ranges, steps and lists, computed in your browser.' },
    ar: { name: 'مفسّر Cron', description: 'الصق تعبير cron المكوَّن من خمسة حقول لتحصل على وصف واضح لموعد تشغيله وأوقات التشغيل القادمة بتوقيتك المحلي. يدعم النطاقات والخطوات والقوائم، ويُحسب في متصفحك.' },
  },
  {
    id: 'text-diff',
    en: { name: 'Text Diff', description: 'Paste two versions of a text and see a line-by-line diff — additions, removals and unchanged lines colour-coded, with a count of what changed. Runs entirely in your browser; nothing is uploaded.' },
    ar: { name: 'مقارنة النصوص', description: 'الصق نسختين من نصّ لترى الفروق سطرًا بسطر — الإضافات والحذوفات والأسطر غير المتغيّرة بألوان مميّزة، مع عدّ لما تغيّر. يعمل بالكامل في متصفحك؛ لا يُرفع أي شيء.' },
  },
  {
    id: 'unix-timestamp',
    en: { name: 'Unix Timestamp', description: 'Convert a Unix timestamp (seconds or milliseconds) to a readable date and back, in both your local timezone and UTC, with a live current-time readout. Runs entirely in your browser.' },
    ar: { name: 'الطابع الزمني يونكس', description: 'حوّل طابعًا زمنيًا يونكس (بالثواني أو المللي ثانية) إلى تاريخ مقروء والعكس، بتوقيتك المحلي وبتوقيت UTC، مع عرض حيّ للوقت الحالي. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'url-encoder',
    en: { name: 'URL & HTML Encoder', description: 'Encode or decode text for URLs (percent-encoding, whole-URL or component) and HTML (entities like &amp; and &#39;), both directions, as you type. Runs entirely in your browser — nothing is uploaded.' },
    ar: { name: 'مُرمِّز الروابط وHTML', description: 'رمِّز أو فُكّ ترميز النص للروابط (ترميز النسبة المئوية، رابط كامل أو جزء) ولـHTML (كيانات مثل &amp; و&#39;) في الاتجاهين أثناء الكتابة. يعمل بالكامل في متصفحك — لا يُرفع أي شيء.' },
  },
  {
    id: 'base-converter',
    en: { name: 'Number Base Converter', description: 'Convert a number between binary, octal, decimal, hexadecimal and any base from 2 to 36, all at once and in real time. Arbitrary-precision, so large values stay exact. Runs entirely in your browser.' },
    ar: { name: 'محوّل أنظمة الأعداد', description: 'حوّل عددًا بين الثنائي والثماني والعشري والست عشري وأي أساس من 2 إلى 36 دفعةً واحدة وفي الوقت الحقيقي، بدقة عالية للقيم الكبيرة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'csv-json',
    en: { name: 'CSV ⇄ JSON', description: 'Paste CSV to get an array of JSON objects keyed by the header row, or paste JSON to get CSV back. Handles quoted fields, commas and newlines inside values. Parsed in your browser — nothing is uploaded.' },
    ar: { name: 'CSV ⇄ JSON', description: 'الصق CSV لتحصل على مصفوفة كائنات JSON مفهرسة بصف الترويسة، أو الصق JSON لتحصل على CSV. يتعامل مع الحقول المقتبسة والفواصل والأسطر داخل القيم. يُحلَّل في متصفحك — لا يُرفع أي شيء.' },
  },
  {
    id: 'list-tools',
    en: { name: 'List Tools', description: 'Paste a list, one item per line, and clean it up: sort alphabetically or numerically, remove duplicates and blank lines, trim whitespace, change case, reverse or shuffle, with live before/after counts. Runs entirely in your browser.' },
    ar: { name: 'أدوات القوائم', description: 'الصق قائمة، عنصرًا في كل سطر، ونظّفها: رتّب أبجديًا أو رقميًا، أزل المكرّرات والأسطر الفارغة، شذّب المسافات، غيّر الحالة، اعكس أو اخلط، مع عدّادات قبل وبعد. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'color-contrast',
    en: { name: 'Contrast Checker', description: 'Pick a text and background colour and see their WCAG 2.1 contrast ratio, with clear pass/fail badges for AA and AAA at normal and large text sizes, plus a live preview. Runs entirely in your browser.' },
    ar: { name: 'فاحص التباين', description: 'اختر لون النص والخلفية لترى نسبة التباين وفق WCAG 2.1، مع شارات نجاح/رسوب لمستويي AA وAAA لأحجام النص العادية والكبيرة، ومعاينة حيّة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'loan-calculator',
    en: { name: 'Loan Calculator', description: 'Work out the monthly payment on a loan or mortgage from the amount, annual interest rate and term, with total interest, total repaid and a year-by-year amortization breakdown. A neutral maths tool, not financial advice. Runs entirely in your browser.' },
    ar: { name: 'حاسبة القروض', description: 'احسب القسط الشهري لقرض أو تمويل عقاري من المبلغ ونسبة الفائدة السنوية والمدة، مع إجمالي الفائدة والمبلغ المسدَّد وجدول إطفاء سنوي. أداة حسابية محايدة وليست نصيحة مالية. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'percentage-calculator',
    en: { name: 'Percentage Calculator', description: 'Answer the common percentage questions instantly: what is X% of Y, X is what percent of Y, and the percentage increase or decrease from one number to another. Runs entirely in your browser.' },
    ar: { name: 'حاسبة النسبة المئوية', description: 'أجب فورًا عن أسئلة النسب الشائعة: كم يساوي X% من Y، وX يمثّل أي نسبة من Y، ونسبة الزيادة أو النقص من رقم إلى آخر. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'split-bill',
    en: { name: 'Bill Splitter', description: 'Split a restaurant or group bill fairly: add an optional tip percentage, set how many people are paying, and see the per-person share and the grand total. Runs entirely in your browser.' },
    ar: { name: 'مقسّم الفاتورة', description: 'قسّم فاتورة مطعم أو مجموعة بإنصاف: أضف نسبة بقشيش اختيارية، وحدّد عدد الدافعين، وشاهد نصيب كل شخص والمجموع الكلي. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'aspect-ratio',
    en: { name: 'Aspect Ratio Calculator', description: 'Lock an aspect ratio and solve for the missing dimension: enter a width to get the matching height or vice-versa, pick common presets like 16:9 or 4:3, and read the simplified ratio. Runs entirely in your browser.' },
    ar: { name: 'حاسبة نسبة الأبعاد', description: 'ثبّت نسبة الأبعاد واحسب البُعد الناقص: أدخل العرض لتحصل على الارتفاع المطابق أو العكس، اختر قوالب شائعة مثل 16:9 أو 4:3، واقرأ النسبة المبسّطة. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'pomodoro',
    en: { name: 'Pomodoro Timer', description: 'A distraction-free Pomodoro timer: work in focused sprints, take short and long breaks, and let it cycle automatically with a gentle chime and a round counter. Custom lengths are remembered on your device. Runs entirely in your browser.' },
    ar: { name: 'مؤقّت بومودورو', description: 'مؤقّت بومودورو خالٍ من التشتيت: اعمل في جلسات مركّزة، وخذ فترات راحة قصيرة وطويلة، ودعه يتنقّل تلقائيًا مع نغمة لطيفة وعدّاد جولات. تُحفظ مدّتك المخصّصة على جهازك. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'end-of-service',
    en: { name: 'End-of-Service Calculator', description: 'Estimate the Saudi end-of-service gratuity (mukāfaʾat nihāyat al-khidma): half a month per year for the first five years and a full month per year thereafter, adjusted for resignation vs contract end. Based on Labour Law Articles 84–85, informational only — not legal advice. Runs in your browser.' },
    ar: { name: 'حاسبة نهاية الخدمة', description: 'قدّر مكافأة نهاية الخدمة السعودية: نصف شهر عن كل سنة من السنوات الخمس الأولى وشهر كامل عن كل سنة بعدها، مع تعديلها حسب الاستقالة أو انتهاء العقد. مبنيّة على المادتين 84 و85 من نظام العمل، لأغراض إرشادية فقط وليست استشارة قانونية. تعمل في متصفحك.' },
  },
  {
    id: 'zakat-calculator',
    en: { name: 'Zakat Calculator', description: 'Add up your zakatable assets — cash, gold and silver, trade goods and money owed to you — subtract short-term debts, and see 2.5% due once your net wealth is above the niṣāb and held for a lunar year. A helping estimate, not a fatwa. Runs in your browser.' },
    ar: { name: 'حاسبة الزكاة', description: 'اجمع أموالك الزكوية — النقد والذهب والفضة وعروض التجارة والديون المرجوّة لك — واطرح الديون قصيرة الأجل، لترى 2.5% الواجبة متى بلغ صافي مالك النصاب وحال عليه الحول. تقدير مُعين وليس فتوى. يعمل في متصفحك.' },
  },
  {
    id: 'age-calculator',
    en: { name: 'Age Calculator', description: 'Enter a birth date to see the exact age in years, months and days, the totals in months, weeks and days, the weekday you were born on, and a countdown to the next birthday. Runs entirely in your browser.' },
    ar: { name: 'حاسبة العمر', description: 'أدخل تاريخ الميلاد لترى العمر بدقّة بالسنوات والأشهر والأيام، والمجاميع بالأشهر والأسابيع والأيام، ويوم الأسبوع الذي وُلدت فيه، وعدًّا تنازليًا للميلاد القادم. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'working-days',
    en: { name: 'Working Days Calculator', description: 'Count the working days between two dates, excluding the weekend — Friday–Saturday for Saudi Arabia or Saturday–Sunday elsewhere — with totals for calendar days and weekend days. Runs entirely in your browser.' },
    ar: { name: 'حاسبة أيام العمل', description: 'احسب أيام العمل بين تاريخين باستثناء نهاية الأسبوع — الجمعة والسبت للسعودية أو السبت والأحد لغيرها — مع مجاميع للأيام الكلية وأيام العطلة. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'cubic-bezier',
    en: { name: 'Cubic Bezier Editor', description: 'Drag the two control points to shape a CSS cubic-bezier easing curve, watch a live animation play it back, start from presets like ease-in-out, and copy the ready-to-paste value. Runs entirely in your browser.' },
    ar: { name: 'محرّر منحنى بيزييه', description: 'اسحب نقطتي التحكّم لتشكيل منحنى تنعيم CSS من نوع cubic-bezier، وشاهد حركة حيّة تعيده، وابدأ من قوالب مثل ease-in-out، وانسخ القيمة الجاهزة للّصق. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'box-shadow',
    en: { name: 'Box Shadow Generator', description: 'Adjust offset, blur, spread, colour, opacity and inset to design a CSS box-shadow, see it on a live preview tile, and copy the exact rule. Runs entirely in your browser.' },
    ar: { name: 'مولّد ظل الصندوق', description: 'اضبط الإزاحة والتمويه والانتشار واللون والشفافية والظل الداخلي لتصميم ظل CSS، وشاهده على بلاطة معاينة حيّة، وانسخ القاعدة بدقّة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'gradient-generator',
    en: { name: 'CSS Gradient Generator', description: 'Design a CSS gradient from multiple colour stops — linear at any angle or radial — see it fill a live preview, and copy the exact background rule. Runs entirely in your browser.' },
    ar: { name: 'مولّد تدرّجات CSS', description: 'صمّم تدرّج CSS من عدّة محطّات ألوان — خطّي بأي زاوية أو شعاعي — وشاهده يملأ معاينة حيّة، وانسخ قاعدة الخلفية بدقّة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'ip-subnet',
    en: { name: 'IP Subnet Calculator', description: 'Enter an IPv4 address with a CIDR prefix (e.g. 192.168.1.10/24) to get the network and broadcast addresses, the usable host range, the subnet mask and wildcard, and the number of usable hosts. Runs entirely in your browser.' },
    ar: { name: 'حاسبة الشبكات الفرعية', description: 'أدخل عنوان IPv4 مع بادئة CIDR (مثل 192.168.1.10/24) لتحصل على عنواني الشبكة والبثّ، ونطاق المضيفين، وقناع الشبكة والقناع البديل، وعدد المضيفين. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'user-agent',
    en: { name: 'User-Agent Parser', description: 'Read your own browser’s user-agent string, or paste any other, and see the detected browser, rendering engine, operating system and device type broken out. Parsed locally — your UA is never sent anywhere.' },
    ar: { name: 'محلّل وكيل المستخدم', description: 'اقرأ نص وكيل المستخدم لمتصفحك، أو الصق أي نص آخر، لترى المتصفح ومحرّك العرض ونظام التشغيل ونوع الجهاز مفصّلة. يُحلَّل محليًا — لا يُرسل وكيلك إلى أي مكان.' },
  },
  {
    id: 'readability',
    en: { name: 'Readability Scorer', description: 'Paste English text to get its Flesch Reading Ease score and Flesch–Kincaid grade level, plus word, sentence and syllable counts and averages, so you can see and simplify how hard your writing is. Runs entirely in your browser.' },
    ar: { name: 'مقياس المقروئية', description: 'الصق نصًّا إنجليزيًا لتحصل على درجة سهولة القراءة (Flesch) ومستوى الصف الدراسي (Flesch–Kincaid)، مع عدد الكلمات والجُمل والمقاطع ومتوسّطاتها، لترى مدى صعوبة كتابتك وتبسّطها. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'random-picker',
    en: { name: 'Random Picker Wheel', description: 'Type your options, one per line, and spin a colourful wheel to pick one at random — great for names, prizes, chores or deciding where to eat. Uses cryptographic randomness. Runs entirely in your browser.' },
    ar: { name: 'عجلة الاختيار العشوائي', description: 'اكتب خياراتك، خيارًا في كل سطر، وأدِر عجلة ملوّنة لاختيار واحد عشوائيًا — مثالية للأسماء أو الجوائز أو المهام أو تقرير مكان الأكل. تستخدم عشوائية تشفيرية. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'dice-roller',
    en: { name: 'Dice Roller', description: 'Roll any number of dice with any number of sides (d4 to d20 and beyond), see each result and the total, or flip a coin — with fair, unbiased cryptographic randomness. Runs entirely in your browser.' },
    ar: { name: 'رامي النرد', description: 'ارمِ أي عدد من حبّات النرد بأي عدد أوجه (من d4 إلى d20 وأكثر)، وشاهد كل نتيجة والمجموع، أو اقلب عملة — بعشوائية تشفيرية عادلة غير متحيّزة. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'countdown',
    en: { name: 'Countdown Timer', description: 'Set a target date and time — a deadline, launch, trip or celebration — and watch a live countdown of days, hours, minutes and seconds tick down. Your event is remembered on this device. Runs entirely in your browser.' },
    ar: { name: 'العدّ التنازلي', description: 'حدّد تاريخًا ووقتًا مستهدفًا — موعدًا نهائيًا أو إطلاقًا أو رحلة أو احتفالًا — وشاهد عدًّا تنازليًا حيًّا بالأيام والساعات والدقائق والثواني. تُحفظ مناسبتك على هذا الجهاز. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'typing-test',
    en: { name: 'Typing Speed Test', description: 'Type the shown passage to measure your typing speed in words per minute and your accuracy, with each character highlighted as right or wrong in real time. Runs entirely in your browser.' },
    ar: { name: 'اختبار سرعة الكتابة', description: 'اكتب المقطع المعروض لقياس سرعة كتابتك بالكلمات في الدقيقة ودقّتك، مع تمييز كل حرف صحيحًا أو خاطئًا لحظيًا. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'book-me',
    en: { name: 'Book Me', description: 'A free, no-sign-up scheduling link — paint your weekly availability, set the meeting length with gaps and buffers, and share one link. People self-book an open slot without the email back-and-forth; you get a push, a Telegram DM and an email when they book.' },
    ar: { name: 'احجز معي', description: 'رابط جدولة مجاني بلا تسجيل — ارسم أوقات فراغك الأسبوعية، وحدِّد مدة الاجتماع بفواصل ومهل، وشارك رابطًا واحدًا. يحجز الناس وقتًا متاحًا دون تبادل رسائل، وتصلك إشعارات ورسالة تيليجرام وبريد عند الحجز.' },
  },
  {
    id: 'cv-generator',
    en: { name: 'CV Generator', description: 'Upload your CV and get it rewritten into a clean, ATS-ready résumé — signal only, no noise. Photos, colours, GPAs and references stripped; skills and a punchy summary synthesised from your whole history. Export PDF or Word.' },
    ar: { name: 'منشئ السيرة الذاتية', description: 'ارفع سيرتك واحصل عليها معادةَ الكتابة في قالب نظيف متوافق مع أنظمة التتبّع — إشارة بلا ضجيج. تُزال الصور والألوان والمعدّلات والمراجع؛ وتُستخلص المهارات وملخّص موجز. صدّر PDF أو Word.' },
  },
  {
    id: 'link-shortener',
    en: { name: 'Link Shortener', description: 'Turn a long URL into a clean built-in-saudi.com/s/… link you can share anywhere. Sign in with Google to create and manage your links and see their click counts. Each link is kept for 6 months. Free, no ads.' },
    ar: { name: 'اختصار الروابط', description: 'حوّل رابطًا طويلًا إلى رابط قصير أنيق على built-in-saudi.com/s/… تشاركه في أي مكان. سجّل الدخول بحساب Google لإنشاء روابطك وإدارتها ورؤية عدد النقرات. يُحفظ كل رابط ٦ أشهر. مجاني بلا إعلانات.' },
  },
  {
    id: 'color-tools',
    en: { name: 'Color Picker & Palettes', description: 'Pick a colour and read it as HEX/RGB/HSL, then generate complementary, analogous and triadic palettes plus a shades ramp — copy any swatch. In your browser.' },
    ar: { name: 'منتقي الألوان واللوحات', description: 'اختر لونًا واقرأه بصيغ HEX/RGB/HSL، ثم ولّد لوحات مكمّلة ومتجانسة وثلاثية وتدرّجات — وانسخ أي لون. داخل متصفحك.' },
  },
  {
    id: 'invoice-generator',
    en: { name: 'Invoice Generator', description: 'Create a bilingual (AR/EN) SAR invoice with line items, automatic 15% Saudi VAT and the total in Arabic words. Print or save as PDF; nothing uploaded.' },
    ar: { name: 'منشئ الفواتير', description: 'أنشئ فاتورة ثنائية اللغة بالريال ببنودٍ وضريبة ١٥٪ تلقائيًا والإجمالي بالأحرف العربية. اطبعها أو احفظها PDF؛ لا يُرفع شيء.' },
  },
  {
    id: 'pdf-split',
    en: { name: 'Split PDF', description: 'Split a PDF in your browser — extract a page range like 1-3,5 into a new file, or burst into single-page PDFs (ZIP or one by one). Never uploaded.' },
    ar: { name: 'تقسيم PDF', description: 'قسّم PDF داخل متصفحك — استخرج نطاق صفحات مثل 1-3،5 في ملف جديد، أو فكّكه إلى صفحات مفردة (ZIP أو واحدة تلو الأخرى). لا يُرفع أبدًا.' },
  },
  {
    id: 'pdf-merge',
    en: { name: 'Merge PDF', description: 'Merge several PDFs into one in the order you choose — reorder, remove, see the page count. Runs in your browser; your documents are never uploaded.' },
    ar: { name: 'دمج PDF', description: 'ادمج عدة ملفات PDF في ملف واحد بالترتيب — إعادة ترتيب وحذف وعدد صفحات. يعمل داخل متصفحك؛ لا تُرفع مستنداتك أبدًا.' },
  },
  {
    id: 'pdf-sign',
    en: { name: 'Sign PDF', description: 'Sign a PDF by hand in your browser: draw your signature with a finger or mouse, then drag, pinch and place it exactly — with a magnifier for precise positioning. Powered by pdf-lib; your document is never uploaded.' },
    ar: { name: 'توقيع PDF', description: 'وقّع ملف PDF بخط يدك داخل متصفحك: ارسم توقيعك بإصبعك أو بالفأرة، ثم اسحبه واقرِصه وضعه بدقة — مع عدسة مكبّرة لضبطٍ مثالي. يعمل عبر pdf-lib؛ لا يُرفع مستندك أبدًا.' },
  },
  {
    id: 'pdf-fill',
    en: { name: 'Fill PDF Form', description: 'Fill PDF forms in your browser. Interactive fields are detected automatically — clean web form for well-named ones, editable boxes on the page otherwise — and field-less PDFs let you drop text anywhere. Export a filled, optionally flattened PDF; never uploaded.' },
    ar: { name: 'تعبئة نموذج PDF', description: 'عبّئ نماذج PDF داخل متصفحك. تُكتشف الحقول التفاعلية تلقائيًا — نموذج ويب أنيق للأسماء الواضحة، ومربعات على الصفحة لغيرها — والملفات بلا حقول تتيح إضافة نص أينما شئت. صدّر ملفًا معبّأً وقابلًا للتثبيت؛ دون رفعه أبدًا.' },
  },
  {
    id: 'pdf-edit',
    en: { name: 'Edit PDF', description: 'A rudimentary in-browser PDF editor: select and move or delete images, and add new text with resize handles and line breaks. Edits the PDF content streams with pdf-lib and never uploads your file. Existing text can’t be edited or removed yet.' },
    ar: { name: 'تحرير PDF', description: 'محرّر PDF مبدئي داخل المتصفح: حدّد الصور وحرّكها أو احذفها، وأضِف نصًا جديدًا بمقابض لتغيير الحجم وفواصل أسطر. يحرّر محتوى الملف عبر pdf-lib ولا يرفع ملفك أبدًا. لا يمكن تعديل أو حذف النص الموجود بعد.' },
  },
  {
    id: 'pdf-compress',
    en: { name: 'Compress PDF', description: 'Make a PDF smaller in your browser: pick a compression level and it re-renders each page as an optimised JPEG and rebuilds the file — great for scanned or photo-heavy PDFs, with the size saved shown before you download. Runs with pdf.js + pdf-lib; never uploaded. Text becomes part of the image.' },
    ar: { name: 'ضغط PDF', description: 'صغّر حجم ملف PDF داخل متصفحك: اختر مستوى الضغط فيُعيد رسم كل صفحة كصورة JPEG محسّنة ويعيد بناء الملف — مثالي للملفات الممسوحة أو المليئة بالصور، مع إظهار حجم التوفير قبل التنزيل. يعمل عبر pdf.js و pdf-lib؛ دون رفعه. يصبح النص جزءًا من الصورة.' },
  },
  {
    id: 'images-to-pdf',
    en: { name: 'Images to PDF', description: 'Combine JPG/PNG images into a single PDF, one per page — reorder, fit-to-image or A4/Letter with a margin. Built in your browser; never uploaded.' },
    ar: { name: 'الصور إلى PDF', description: 'ادمج صور JPG/PNG في PDF واحد، صورة لكل صفحة — إعادة ترتيب، وملاءمة الصورة أو A4/Letter بهامش. داخل متصفحك؛ لا تُرفع أبدًا.' },
  },
  {
    id: 'image-cropper',
    en: { name: 'Image Cropper', description: 'Crop an image in your browser — drag/resize the crop box, lock to 1:1/4:3/16:9 or free, full-resolution output, download as PNG/JPG/WebP. Never uploaded.' },
    ar: { name: 'أداة قص الصور', description: 'اقتصّ الصورة داخل متصفحك — اسحب مربّع القص، ثبّته على 1:1 أو 4:3 أو 16:9 أو حر، ناتج بالدقة الكاملة، نزّله PNG/JPG/WebP. لا تُرفع أبدًا.' },
  },
  {
    id: 'image-format-converter',
    en: { name: 'Image Converter', description: 'Convert images between PNG, JPG and WebP in your browser — quality for lossy formats, background fill when flattening a transparent PNG to JPG. Never uploaded.' },
    ar: { name: 'محوّل صيغ الصور', description: 'حوّل الصور بين PNG وJPG وWebP داخل متصفحك — جودة للصيغ ذات الفقد، ولون خلفية عند تسطيح PNG الشفاف إلى JPG. لا تُرفع أبدًا.' },
  },
  {
    id: 'image-compressor',
    en: { name: 'Image Compressor', description: 'Compress and resize JPG/PNG/WebP images in your browser — quality + max-width, before→after size and % saved. The image is never uploaded.' },
    ar: { name: 'ضاغط الصور', description: 'اضغط الصور وغيّر حجمها داخل متصفحك — الجودة وأقصى عرض، والحجم قبل وبعد ونسبة التوفير. لا تُرفع الصورة أبدًا.' },
  },
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
    id: 'tafqeet',
    en: { name: 'Tafqeet (Number to Words)', description: 'Spell any number or amount in Arabic words (tafqeet) — Saudi Riyals with halalas or a plain number, with correct Arabic grammar. For cheques, invoices and contracts.' },
    ar: { name: 'التفقيط', description: 'اكتب أي رقم أو مبلغ بالأحرف العربية (تفقيط) — بالريال مع الهللات أو رقمًا مجرّدًا، بالقواعد الصحيحة. للشيكات والفواتير والعقود.' },
  },
  {
    id: 'iban-validator',
    en: { name: 'IBAN Validator', description: 'Validate an IBAN (ISO 7064 mod-97), enforce the Saudi SA + 22-digit format, group it in fours and identify the bank — in your browser, never sent anywhere.' },
    ar: { name: 'مدقّق الآيبان', description: 'تحقّق من الآيبان عبر mod-97، وتأكّد من صيغة السعودية (SA + ٢٢ رقمًا)، واعرضه بمجموعات من أربعة وتعرّف على البنك — داخل متصفحك دون إرسال.' },
  },
  {
    id: 'islamic-calendar',
    en: { name: 'Islamic Calendar', description: 'A month-at-a-glance Islamic calendar (Umm al-Qura) — Hijri/Gregorian toggle, moon phase per day, the white days (13–15), and Islamic dates like Ramadan and the Eids. Computed in your browser.' },
    ar: { name: 'التقويم الإسلامي', description: 'تقويم إسلامي شهري (أم القرى) — تبديل هجري/ميلادي، وطور القمر لكل يوم، والأيام البيض (١٣–١٥)، ومناسبات كرمضان والعيدين. يُحسب داخل متصفحك.' },
  },
  {
    id: 'hisn-al-muslim',
    en: { name: 'Hisn al-Muslim', description: 'Ḥiṣn al-Muslim (the Fortress of the Muslim) — the full du‘a collection compiled by Saʿīd b. Wahf al-Qaḥṭānī. Search ~130 chapters and read the vocalized Arabic du‘as. Offline.' },
    ar: { name: 'حصن المسلم', description: 'حصن المسلم — مجموعة الأذكار والأدعية، جمع سعيد بن وهف القحطاني. ابحث في نحو ١٣٠ بابًا واقرأ الأدعية بالنص العربي المشكول. يعمل دون اتصال.' },
  },
  {
    id: 'adhkar',
    en: { name: 'Morning & Evening Adhkar', description: 'The core morning and evening adhkār from the Qur’an and authentic Sunnah — Arabic with transliteration, an English meaning, repeat counts and sources, and a tap-to-count tracker.' },
    ar: { name: 'أذكار الصباح والمساء', description: 'أذكار الصباح والمساء الأساسية من القرآن والسنة الصحيحة — بالعربية مع النطق والمعنى بالإنجليزية وعدد التكرار والمصدر وعدّاد باللمس.' },
  },
  {
    id: 'istikhara',
    en: { name: 'Istikhara Du‘a', description: 'The du‘a of Ṣalāt al-Istikhāra (the prayer for guidance) — the prophetic Arabic with transliteration, an English meaning, how to pray the two rakʿahs, and the source (Jābir ibn ʿAbdillāh · Ṣaḥīḥ al-Bukhārī).' },
    ar: { name: 'دعاء الاستخارة', description: 'دعاء صلاة الاستخارة — النص النبوي بالعربية مع النطق والمعنى بالإنجليزية، وكيفية أداء الركعتين، والمصدر (جابر بن عبد الله · صحيح البخاري).' },
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
    id: 'detect-language',
    en: { name: 'Language Detector', description: 'Detect the language of any text in your browser — script detection plus common-word matching across major languages, with a confidence score. Nothing uploaded.' },
    ar: { name: 'كاشف اللغة', description: 'اكتشف لغة أي نصٍّ داخل متصفحك — كشف النظام الكتابي ومطابقة الكلمات الشائعة لكبرى اللغات، مع درجة ثقة. دون رفع أي شيء.' },
  },
  {
    id: 'lorem-ipsum',
    en: { name: 'Lorem Ipsum', description: 'Generate placeholder text by paragraphs, sentences or words — classic Lorem ipsum or an Arabic filler variant. Runs entirely in your browser.' },
    ar: { name: 'نص بديل', description: 'ولّد نصًا بديلًا بالفقرات أو الجُمل أو الكلمات — نص Lorem ipsum الكلاسيكي أو نص حشو عربي. يعمل بالكامل داخل متصفحك.' },
  },
  {
    id: 'vat-calculator',
    en: { name: 'VAT Calculator', description: 'Add or remove Saudi VAT (15% default, 5%/0% presets) — net, VAT and gross in SAR to the halala, with a copyable breakdown. Bilingual, in-browser.' },
    ar: { name: 'حاسبة ضريبة القيمة المضافة', description: 'أضِف أو استخرج ضريبة القيمة المضافة السعودية (١٥٪ افتراضيًا) — الصافي والضريبة والإجمالي بالريال، مع تفاصيل قابلة للنسخ. داخل متصفحك.' },
  },
  {
    id: 'arabic-poetry',
    en: { name: 'Arabic Poetry Meters', description: 'The 16 classical Arabic poetic metres (buḥūr) of al-Khalīl with tafʿīlāt and example verses, plus a formatter that lays pasted poetry out in the two-hemistich bayt form. Offline.' },
    ar: { name: 'بحور الشعر', description: 'بحور الشعر العربي الستة عشر عند الخليل بتفعيلاتها وأمثلتها، مع منسّق يعرض الشعر الملصق في صورته العمودية (صدر وعجز). يعمل دون اتصال.' },
  },
  {
    id: 'case-converter',
    en: { name: 'Case Converter', description: 'Convert text between UPPER, lower, Title, Sentence, camelCase, PascalCase, snake_case, kebab-case and CONSTANT_CASE — live, with copy. Arabic passes through untouched.' },
    ar: { name: 'محوّل حالة الأحرف', description: 'حوّل النص بين الحالات — كبيرة/صغيرة/أول الكلمة/أول الجملة وcamelCase وsnake_case وkebab وCONSTANT — مباشرةً مع النسخ. العربية دون تغيير.' },
  },
  {
    id: 'hash-generator',
    en: { name: 'Hash Generator', description: 'Compute SHA-1/256/384/512 of any text or file — hex and Base64. Files are hashed locally and never uploaded.' },
    ar: { name: 'مولّد البصمة (Hash)', description: 'احسب SHA-1/256/384/512 لأي نص أو ملف — ست عشري وBase64. تُحسب الملفات محليًا ولا تُرفع.' },
  },
  {
    id: 'json-formatter',
    en: { name: 'Code Formatter', description: 'Format, minify and validate code in your browser — JSON (line/column errors, sort keys) plus CSS and XML beautify/minify. Nothing uploaded.' },
    ar: { name: 'منسّق الكود', description: 'نسّق وصغّر وتحقّق من الكود داخل متصفحك — JSON (أخطاء بالسطر والعمود وترتيب المفاتيح) مع CSS وXML. دون رفع أي شيء.' },
  },
  {
    id: 'unit-converter',
    en: { name: 'Unit Converter', description: 'Convert length, mass, temperature, data, area, volume, speed and time — live, with swap + copy. Exact tables; temperature with proper offsets.' },
    ar: { name: 'محوّل الوحدات', description: 'حوّل الطول والكتلة والحرارة والبيانات والمساحة والحجم والسرعة والزمن — مباشرةً مع تبديل ونسخ. جداول دقيقة والحرارة بمعاملات إزاحة صحيحة.' },
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
  {
    id: 'archive-inspector',
    en: { name: 'Archive Inspector', description: 'Peek inside a .zip and other archives in your browser — detect the format and list every entry with sizes and dates, without extracting or uploading.' },
    ar: { name: 'فاحص الأرشيف', description: 'اطّلع على محتوى ملفات .zip وغيرها داخل متصفحك — تعرّف على الصيغة واعرض كل عنصر بحجمه وتاريخه دون فكّ أو رفع.' },
  },
  {
    id: 'file-metadata',
    en: { name: 'File Metadata', description: 'Reveal a file’s metadata in your browser — size, image dimensions, camera EXIF with GPS, PNG text, PDF info and media tags. Nothing is uploaded.' },
    ar: { name: 'بيانات الملف', description: 'اكشف البيانات الوصفية لملفٍ داخل متصفحك — الحجم وأبعاد الصورة وبيانات EXIF مع GPS ونصوص PNG ومعلومات PDF ووسوم الوسائط. دون رفع أي شيء.' },
  },
]
