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
    en: { name: 'Calls', description: 'Secure peer-to-peer voice/video/teams calling between browsers — no data touches our servers. Share one invite link and let people in from a waiting room; video, screen-share, a shared whiteboard, chat and file-drop all go straight between browsers over WebRTC, with only the initial handshake passing through a tiny relay that never sees your call.' },
    ar: { name: 'مكالمات', description: 'مكالمات صوت وفيديو وفرق آمنة بين المتصفحات مباشرةً — لا تمر أي بيانات بخوادمنا. شارك رابط دعوة واحدًا واسمح للناس بالدخول من غرفة انتظار؛ الفيديو ومشاركة الشاشة والسبورة والدردشة وإرسال الملفات تنتقل مباشرة عبر WebRTC، وفقط المصافحة الأولى تمر بمُرحِّل صغير لا يرى مكالمتك.' },
  },
  {
    id: 'prompt-analyzer',
    en: { name: 'Prompt Analyzer', description: 'Paste an LLM system prompt and one AI pass scores it 1–5 across eight dimensions — purpose coherence, context-vs-instruction harmony, spikiness, shoutiness, contradictions, framing, an escape hatch and downstream stakes — as a heatmap spider chart, with concrete issues listed. Then answer the gaps and get a rewritten, stronger prompt. Three analyses per 24 hours.' },
    ar: { name: 'محلّل الموجّهات', description: 'الصق موجّه نظام لنموذج لغوي فيقيّمه مرور واحد للذكاء الاصطناعي من ١ إلى ٥ عبر ثمانية أبعاد — تماسك الغرض وتناغم السياق مع التعليمات والحدّة والصياح والتناقضات والصياغة ومنفذ الخروج والاستخدام اللاحق — كمخطط عنكبوتي بألوان حرارية مع سرد المشكلات. ثم أجب عن الثغرات لتحصل على موجّه مُعاد صياغته أقوى. ثلاثة تحاليل كل ٢٤ ساعة.' },
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
    id: 'image-to-ascii',
    en: { name: 'Image to ASCII', description: 'Drop an image and convert it into ASCII art — choose the width, character set and light/dark inversion, then copy the text or download it. Processed entirely on your device and never uploaded.' },
    ar: { name: 'صورة إلى ASCII', description: 'أفلت صورة وحوّلها إلى فنّ ASCII — اختر العرض ومجموعة الرموز وعكس الفاتح/الداكن، ثم انسخ النص أو نزّله. تُعالَج بالكامل على جهازك ولا تُرفع أبدًا.' },
  },
  {
    id: 'meme-generator',
    en: { name: 'Meme Generator', description: 'Drop an image, add bold top and bottom captions in the classic meme style, tweak the font size, and download the result as a PNG. Drawn on your device — the image is never uploaded.' },
    ar: { name: 'مولّد الميمز', description: 'أفلت صورة، وأضِف تعليقين علوي وسفلي بالنمط الكلاسيكي للميمز، واضبط حجم الخط، ونزّل الناتج كـPNG. تُرسم على جهازك — لا تُرفع الصورة أبدًا.' },
  },
  {
    id: 'favicon-generator',
    en: { name: 'Favicon Generator', description: 'Drop a square image or logo and generate crisp favicon and app-icon PNGs at every common size (16 to 512, plus the Apple touch icon), with ready-to-paste HTML link tags. Generated on your device — nothing is uploaded.' },
    ar: { name: 'مولّد الأيقونات', description: 'أفلت صورة مربّعة أو شعارًا وأنشئ أيقونات favicon وتطبيقات واضحة بكل المقاسات الشائعة (من 16 إلى 512، مع أيقونة Apple)، مع وسوم HTML الجاهزة للّصق. تُنشأ على جهازك — لا يُرفع أي شيء.' },
  },
  {
    id: 'steganography',
    en: { name: 'Hide Text in Image', description: 'Hide a text message inside an image by tweaking the least-significant bits of its pixels — the picture looks unchanged — then reveal it later from the saved PNG. Everything happens on your device; nothing is uploaded.' },
    ar: { name: 'إخفاء نص في صورة', description: 'أخفِ رسالة نصية داخل صورة بتعديل البتات الأقل أهمية في بكسلاتها — تبدو الصورة دون تغيير — ثم اكشفها لاحقًا من ملف PNG المحفوظ. كل شيء يجري على جهازك؛ لا يُرفع أي شيء.' },
  },
  {
    id: 'screen-recorder',
    en: { name: 'Screen Recorder', description: 'Record a screen, window or browser tab — optionally with your microphone — straight to a video file you can download. Captured and saved entirely on your device; nothing is uploaded or streamed.' },
    ar: { name: 'مسجّل الشاشة', description: 'سجّل شاشة أو نافذة أو تبويبًا — مع المايك اختياريًا — مباشرةً إلى ملف فيديو يمكنك تنزيله. يُلتقط ويُحفظ بالكامل على جهازك؛ لا يُرفع أو يُبثّ في أي مكان.' },
  },
  {
    id: 'photo-booth',
    en: { name: 'Webcam Photo Booth', description: 'Take photos with your webcam, apply fun filters, mirror the image, and download each shot. The camera only turns on when you start it, and every photo stays on your device — nothing is uploaded.' },
    ar: { name: 'كشك تصوير الويب كام', description: 'التقط صورًا بكاميرا الويب، وطبّق مرشّحات ممتعة، واعكس الصورة، ونزّل كل لقطة. لا تعمل الكاميرا إلا حين تبدأها، وتبقى كل صورة على جهازك — لا يُرفع أي شيء.' },
  },
  {
    id: 'image-redact',
    en: { name: 'Image Redactor', description: 'Drop an image and drag boxes over anything sensitive — faces, names, numbers — to pixelate or black it out, then download the redacted picture. The redaction is baked into the pixels and everything runs on your device.' },
    ar: { name: 'محرّر تمويه الصور', description: 'أفلت صورة واسحب مربّعات فوق أي شيء حسّاس — وجوه، أسماء، أرقام — لتبكسله أو تحجبه، ثم نزّل الصورة المموّهة. يُدمج التمويه في البكسلات وكل شيء يجري على جهازك.' },
  },
  {
    id: 'file-encrypt',
    en: { name: 'File Encryptor', description: 'Encrypt any file with a password using AES-256-GCM (with a PBKDF2-derived key), then decrypt it later with the same password. The file and password never leave your browser — real, standard cryptography on your device.' },
    ar: { name: 'مشفّر الملفات', description: 'شفّر أي ملف بكلمة مرور باستخدام AES-256-GCM (بمفتاح مشتقّ عبر PBKDF2)، ثم فُكّ تشفيره لاحقًا بالكلمة نفسها. لا يغادر الملف ولا كلمة المرور متصفحك — تشفير قياسي حقيقي على جهازك.' },
  },
  {
    id: 'meta-tags',
    en: { name: 'Meta Tag Generator', description: 'Fill in a page’s title, description, URL and preview image to generate the full set of SEO, Open Graph and Twitter Card meta tags — with a live social-share preview — ready to paste into your <head>. Runs entirely in your browser.' },
    ar: { name: 'مولّد وسوم Meta', description: 'أدخل عنوان الصفحة ووصفها ورابطها وصورة المعاينة لتوليد مجموعة وسوم SEO وOpen Graph وبطاقة تويتر كاملة — مع معاينة حيّة — جاهزة للّصق في <head>. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'robots-txt',
    en: { name: 'robots.txt Generator', description: 'Generate a valid robots.txt: allow or block crawlers, add disallowed paths, set a crawl-delay and point to your sitemap — then copy or download the file. Runs entirely in your browser.' },
    ar: { name: 'مولّد robots.txt', description: 'ولّد ملف robots.txt صالحًا: اسمح أو امنع الزواحف، وأضِف مسارات ممنوعة، وحدّد مهلة الزحف، وأشِر إلى خريطة موقعك — ثم انسخ الملف أو نزّله. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'gitignore',
    en: { name: '.gitignore Generator', description: 'Pick the languages, tools and editors you use and get a combined .gitignore with the usual build artefacts, dependency folders and OS/editor cruft — ready to copy or download. Runs entirely in your browser.' },
    ar: { name: 'مولّد .gitignore', description: 'اختر اللغات والأدوات والمحرّرات التي تستخدمها لتحصل على ملف .gitignore مدمج يشمل مخرجات البناء ومجلّدات الاعتماديات وفوضى النظام والمحرّر — جاهز للنسخ أو التنزيل. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'json-to-types',
    en: { name: 'JSON to TypeScript', description: 'Paste a JSON object or array and get clean TypeScript interfaces inferred from it — nested objects become their own interfaces, arrays are typed, and keys missing from some items become optional. Runs entirely in your browser.' },
    ar: { name: 'JSON إلى TypeScript', description: 'الصق كائن أو مصفوفة JSON لتحصل على واجهات TypeScript مستنبطة منها — تصبح الكائنات المتداخلة واجهات خاصة بها، وتُصنَّف المصفوفات، وتصير المفاتيح الغائبة من بعض العناصر اختيارية. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'todo',
    en: { name: 'To-do Lists', description: 'Simple to-do lists that live in your browser: add tasks, tick them off, clear the finished ones. No account needed and nothing is uploaded. Want a list on more than one device, or shared with other people so you can tick things off together? Sign in with Google and switch sync on for just that list — everything else stays local.' },
    ar: { name: 'قوائم المهام', description: 'قوائم مهام بسيطة تعيش في متصفحك: أضِف المهام وأنجِزها وامسح المنتهي منها. بلا حساب ودون رفع أي شيء. وإن أردت قائمة على أكثر من جهاز أو مشتركة مع آخرين لتنجزوا معًا، سجّل الدخول بحساب جوجل وفعّل المزامنة لتلك القائمة وحدها — وما عداها يبقى محليًا.' },
  },
  {
    id: 'image-rearrange',
    en: { name: 'Rearrange Image', description: 'Open a screenshot or photo, drag out the parts you want to move, then slide and rotate those pieces anywhere on the image — useful for tidying a screenshot, covering something up, or rearranging a layout before you send it. Runs entirely in your browser: the picture is never uploaded, and you can save the result or share it straight from your device.' },
    ar: { name: 'إعادة ترتيب الصورة', description: 'افتح لقطة شاشة أو صورة، واسحب لتحديد الأجزاء التي تريد تحريكها، ثم انقلها وأدِرها في أي مكان على الصورة — مفيد لترتيب لقطة شاشة أو تغطية شيء أو إعادة ترتيب تصميم قبل إرساله. يعمل بالكامل في متصفحك: لا تُرفع الصورة أبدًا، ويمكنك حفظ النتيجة أو مشاركتها مباشرة.' },
  },
  {
    id: 'flashcards',
    en: { name: 'Flashcards', description: 'Build a deck of flip cards — a prompt on the front, the answer on the back — then study it: flip, go through in order or shuffled. Your deck is saved in this browser, nothing uploaded.' },
    ar: { name: 'البطاقات التعليمية', description: 'ابنِ مجموعة بطاقات قابلة للقلب — سؤال في الوجه وإجابة في الظهر — ثم ذاكِرها: اقلب، وتنقّل بالترتيب أو بالخلط. تُحفظ مجموعتك في هذا المتصفح، دون رفع أي شيء.' },
  },
  {
    id: 'kanban',
    en: { name: 'Kanban Board', description: 'A lightweight personal Kanban board — add cards to To-do, Doing and Done and move them across as work progresses. The whole board is saved in this browser, nothing uploaded.' },
    ar: { name: 'لوحة كانبان', description: 'لوحة كانبان شخصية خفيفة — أضِف بطاقات إلى «للعمل» و«قيد التنفيذ» و«منجز» وانقلها مع تقدّم العمل. تُحفظ اللوحة كاملةً في هذا المتصفح، دون رفع أي شيء.' },
  },
  {
    id: 'tier-list',
    en: { name: 'Tier List Maker', description: 'Add labels for the things you want to rank, then drag them into S, A, B, C and D tiers to build a classic tier list — and download it as an image to share. Saved in this browser; nothing uploaded.' },
    ar: { name: 'صانع قوائم التصنيف', description: 'أضِف تسميات للأشياء التي تريد ترتيبها، ثم اسحبها إلى فئات S وA وB وC وD لبناء قائمة تصنيف كلاسيكية — ونزّلها كصورة للمشاركة. تُحفظ في هذا المتصفح؛ لا يُرفع أي شيء.' },
  },
  {
    id: 'readme-generator',
    en: { name: 'README Generator', description: 'Fill in your project’s name, description, features, install and usage steps and licence to generate a clean, well-structured README.md — with a live preview of the Markdown — ready to copy or download. Runs entirely in your browser.' },
    ar: { name: 'مولّد README', description: 'أدخل اسم مشروعك ووصفه ومزاياه وخطوات التثبيت والاستخدام والرخصة لتوليد ملف README.md نظيف ومنظّم — مع معاينة حيّة لصيغة Markdown — جاهز للنسخ أو التنزيل. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'markdown-table',
    en: { name: 'Markdown Table Generator', description: 'Paste comma- or tab-separated data (copied straight from a spreadsheet works) and get a neatly padded GitHub-flavoured Markdown table, with a choice of column alignment. Runs entirely in your browser.' },
    ar: { name: 'مولّد جداول Markdown', description: 'الصق بياناتٍ مفصولة بفواصل أو بعلامات جدولة (النسخ المباشر من جدول بيانات يعمل) لتحصل على جدول Markdown مرتّب بنمط GitHub، مع خيار محاذاة الأعمدة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'svg-editor',
    en: { name: 'SVG Editor', description: 'Paste or drop an SVG, see it render live, and copy or download a cleaned-up version. The built-in optimiser (SVGOMG-style, sane defaults) strips editor cruft — comments, metadata, Inkscape/Illustrator namespaces — collapses whitespace and rounds coordinates so your icons ship lean. Runs entirely in your browser; nothing is uploaded.' },
    ar: { name: 'محرّر SVG', description: 'الصق أو أفلت ملف SVG، وشاهده يُعرض مباشرةً، وانسخ أو نزّل نسخة منظّفة. يزيل المُحسِّن المدمج (بأسلوب SVGOMG وبإعدادات معقولة) فضلات المحرّرات — التعليقات والبيانات الوصفية ومساحات أسماء Inkscape/Illustrator — ويطوي المسافات ويقرّب الإحداثيات فتخرج أيقوناتك خفيفة. يعمل بالكامل في متصفحك؛ لا يُرفع أي شيء.' },
  },
  {
    id: 'fake-data',
    en: { name: 'Fake Data Generator', description: 'Generate realistic-looking sample records — names, emails, phones, cities, companies, dates and IDs — for seeding tests, mockups and demos. Pick the fields and count, then export as JSON or CSV. Runs entirely in your browser.' },
    ar: { name: 'مولّد بيانات وهمية', description: 'ولّد سجلّات عيّنة واقعية المظهر — أسماء وبُرد إلكترونية وهواتف ومدن وشركات وتواريخ ومعرّفات — لتغذية الاختبارات والنماذج والعروض. اختر الحقول والعدد، ثم صدّر JSON أو CSV. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'slugify',
    en: { name: 'Slugify', description: 'Convert a title or heading into a clean, URL-safe slug — lowercased, accents stripped, spaces and punctuation turned into hyphens, with a basic Arabic-to-Latin transliteration. Choose the separator and case. Runs entirely in your browser.' },
    ar: { name: 'مولّد الروابط اللطيفة', description: 'حوّل عنوانًا إلى «سلَگ» نظيف آمن للروابط — أحرف صغيرة، بلا تشكيل، والمسافات وعلامات الترقيم تصبح شرطات، مع تحويل تقريبي من العربية إلى اللاتينية. اختر الفاصل والحالة. يعمل بالكامل في متصفحك.' },
  },
  {
    id: 'book-me',
    en: { name: 'Book Me', description: 'A free, no-sign-up scheduling link — paint your weekly availability, set the meeting length with gaps and buffers, and share one link. People self-book an open slot without the email back-and-forth; you get a push, a Telegram DM and an email when they book.' },
    ar: { name: 'احجز معي', description: 'رابط جدولة مجاني بلا تسجيل — ارسم أوقات فراغك الأسبوعية، وحدِّد مدة الاجتماع بفواصل ومهل، وشارك رابطًا واحدًا. يحجز الناس وقتًا متاحًا دون تبادل رسائل، وتصلك إشعارات ورسالة تيليجرام وبريد عند الحجز.' },
  },
  {
    id: 'ats-cv-optimizer',
    en: { name: 'ATS CV Optimizer', description: 'Upload your CV, get it rewritten into a clean, ATS-ready résumé, and see it scored across six ATS dimensions on a spider chart. Answer a few questions only you can and the tool folds them in to raise the score. Export PDF or Word.' },
    ar: { name: 'محسِّن السيرة الذاتية (ATS)', description: 'ارفع سيرتك، واحصل عليها معادةَ الكتابة في قالب نظيف متوافق مع أنظمة التتبّع، وشاهد تقييمها عبر ست ركائز في مخطط عنكبوتي. أجب عمّا لا يعرفه سواك فتدمجه الأداة لرفع التقييم. صدّر PDF أو Word.' },
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
    id: 'qr-reader',
    en: { name: 'QR Code Reader', description: 'Read a QR code from a picture or your camera and see what it really says before you open it — with warnings for look-alike and shortened links. Nothing is uploaded.' },
    ar: { name: 'قارئ الباركود', description: 'اقرأ الباركود من صورة أو من الكاميرا وشاهد محتواه الحقيقي قبل فتحه — مع تنبيهات للروابط المضللة والمختصرة. لا يُرفع شيء.' },
  },
  {
    id: 'metadata-remove',
    en: { name: 'Remove Image Metadata', description: 'Strip EXIF, GPS, XMP and IPTC data from a photo before you share it — without re-compressing the image, so quality is untouched. Never uploaded.' },
    ar: { name: 'إزالة بيانات الصورة', description: 'احذف بيانات EXIF وGPS وXMP وIPTC من الصورة قبل مشاركتها — دون إعادة ضغطها، فتبقى الجودة كما هي. لا تُرفع أبدًا.' },
  },
  {
    id: 'image-to-text',
    en: { name: 'Image to Text (OCR)', description: 'Extract text from a photo, screenshot or scan — English, Arabic or both — then copy it or save as .txt. The OCR engine runs in your browser; nothing is uploaded.' },
    ar: { name: 'استخراج النص من صورة', description: 'استخرج النص من صورة أو لقطة شاشة أو مستند ممسوح — بالإنجليزية أو العربية أو كليهما — ثم انسخه أو احفظه كملف .txt. يعمل داخل متصفحك ولا يُرفع شيء.' },
  },
  {
    id: 'pdf-to-images',
    en: { name: 'PDF to Images', description: 'Convert a PDF to images — one PNG, JPG or WebP per page, at screen, print or high-DPI resolution. Pick pages, save each or all as a ZIP. Never uploaded.' },
    ar: { name: 'PDF إلى صور', description: 'حوّل PDF إلى صور — ملف PNG أو JPG أو WebP لكل صفحة، بدقة الشاشة أو الطباعة أو عالية. اختر الصفحات واحفظها منفردة أو في ZIP. لا تُرفع أبدًا.' },
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
    id: 'remove-background',
    en: { name: 'Remove Background', description: 'Automatically remove the background from a photo in your browser and download a transparent PNG. The AI model runs on your device — the image is never uploaded.' },
    ar: { name: 'إزالة الخلفية', description: 'أزل خلفية الصورة تلقائيًا داخل متصفحك ونزّلها بصيغة PNG شفافة. يعمل نموذج الذكاء الاصطناعي على جهازك — لا تُرفع الصورة أبدًا.' },
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
    id: 'hajj-umrah',
    en: { name: 'Hajj & Umrah Guide', description: 'A step-by-step guide to ʿUmrah and Ḥajj — every act with its supplication and its fiqh ruling. Switch between ʿUmrah (default) and Ḥajj, show just the pillars and duties or the full guide with the sunan, and track your progress. Fully offline.' },
    ar: { name: 'دليل الحج والعمرة', description: 'دليل خطوةً بخطوة لأداء العمرة والحج — كل عمل مع دعائه وحكمه الفقهي. بدّل بين العمرة (الافتراضية) والحج، واعرض الأركان والواجبات فقط أو الدليل كاملًا مع السنن، وتتبّع تقدّمك. يعمل دون اتصال.' },
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
    id: 'line-breaks',
    en: { name: 'Line Break Converter', description: 'Auto-flip line spacing — single-spaced lines become double-spaced, double becomes single, mixed normalises to double. Result box with copy and share, all in your browser.' },
    ar: { name: 'محوّل فواصل الأسطر', description: 'تبديل تلقائي لتباعد الأسطر — المفردة تصبح مزدوجة والمزدوجة مفردة والمختلطة تُوحَّد إلى مزدوجة. صندوق ناتج مع نسخ ومشاركة، داخل متصفحك.' },
  },
  {
    id: 'diacritize',
    en: { name: 'Arabic Diacritizer', description: 'Paste Arabic text and AI adds full diacritics (تشكيل) with grammatical case endings, ready to copy. Google sign-in; one run per 24 hours.' },
    ar: { name: 'مُشكِّل النصوص العربية', description: 'الصق نصًّا عربيًّا فيضيف الذكاء الاصطناعي التشكيل الكامل مع الإعراب، جاهزًا للنسخ. تسجيل دخول Google؛ مرة كل ٢٤ ساعة.' },
  },
  {
    id: 'arabic-verbs',
    en: { name: 'Arabic Verb Conjugator', description: 'Enter an Arabic root for the full conjugation — past, present (3 moods), imperative, passive across 13 pronouns, Forms I–X + quadriliteral, derived nouns and emphatics. Weak/irregular roots flagged. All in-browser.' },
    ar: { name: 'مُصرِّف الأفعال العربية', description: 'أدخل جذرًا عربيًّا للتصريف الكامل — الماضي والمضارع (ثلاثة أوجه) والأمر والمجهول عبر ١٣ ضميرًا، الأوزان من فَعَلَ إلى استفعل والرباعي، مع المشتقات والتوكيد. تُنبَّه الجذور المعتلّة والشاذّة. داخل المتصفح.' },
  },
  {
    id: 'paste-to-markdown',
    en: { name: 'Paste Markdown', description: 'Paste from Word, a web page or WordPad and get clean Markdown — line breaks, bold, italics, links, headings, lists, quotes, code and tables. Copy or share; nothing uploaded.' },
    ar: { name: 'لصق ماركداون', description: 'الصق من وورد أو صفحة ويب أو WordPad واحصل على ماركداون نظيف — فواصل أسطر وخط عريض ومائل وروابط وعناوين وقوائم واقتباسات وشيفرة وجداول. انسخ أو شارك؛ لا يُرفع شيء.' },
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
    id: 'currency-converter',
    en: { name: 'Currency Converter', description: 'Convert between the Saudi Riyal and world currencies at up-to-date daily reference rates — swap direction in a tap. Rates from a free public feed, cached for offline use; your amounts never leave your browser.' },
    ar: { name: 'محوّل العملات', description: 'حوّل بين الريال السعودي وعملات العالم بأسعار مرجعية يومية محدّثة — وبدّل الاتجاه بنقرة. أسعار من مصدر عام مجاني تُحفظ للعمل دون اتصال؛ ولا تغادر مبالغك متصفحك.' },
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
  {
    id: 'subtitle-editor',
    en: { name: 'Subtitle Editor', description: 'Open an .srt or .vtt file and fix it: shift every timing earlier or later, apply a frame-rate correction for subtitles that drift, edit any line or timestamp by hand, and save back as SRT or WebVTT. Your file is never uploaded.' },
    ar: { name: 'محرّر ملفات الترجمة', description: 'افتح ملف ‎.srt أو ‎.vtt وأصلحه: أزِح كل التوقيتات للأمام أو للخلف، وطبّق تصحيح معدّل الإطارات للترجمة المنحرفة، وعدّل أي سطر أو توقيت يدويًا، ثم احفظ بصيغة SRT أو WebVTT. لا يُرفع ملفك أبدًا.' },
  },
  {
    id: 'saudi-phone',
    en: { name: 'Saudi Phone Formatter', description: 'Clean up and check Saudi phone numbers. Paste one in any shape — with or without +966, the leading zero, spaces or Arabic-Indic digits — and get the E.164, national and international forms, mobile or landline, the area, and a WhatsApp link. Bulk mode validates a whole list.' },
    ar: { name: 'منسّق الأرقام السعودية', description: 'نظّف أرقام الهاتف السعودية وتحقّق منها. الصق رقمًا بأي صيغة — بـ+966 أو بدونه، بالصفر أو بدونه، بمسافات أو أرقام هندية — واحصل على صيغ E.164 والمحلية والدولية، ونوعه جوال أم أرضي، والمنطقة، ورابط واتساب. ووضع القوائم يتحقق من قائمة كاملة دفعة واحدة.' },
  },
  {
    id: 'arabic-numerals',
    en: { name: 'Arabic Numerals Converter', description: 'Convert the digits in any text between Western (0123), Arabic-Indic (٠١٢٣) and Persian (۰۱۲۳) shapes — paste a sentence, a table or a whole document and only the numbers change. Decimal and thousands marks travel with them.' },
    ar: { name: 'محوّل الأرقام العربية والهندية', description: 'حوّل الأرقام داخل أي نص بين الأشكال الإنجليزية (0123) والهندية (٠١٢٣) والفارسية (۰۱۲۳) — الصق جملة أو جدولًا أو مستندًا كاملًا ولن يتغيّر سوى الأرقام، وتنتقل معها علامتا العشرية والآلاف.' },
  },
  {
    id: 'arabic-normalize',
    en: { name: 'Arabic Text Normalizer', description: 'Clean up Arabic text: remove diacritics (تشكيل) and kashida stretching, unify أ إ آ ٱ to ا and ى to ي, drop invisible characters and collapse stray spaces — so the same word typed two ways finally matches in a search or a database.' },
    ar: { name: 'موحّد النص العربي', description: 'نظّف النص العربي: أزل التشكيل والتطويل، ووحّد أ إ آ ٱ إلى ا وى إلى ي، واحذف المحارف الخفية، وادمج المسافات الزائدة — لتتطابق الكلمة نفسها مهما اختلفت طريقة كتابتها في البحث أو قاعدة البيانات.' },
  },
  {
    id: 'metronome',
    en: { name: 'Metronome', description: 'Tempo from 30 to 300, any time signature, subdivisions and an accented downbeat. Beats are scheduled on the audio clock rather than a JavaScript timer — a timer drifts by tens of milliseconds under load and stops in a background tab, which is audibly wrong within a few bars.' },
    ar: { name: 'ميقاتية (متـرونوم)', description: 'إيقاع من ٣٠ إلى ٣٠٠، وأي ميزان، وتقسيمات ونبضة أولى مشدّدة. تُجدوَل النبضات على ساعة الصوت لا على مؤقّت جافاسكربت — فالمؤقّت ينحرف بعشرات الأجزاء من الثانية ويتوقّف في تبويب خلفي، وهو خطأ مسموع خلال مازورات قليلة.' },
  },
  {
    id: 'tuner',
    en: { name: 'Instrument Tuner', description: 'A chromatic tuner with presets for guitar, bass, ukulele, oud and violin, and an adjustable reference pitch. Pitch is found by autocorrelation — on a guitar or an oud the loudest partial is often the second harmonic, so a peak-picking tuner reads the low string an octave high. The audio never leaves the page.' },
    ar: { name: 'موالف الآلات الموسيقية', description: 'موالف كروماتي بإعدادات جاهزة للجيتار والباص واليوكوليلي والعود والكمان، مع نغمة مرجعية قابلة للضبط. تُستخرج النغمة بالارتباط الذاتي — ففي الجيتار أو العود يكون أعلى تردد جزئي هو التوافقي الثاني غالبًا، فيقرأ الموالف القائم على القمم الوتر المنخفض أوكتافًا أعلى. ولا يغادر الصوت الصفحة.' },
  },
  {
    id: 'bpm-tap',
    en: { name: 'Tap BPM', description: 'Find a track’s tempo by tapping along. It averages over a sliding window so it follows a tempo change instead of burying it, and it tells you how steady your tapping was. It also gives the quarter, eighth and dotted-eighth times in milliseconds, which is what a delay pedal wants.' },
    ar: { name: 'قياس الإيقاع بالنقر', description: 'اعرف إيقاع مقطع بالنقر معه. تحسب الأداة المتوسط على نافذة متحركة فتتابع تغيّر الإيقاع بدل أن تدفنه، وتخبرك بمدى ثبات نقرك. وتعطيك أزمنة النغمة الربعية والثمانية والثمانية المنقوطة بالمللي ثانية، وهو ما يحتاجه جهاز التأخير.' },
  },
  {
    id: 'sound-meter',
    en: { name: 'Sound Level Meter', description: 'A live level meter using your microphone, with a running graph and peak hold. It shows relative loudness in dBFS, not calibrated decibels — a browser cannot know which microphone it is behind or what gain the system applied. Good for comparing two rooms; not for judging whether a workplace is safe.' },
    ar: { name: 'مقياس مستوى الصوت', description: 'مقياس مستوى حي عبر الميكروفون، مع رسم متحرك وحفظ للذروة. يعرض الجهارة النسبية بوحدة dBFS لا الديسيبل المعاير — فالمتصفح لا يعرف أي ميكروفون خلفه ولا الكسب الذي طبّقه النظام. مناسب لمقارنة غرفتين؛ لا للحكم على سلامة بيئة عمل.' },
  },
  {
    id: 'passphrase',
    en: { name: 'Passphrase Generator', description: 'Build a passphrase from a 1296-word list — 10.3 bits a word, short enough to type. You can also roll physical dice and enter the numbers, the original diceware method and the only version whose randomness you need not take on trust. There is an Arabic wordlist too.' },
    ar: { name: 'مولّد عبارات المرور', description: 'ابنِ عبارة مرور من قائمة بـ١٢٩٦ كلمة — ١٠٫٣ بت لكل كلمة، وقصيرة بما يكفي للكتابة. ويمكنك رمي نرد حقيقي وإدخال الأرقام، وهي طريقة diceware الأصلية والنسخة الوحيدة التي لا تضطر لتصديق أحد في عشوائيتها. وهناك قائمة كلمات عربية أيضًا.' },
  },
  {
    id: 'colour-blind',
    en: { name: 'Colour Blindness Simulator', description: 'See a palette or an image as someone with colour vision deficiency sees it — and which pairs of your colours collapse into the same thing. Around one man in twelve has some form of it, so a chart relying on red-versus-green is unreadable to a real share of your users.' },
    ar: { name: 'محاكي عمى الألوان', description: 'شاهد لوحة ألوان أو صورة كما يراها من لديه قصور في رؤية الألوان — وأي أزواج ألوانك تنهار إلى الشيء نفسه. فنحو رجل من كل اثني عشر لديه شكل منه، ما يجعل رسمًا يعتمد على الأحمر مقابل الأخضر غير مقروء لشريحة حقيقية من مستخدميك.' },
  },
  {
    id: 'svg-optimise',
    en: { name: 'SVG Optimiser', description: 'Shrink an SVG by removing Inkscape, Illustrator and Figma metadata, rounding coordinates and squeezing out whitespace — then shows the result rendered so you can see nothing broke. Deliberately conservative: it will not merge paths or strip referenced ids.' },
    ar: { name: 'محسّن ملفات SVG', description: 'صغّر ملف SVG بإزالة بيانات إنكسكيب وإليستريتور وفيغما، وتقريب الإحداثيات، وعصر المسافات — ثم يعرض الناتج مرسومًا لترى أن شيئًا لم ينكسر. متحفّظ عن قصد: لا يدمج المسارات ولا يحذف معرّفًا مُشارًا إليه.' },
  },
  {
    id: 'batch-watermark',
    en: { name: 'Batch Watermark', description: 'Watermark a whole folder of images at once with text or a logo, then download them as a zip. The mark is sized as a share of each image rather than in fixed pixels, so a 4000-pixel photo and an 800-pixel one come back looking the same.' },
    ar: { name: 'علامة مائية على دفعة صور', description: 'ضع علامة مائية نصية أو شعارًا على مجلد صور كامل دفعة واحدة، ثم نزّلها في ملف مضغوط. ويُحسب حجم العلامة كنسبة من كل صورة لا ببكسلات ثابتة، فتعود صورة بعرض ٤٠٠٠ بكسل وأخرى بـ٨٠٠ متشابهتين.' },
  },
  {
    id: 'pdf-booklet',
    en: { name: 'Booklet & N-up', description: 'Impose a PDF for printing: booklet order so a folded, stapled stack reads correctly, or two and four pages to a sheet to save paper. A booklet is not pages 1,2,3,4 on sheets — the outermost sheet carries the last page beside the first. Right-to-left binding for Arabic documents.' },
    ar: { name: 'ترتيب الكتيّب وتوفير الورق', description: 'رتّب ملف PDF للطباعة: ترتيب كتيّب ليُقرأ بشكل صحيح بعد الطي والتدبيس، أو صفحتين وأربع صفحات في الورقة لتوفير الورق. فالكتيّب ليس صفحات ١ و٢ و٣ و٤ على الأوراق — إذ تحمل الورقة الخارجية الصفحة الأخيرة بجوار الأولى. مع تجليد من اليمين للمستندات العربية.' },
  },
  {
    id: 'pdf-stamp',
    en: { name: 'Page Numbers & Watermark', description: 'Stamp a PDF without flattening it — page numbers in any position and format including Arabic-Indic, a header, a footer and a diagonal watermark. Start numbering after the cover and say what number that page carries. The text underneath stays searchable and selectable.' },
    ar: { name: 'ترقيم صفحات PDF والعلامة المائية', description: 'اختم ملف PDF دون تسطيحه — أرقام صفحات بأي موضع وصيغة بما فيها الأرقام الهندية، وترويسة وتذييل وعلامة مائية مائلة. ابدأ الترقيم بعد الغلاف وحدّد الرقم الذي تحمله تلك الصفحة. ويبقى النص تحتها قابلًا للبحث والتحديد.' },
  },
  {
    id: 'label-sheet',
    en: { name: 'Label Sheets', description: 'Print a list onto adhesive labels — addresses, names, asset tags — on the common A4 and US Letter stocks at their published measurements. You can start at any label position, so a sheet with twelve left on it is not wasted. Arabic names are shaped and laid out correctly.' },
    ar: { name: 'مولّد أوراق الملصقات', description: 'اطبع قائمة على ورقة ملصقات لاصقة — عناوين أو أسماء أو وسوم أصول — على مقاسات A4 وLetter الشائعة وبمقاييسها المنشورة. ويمكنك البدء من أي موضع ملصق، فلا تُهدر ورقة بقي فيها اثنا عشر ملصقًا. وتُشكَّل الأسماء العربية بشكل صحيح.' },
  },
  {
    id: 'certificate',
    en: { name: 'Certificate Generator', description: 'Make certificates of completion or participation for a whole list at once — paste the names, set the wording and signature lines, and download every page in one PDF. Arabic and Latin names both render correctly, including mixed in one list.' },
    ar: { name: 'مولّد الشهادات', description: 'أنشئ شهادات إتمام أو مشاركة لقائمة كاملة دفعة واحدة — الصق الأسماء، واضبط النص وسطور التوقيع، ونزّل كل الصفحات في ملف PDF واحد. وتظهر الأسماء العربية واللاتينية بشكل صحيح، حتى مختلطة في قائمة واحدة.' },
  },
  {
    id: 'pdf-redact',
    en: { name: 'Redact a PDF', description: 'Drag over anything that has to go. A black rectangle drawn in a PDF viewer hides nothing — the text stays in the file and can be selected, copied or extracted with one command. This rebuilds each page as an image so the words genuinely cease to exist, then re-reads the export to prove none are left.' },
    ar: { name: 'حجب معلومات من ملف PDF', description: 'اسحب فوق كل ما يجب إزالته. فالمربع الأسود المرسوم في قارئ PDF لا يخفي شيئًا — إذ يبقى النص في الملف ويمكن تحديده أو نسخه أو استخراجه بأمر واحد. تعيد الأداة بناء كل صفحة صورةً فتزول الكلمات فعلًا، ثم تعيد قراءة الملف المُصدَّر لتثبت ذلك.' },
  },
  {
    id: 'video-gif',
    en: { name: 'Video to GIF', description: 'Turn a clip into an animated GIF without uploading it anywhere. Choose the start, length, frame rate, width and colour count. All frames share one palette so the animation does not flicker the way cheap converters make it, and it tells you when the file has grown past the point anyone will wait for it.' },
    ar: { name: 'تحويل الفيديو إلى صورة متحركة', description: 'حوّل مقطعًا إلى صورة GIF متحركة دون رفعه. اختر البداية والمدة ومعدّل الإطارات والعرض وعدد الألوان. وتتشارك كل الإطارات لوحة ألوان واحدة فلا ترتجف الحركة كما تفعل المحوّلات الرديئة، وتنبّهك حين يتجاوز الحجم ما يصبر عليه أحد.' },
  },
  {
    id: 'carousel-split',
    en: { name: 'Carousel Splitter', description: 'Cut a panorama or wide graphic into Instagram carousel slides that read as one continuous picture when someone swipes. Each slide comes out at the platform’s aspect ratio — which is what makes the seams meet — and the files are numbered so they upload in order.' },
    ar: { name: 'مقسّم صور الكاروسيل', description: 'قسّم صورة بانورامية أو رسمًا عريضًا إلى شرائح كاروسيل انستقرام تُقرأ كصورة واحدة متصلة عند التمرير. تخرج كل شريحة بنسبة أبعاد المنصة — وهو ما يجعل الحواف تلتقي — وتُرقَّم الملفات لترفعها بالترتيب.' },
  },
  {
    id: 'csv-merge',
    en: { name: 'CSV Merge & Join', description: 'Match two CSV exports on a column they share — an id, an email, an order number — and get one file with both sides’ data, told how many rows matched and how many found nothing. Or stack two files aligned by column NAME rather than position, because positional stacking silently moves a phone number into the city column.' },
    ar: { name: 'دمج وربط ملفات CSV', description: 'اربط تصديرَي CSV بعمود مشترك — معرّف أو بريد أو رقم طلب — لتحصل على ملف واحد يحمل بيانات الجانبين، مع عدد الصفوف المطابقة وغير المطابقة. أو ضعهما معًا متوائمين بأسماء الأعمدة لا بمواقعها، لأن الدمج بالمواقع ينقل رقم الهاتف إلى عمود المدينة بصمت.' },
  },
  {
    id: 'glucose-units',
    en: { name: 'Blood Sugar Converter', description: 'Convert a blood glucose reading between mg/dL and mmol/L, and HbA1c between % and mmol/mol, with the estimated average glucose. Saudi labs report mg/dL while most research uses mmol/L, and the factor between them is 18. It says where a reading falls and flags one low or high enough to need acting on now.' },
    ar: { name: 'محوّل قراءات سكر الدم', description: 'حوّل قراءة سكر الدم بين mg/dL وmmol/L، والسكر التراكمي بين ٪ وmmol/mol، مع متوسط السكر التقديري. تستخدم المختبرات في السعودية mg/dL بينما تستخدم معظم الأبحاث mmol/L، والمعامل بينهما ١٨. وتبيّن الأداة أين تقع القراءة وتنبّه إلى ما يستدعي تصرّفًا فوريًا.' },
  },
  {
    id: 'sleep-cycle',
    en: { name: 'Sleep Cycle Calculator', description: 'Work backwards from when you need to be up, or forwards from now, to the times that land at the end of a ~90-minute sleep cycle rather than mid deep sleep. Allows for the time it takes to fall asleep, shows Fajr, and marks the last third of the night for qiyām.' },
    ar: { name: 'حاسبة دورات النوم', description: 'احسب رجوعًا من وقت استيقاظك، أو تقدّمًا من الآن، إلى الأوقات التي تقع في نهاية دورة نوم مدتها نحو ٩٠ دقيقة بدل وسط النوم العميق. تحتسب وقت الخلود للنوم، وتعرض الفجر، وتحدّد الثلث الأخير من الليل للقيام.' },
  },
  {
    id: 'water-intake',
    en: { name: 'Water Intake Calculator', description: 'Work out a day’s water from your body weight, then add what the heat, your activity and time in the sun actually cost — because “eight glasses a day” describes a mild climate and says nothing about a Riyadh summer. Shows how the total is made up and how to fit it between iftar and suhoor.' },
    ar: { name: 'حاسبة شرب الماء اليومي', description: 'احسب ماء يومك من وزن جسمك، ثم أضف ما يكلّفك إياه الحر والنشاط والشمس فعلًا — فعبارة «ثمانية أكواب يوميًا» تصف مناخًا معتدلًا ولا تقول شيئًا عن صيف الرياض. وتعرض كيف تكوّن المجموع وكيف توزّعه بين الإفطار والسحور.' },
  },
  {
    id: 'hijri-age',
    en: { name: 'Hijri Age Calculator', description: 'Enter a date of birth in either calendar and get your exact age in both — years, months and days, total days lived, and your next Hijri birthday. A Hijri year is about 354 days, so a Hijri age runs ahead by roughly a year every 33, which is why subtracting year numbers gives the wrong answer.' },
    ar: { name: 'حاسبة العمر الهجري', description: 'أدخل تاريخ ميلادك بأي من التقويمين لتحصل على عمرك الدقيق بهما — بالسنوات والأشهر والأيام، ومجموع الأيام، وميلادك الهجري القادم. السنة الهجرية نحو ٣٥٤ يومًا، لذا يسبق العمر الهجري بنحو سنة كل ٣٣، ولهذا يعطي طرح أرقام السنوات نتيجة خاطئة.' },
  },
  {
    id: 'medicine-schedule',
    en: { name: 'Medicine Timing Planner', description: 'Spread doses evenly across your waking day, or across the window between iftar and suhoor — about ten hours rather than twenty-four. Each dose is anchored to the nearest prayer, easier to remember than a clock time, and it warns when four doses will not fit comfortably in a fasting night.' },
    ar: { name: 'مخطّط مواعيد الدواء', description: 'وزّع الجرعات بالتساوي على ساعات يقظتك، أو على النافذة بين الإفطار والسحور — وهي نحو عشر ساعات لا أربع وعشرين. وتُربط كل جرعة بأقرب صلاة لأنها أسهل في التذكّر، وتنبّهك حين لا تتسع ليلة الصيام لأربع جرعات.' },
  },
  {
    id: 'franco-arabic',
    en: { name: 'Franco-Arabic Converter', description: 'Convert Franco-Arabic — the chat alphabet where 3 is ع, 7 is ح and 5 is خ — into proper Arabic writing, or go the other way. Common words are recognised whole so the result reads like Arabic, and genuinely ambiguous letters are listed so you can check them.' },
    ar: { name: 'محوّل الفرانكو إلى عربي', description: 'حوّل الفرانكو — أبجدية الدردشة حيث ٣ تعني ع و٧ تعني ح و٥ تعني خ — إلى كتابة عربية سليمة، أو اعكس الاتجاه. تُعرف الكلمات الشائعة ككلمات كاملة ليقرأ الناتج كعربية، وتُذكر الحروف الملتبسة لتراجعها.' },
  },
  {
    id: 'team-maker',
    en: { name: 'Random Team Maker', description: 'Paste a list of names and split them into teams — by how many teams you want, or how many people each should hold. Name people to keep apart and they land on different teams. The shuffle uses cryptographic randomness with a proper Fisher-Yates, so every arrangement really is equally likely.' },
    ar: { name: 'مولّد الفرق العشوائي', description: 'الصق قائمة أسماء ووزّعها على فرق — بعدد الفرق أو بعدد الأفراد في كل فريق. سمِّ من تريد الفصل بينهم فيقعون في فرق مختلفة. يستخدم الخلط عشوائية تعموية بخوارزمية فيشر-ييتس الصحيحة، فيكون كل ترتيب محتملًا بالتساوي.' },
  },
  {
    id: 'quotation',
    en: { name: 'Quotation & Receipt', description: 'Write a quotation, a proforma invoice or a payment receipt, bilingual and ready to print or save as PDF. Line items, 15% VAT, your terms, and the fields each document actually needs. It says plainly what these are not: neither is a tax invoice.' },
    ar: { name: 'عرض سعر وسند قبض', description: 'اكتب عرض سعر أو فاتورة مبدئية أو سند قبض، بلغتين وجاهزًا للطباعة أو الحفظ PDF. بنود وضريبة ١٥٪ وشروطك، والحقول التي يحتاجها كل مستند. وتوضّح الأداة صراحةً أن أيًّا منها ليس فاتورة ضريبية.' },
  },
  {
    id: 'char-finder',
    en: { name: 'Character Finder', description: 'Search for the character you need by name — arrows, maths symbols, currency, Arabic marks and ligatures like ﷺ and ﷼, punctuation, ticks and crosses — then tap to copy. Inspect mode goes the other way: paste anything and see exactly what each character is.' },
    ar: { name: 'باحث المحارف والرموز', description: 'ابحث عن المحرف الذي تريده بالاسم — أسهم ورموز رياضية وعملات وعلامات عربية وتركيبات مثل ﷺ و﷼ وعلامات ترقيم وصح وخطأ — ثم انقر لنسخه. ووضع الفحص يعمل بالعكس: الصق أي شيء لترى حقيقة كل محرف.' },
  },
  {
    id: 'paper-generator',
    en: { name: 'Printable Paper', description: 'Make your own paper and print it: graph paper, dot grid, ruled lines, isometric, Cornell notes, music staves, and a four-line Arabic handwriting guide. Set the spacing in millimetres, the margin, the ink and the page count. Downloads as a PDF, so the spacing you asked for is what prints.' },
    ar: { name: 'مولّد الورق للطباعة', description: 'اصنع ورقك واطبعه: ورق مربعات ونقاط ومسطّر ومتساوي القياس وملاحظات كورنيل ومدرّج موسيقي ومسطّر رباعي لتدريب الخط العربي. حدّد التباعد بالمليمتر والهامش واللون وعدد الصفحات. يُنزَّل بصيغة PDF، فالتباعد الذي طلبته هو ما يُطبع.' },
  },
  {
    id: 'color-palette',
    en: { name: 'Palette from Image', description: 'Extract the palette from any image — the colours that are actually in it, ranked by how much of the picture each covers, with hex, RGB and HSL. Export as CSS custom properties, a Tailwind colour block or JSON. The same image always gives the same palette.' },
    ar: { name: 'استخراج لوحة الألوان من صورة', description: 'استخرج لوحة الألوان من أي صورة — الألوان الموجودة فيها فعلًا، مرتّبة بحسب مساحتها، مع قيم hex وRGB وHSL. صدّرها متغيّرات CSS أو كتلة ألوان Tailwind أو JSON. الصورة نفسها تعطي اللوحة نفسها دائمًا.' },
  },
  {
    id: 'json-diff',
    en: { name: 'JSON Diff', description: 'A line diff on JSON is close to useless: reformatting makes every line look changed while the data is identical. This compares values by path and lists exactly what was added, removed or changed, with an option to treat arrays as unordered.' },
    ar: { name: 'مقارنة ملفات JSON', description: 'المقارنة السطرية لملفات JSON عديمة الجدوى تقريبًا: إعادة التنسيق تجعل كل سطر يبدو متغيّرًا والبيانات نفسها. تقارن هذه الأداة القيم بالمسار وتسرد ما أُضيف وما حُذف وما تغيّر، مع خيار التعامل مع المصفوفات كغير مرتّبة.' },
  },
  {
    id: 'hex-viewer',
    en: { name: 'Hex Viewer', description: 'Open any file and look at its actual bytes, with the printable characters alongside so embedded strings stand out. It reads the magic number to say what the file really is, and tells you when the extension and the contents disagree. Search for text or bytes, and jump to any offset.' },
    ar: { name: 'عارض الملفات السداسي عشري', description: 'افتح أي ملف واطّلع على بايتاته الفعلية، مع المحارف المقروءة بجانبها لتبرز النصوص المخبوءة. تقرأ الأداة الرقم السحري لتخبرك بحقيقة الملف، وتنبّهك حين يختلف الامتداد عن المحتوى. ابحث عن نص أو بايتات وانتقل إلى أي إزاحة.' },
  },
  {
    id: 'sun-times',
    en: { name: 'Sunrise, Sunset & Golden Hour', description: 'Sunrise, sunset, solar noon, the three twilights, and the golden and blue hours for any place and date — computed from the sun’s actual altitude rather than a rule of thumb like “an hour after sunrise”. Shows the Hijri date and prayer times for the same spot.' },
    ar: { name: 'الشروق والغروب والساعة الذهبية', description: 'الشروق والغروب والظهيرة الشمسية والشفق بأنواعه الثلاثة والساعتان الذهبية والزرقاء لأي مكان وتاريخ — محسوبة من ارتفاع الشمس الفعلي لا من قاعدة تقريبية مثل «ساعة بعد الشروق». وتعرض التاريخ الهجري وأوقات الصلاة للموضع نفسه.' },
  },
  {
    id: 'barcode',
    en: { name: 'Barcode Generator', description: 'Generate a real, scannable barcode — EAN-13 and EAN-8 for retail, UPC-A for North America, and Code 128 for any text on a shipping or shelf label. The check digit is calculated for you and the quiet zone is included, because without it a scanner cannot find the code.' },
    ar: { name: 'مولّد الباركود', description: 'ولّد باركود حقيقيًا قابلًا للمسح — EAN-13 وEAN-8 للتجزئة، وUPC-A لأمريكا الشمالية، وCode 128 لأي نص على ملصق شحن أو رف. يُحسب رقم التحقق نيابةً عنك، ويُضمَّن الهامش الصامت لأن الماسح لا يجد الرمز بدونه.' },
  },
  {
    id: 'curl-convert',
    en: { name: 'cURL Converter', description: 'Copy a request as cURL from your browser’s network tab and paste it here to get the same request as fetch, Node, axios, Python requests or HTTPie. Quoting, line continuations, multiple headers and JSON bodies are handled properly, and nothing leaves the page.' },
    ar: { name: 'محوّل أوامر cURL', description: 'انسخ طلبًا بصيغة cURL من تبويب الشبكة في متصفحك والصقه هنا لتحصل عليه بصيغة fetch أو Node أو axios أو Python requests أو HTTPie. تُعالَج علامات الاقتباس وأسطر المتابعة والترويسات وأجسام JSON بشكل صحيح، ولا يغادر شيء الصفحة.' },
  },
  {
    id: 'coordinates',
    en: { name: 'Coordinate Converter', description: 'Paste coordinates in any common form — decimal, degrees-minutes-seconds, or degrees and decimal minutes — and get every other form back, including UTM and MGRS for survey and field maps. Add a second point for the distance and bearing between them.' },
    ar: { name: 'محوّل الإحداثيات', description: 'الصق إحداثيات بأي صيغة شائعة — عشرية أو درجات ودقائق وثوانٍ أو درجات ودقائق عشرية — لتحصل على بقية الصيغ، بما فيها UTM وMGRS لخرائط المساحة والميدان. أضف نقطة ثانية لتعرف المسافة والاتجاه بينهما.' },
  },
  {
    id: 'url-parser',
    en: { name: 'URL Parser & Builder', description: 'Break a URL into its scheme, host, path, fragment and query parameters, edit any of them, and get a correctly-encoded URL back. It also spots tracking parameters — utm_*, gclid, fbclid and friends — and strips them in one click.' },
    ar: { name: 'محلّل الروابط ومحرّرها', description: 'فكّك رابطًا إلى بروتوكوله ومضيفه ومساره وجزئه ومعاملاته، وعدّل أيًّا منها، ثم احصل على رابط مُرمّز بشكل صحيح. وتكشف الأداة معاملات التتبّع — ‎utm_*‎ وgclid وfbclid وأمثالها — وتزيلها بنقرة واحدة.' },
  },
  {
    id: 'link-preview',
    en: { name: 'Link Preview Checker', description: 'Paste your page’s meta tags and see the card WhatsApp, X, LinkedIn and Facebook will actually render, then a list of what will go wrong — a missing og:image, a title that will be truncated, a relative image path crawlers will not resolve.' },
    ar: { name: 'فاحص معاينة الروابط', description: 'الصق وسوم صفحتك وشاهد البطاقة التي سيعرضها واتساب وإكس ولينكدإن وفيسبوك فعلًا، ثم قائمة بما سيختل — صورة og مفقودة، أو عنوان سيُقتطع، أو مسار صورة نسبي لن تحلّه الزواحف.' },
  },
  {
    id: 'csv-clean',
    en: { name: 'CSV Cleaner', description: 'Clean up a CSV without opening a spreadsheet — trim stray spaces, drop blank rows and entirely empty columns, and remove duplicate rows. It detects the separator itself and flags rows whose field count does not match the header, which is what usually breaks an import.' },
    ar: { name: 'منظّف ملفات CSV', description: 'نظّف ملف CSV دون فتح برنامج جداول — شذّب المسافات الزائدة، واحذف الصفوف الفارغة والأعمدة الفارغة، وأزل الصفوف المكرّرة. تكتشف الأداة الفاصل بنفسها وتُظهر الصفوف التي يختلف عدد حقولها عن العناوين، وهو ما يُفسد الاستيراد عادةً.' },
  },
  {
    id: 'data-anonymize',
    en: { name: 'Data Anonymizer', description: 'Before you send a spreadsheet to a colleague, a vendor or a chatbot, remove the parts that identify a person — emails, phone numbers, IBANs, Saudi ID and iqama numbers, card numbers, IPs. Mask, redact, or replace each value with a stable label. Runs entirely in this page.' },
    ar: { name: 'إخفاء البيانات الشخصية', description: 'قبل أن ترسل جدولًا إلى زميل أو مورّد أو روبوت محادثة، أزل ما يدل على الأشخاص — البُرد الإلكترونية وأرقام الهواتف والآيبان والهوية والإقامة والبطاقات وعناوين IP. أخفِها أو احجبها أو استبدلها بعلامات ثابتة. تعمل داخل الصفحة بالكامل.' },
  },
  {
    id: 'invisible-chars',
    en: { name: 'Invisible Character Finder', description: 'Text copied from a web page, a PDF or a chatbot often carries characters that are present but invisible — zero-width spaces, direction marks, exotic spaces, control codes. They break exact matching and search in ways that look like a bug in your code. This finds, names and removes them.' },
    ar: { name: 'كاشف المحارف الخفية', description: 'النص المنسوخ من صفحة ويب أو PDF أو روبوت محادثة يحمل غالبًا محارف غير مرئية — مسافات بعرض صفري وعلامات اتجاه ومسافات غريبة ورموز تحكّم. وهي تُفسد المطابقة والبحث بطريقة تبدو كخلل في كودك. تكشفها الأداة وتسمّيها وتزيلها.' },
  },
  {
    id: 'timezone-planner',
    en: { name: 'Time Zone Planner', description: 'Add the places your people are in and see the whole day at once, colour-coded by whether each hour lands in working hours, at the edges, or in the middle of the night. It ranks the best slots for everyone, with daylight saving on the chosen date already handled.' },
    ar: { name: 'مخطّط المناطق الزمنية', description: 'أضف أماكن فريقك وشاهد اليوم كاملًا دفعة واحدة، ملوّنًا بحسب وقوع كل ساعة في وقت العمل أو على أطرافه أو في منتصف الليل. وترتّب الأداة أفضل الأوقات للجميع، والتوقيت الصيفي في التاريخ المختار محسوب أصلًا.' },
  },
  {
    id: 'calorie-needs',
    en: { name: 'Calorie & BMI Calculator', description: 'Work out how much you actually burn in a day and what to eat for your goal — resting burn, total daily burn, a calorie target for losing, holding or gaining, and a reasonable protein/carb/fat split, plus your BMI and healthy weight range. Uses Mifflin-St Jeor, which measures closest to reality.' },
    ar: { name: 'حاسبة السعرات ومؤشر كتلة الجسم', description: 'احسب كم تحرق فعلًا في اليوم وماذا تأكل لهدفك — الحرق في الراحة والحرق اليومي وهدف السعرات للإنقاص أو المحافظة أو الزيادة، وتوزيعًا معقولًا للبروتين والكربوهيدرات والدهون، مع مؤشر كتلة جسمك ونطاق الوزن الصحي. تستخدم معادلة ميفلين-سانت جيور الأقرب للواقع.' },
  },
  {
    id: 'screenshot-frame',
    en: { name: 'Screenshot Beautifier', description: 'Paste or drop a screenshot and it comes back padded, rounded and sitting on a backdrop instead of floating on white — ready for a slide, a post or a README. Pick the shape, corner radius and shadow, then export at up to 3×.' },
    ar: { name: 'تجميل لقطات الشاشة', description: 'الصق لقطة شاشة أو ألقِها لتعود بهوامش وحواف دائرية وخلفية بدل أن تطفو على بياض — جاهزة لشريحة أو منشور أو ملف README. اختر الشكل ونصف قطر الحواف والظل، ثم صدّر بدقة تصل إلى ٣ أضعاف.' },
  },
  {
    id: 'social-resize',
    en: { name: 'Social Media Resizer', description: 'Resize one image to every size the platforms want — Instagram square, portrait and story, X post and header, LinkedIn, a YouTube thumbnail, a Facebook cover and an Open Graph preview. Fill and crop or fit the whole image, and take them all as one zip.' },
    ar: { name: 'محوّل مقاسات السوشال ميديا', description: 'غيّر مقاس صورة واحدة إلى كل ما تطلبه المنصات — انستقرام مربع وطولي وستوري، ومنشور وغلاف إكس، ولينكدإن، وصورة يوتيوب المصغّرة، وغلاف فيسبوك، ومعاينة الرابط. املأ واقتصّ أو أظهر الصورة كاملة، وخذها كلها في ملف مضغوط واحد.' },
  },
  {
    id: 'spin-wheel',
    en: { name: 'Wheel of Names', description: 'A spinning wheel for picking a name fairly — for a classroom, a giveaway, a team draw or deciding who presents first. Paste the names, spin, and optionally drop each winner. The result uses the browser’s cryptographic random source, not Math.random.' },
    ar: { name: 'عجلة الأسماء', description: 'عجلة دوّارة لاختيار اسم بعدل — لفصل دراسي أو مسابقة أو توزيع فريق أو تحديد من يعرض أولًا. الصق الأسماء وأدر العجلة، ويمكنك حذف كل فائز. تُختار النتيجة عبر مصدر العشوائية التعموي في المتصفح لا عبر Math.random.' },
  },
  {
    id: 'hmac',
    en: { name: 'HMAC Generator', description: 'Compute an HMAC over any message with a shared secret — SHA-256, SHA-1, SHA-384 or SHA-512, key as text, hex or base64, output as hex or base64. Paste the value you were sent and it tells you whether it matches, which is what you need when debugging a webhook signature.' },
    ar: { name: 'مولّد HMAC والتحقق منه', description: 'احسب قيمة HMAC لأي رسالة بمفتاح مشترك — بخوارزميات SHA-256 أو SHA-1 أو SHA-384 أو SHA-512، ومفتاح بصيغة نص أو hex أو base64. الصق القيمة التي وصلتك لتخبرك الأداة إن كانت مطابقة، وهو ما تحتاجه عند تتبّع توقيع ويب هوك.' },
  },
  {
    id: 'cron-builder',
    en: { name: 'Cron Builder', description: 'Build a cron expression without remembering the field order — choose daily, weekly, monthly or every few minutes. It lists the next five times the schedule would actually fire, and warns about the day-of-month and day-of-week trap where cron fires when either matches.' },
    ar: { name: 'مولّد تعبير الكرون', description: 'ابنِ تعبير كرون دون حفظ ترتيب الحقول — اختر يوميًا أو أسبوعيًا أو شهريًا أو كل بضع دقائق. تعرض الأداة المواعيد الخمسة القادمة فعلًا، وتنبّهك إلى مأزق يوم الشهر ويوم الأسبوع حيث يعمل الكرون إذا تطابق أحدهما.' },
  },
  {
    id: 'passport-photo',
    en: { name: 'Passport Photo Maker', description: 'Turn an ordinary photo into an ID photo at the right size — Saudi 4×6 cm, the 35×45 mm passport standard, US 2×2 in and more. Guides show where your head, chin and eyes must sit, and you can print several on one sheet with cut lines. Never uploaded.' },
    ar: { name: 'مولّد صور الجواز والمعاملات', description: 'حوّل صورة عادية إلى صورة رسمية بالمقاس الصحيح — ٤×٦ سم السعودي، ومعيار الجواز ٣٥×٤٥ مم، و٢×٢ إنش وغيرها. تُظهر الخطوط أين يقع الرأس والذقن والعينان، ويمكنك طباعة عدة نسخ على ورقة واحدة مع خطوط القص. لا تُرفع أبدًا.' },
  },
  {
    id: 'audio-trim',
    en: { name: 'Audio Trimmer', description: 'Open an MP3, M4A, WAV, OGG or FLAC, drag across the waveform to pick the part you want, listen back, and save just that. A short fade at each end stops the cut clicking. Nothing is uploaded.' },
    ar: { name: 'قص الملفات الصوتية', description: 'افتح ملف MP3 أو M4A أو WAV أو OGG أو FLAC، واسحب على الموجة لاختيار الجزء الذي تريده، واستمع إليه، ثم احفظه وحده. ويمنع تلاشٍ قصير في الطرفين صوت الطقطقة. لا يُرفع شيء.' },
  },
  {
    id: 'video-audio',
    en: { name: 'Extract Audio from Video', description: 'Pull the soundtrack out of an MP4, MOV, WebM or MKV and save it as an audio file. The video is decoded in your browser — never uploaded, never watched, and only the audio track is read.' },
    ar: { name: 'استخراج الصوت من الفيديو', description: 'استخرج المسار الصوتي من ملف MP4 أو MOV أو WebM أو MKV واحفظه ملفًا صوتيًا. يُفك ترميز الفيديو داخل متصفحك — فلا يُرفع، ولا يُشاهَد، ولا يُقرأ منه إلا مسار الصوت.' },
  },
  {
    id: 'pdf-to-text',
    en: { name: 'PDF to Text', description: 'Get the words out of a PDF as plain text — page by page, in reading order, ready to paste anywhere. If the PDF is a scan with no text in it, the tool says so and points you at OCR instead of handing you an empty box.' },
    ar: { name: 'PDF إلى نص', description: 'استخرج كلمات ملف PDF كنص عادي — صفحةً صفحة وبترتيب القراءة، جاهزًا للصق. وإن كان الملف صورة ممسوحة بلا نص، تخبرك الأداة وتحيلك إلى التعرّف الضوئي بدل صندوق فارغ.' },
  },
  {
    id: 'weather',
    en: { name: 'Weather', description: 'A clean forecast for any Saudi city or your own location: current conditions, the next 24 hours, the week ahead with Hijri dates, UV, and the dust and PM10 reading that matters here — plus the temperature at each prayer time. Prayer times are worked out on your device.' },
    ar: { name: 'الطقس', description: 'نشرة جوية نظيفة لأي مدينة سعودية أو لموقعك: الحالة الآن، والـ٢٤ ساعة القادمة، والأسبوع القادم بالتواريخ الهجرية، والأشعة فوق البنفسجية، وقراءة الغبار وPM10 المهمة هنا — مع درجة الحرارة عند كل وقت صلاة. تُحسب أوقات الصلاة على جهازك.' },
  },
  {
    id: 'id-expiry',
    en: { name: 'Iqama & ID Expiry', description: 'Track when your documents run out. Enter an expiry in either the Hijri or Gregorian calendar and see the days remaining in both, sorted by whichever runs out first — iqama, passport, driving licence, istimara, insurance or a visa. Everything stays in this browser.' },
    ar: { name: 'انتهاء الإقامة والوثائق', description: 'تابع مواعيد انتهاء وثائقك. أدخل تاريخ الانتهاء بالتقويم الهجري أو الميلادي وشاهد الأيام المتبقية بالتقويمين، مرتّبة بحسب الأقرب انتهاءً — الإقامة أو الجواز أو رخصة القيادة أو الاستمارة أو التأمين أو التأشيرة. كل شيء يبقى في هذا المتصفح.' },
  },
  {
    id: 'totp',
    en: { name: '2FA Code Generator', description: 'Turn a two-factor secret into the rolling six-digit code, exactly as an authenticator app would (RFC 6238 TOTP, SHA-1/256/512, 6 or 8 digits). Paste the base32 secret or the whole otpauth:// link. The secret never leaves the page.' },
    ar: { name: 'مولّد رموز التحقق الثنائي', description: 'حوّل مفتاح التحقق الثنائي إلى الرمز المتجدّد من ست خانات، تمامًا كما يفعل تطبيق المصادقة (معيار RFC 6238، وSHA-1 و256 و512، بست أو ثماني خانات). الصق مفتاح base32 أو رابط ‎otpauth://‎ كاملًا. لا يغادر المفتاح الصفحة أبدًا.' },
  },
  {
    id: 'password-strength',
    en: { name: 'Password Strength', description: 'Check a password honestly. Raw entropy flatters something like Password123!, so this penalises what actually makes a password guessable: common words, keyboard walks, runs, repeats, years and predictable shapes. Nothing you type leaves the page.' },
    ar: { name: 'قوة كلمة المرور', description: 'افحص كلمة مرورك بصدق. حساب العشوائية وحده يجامل كلمة مثل Password123!‎، لذا تخصم الأداة ما يجعلها فعلًا قابلة للتخمين: الكلمات الشائعة ومسارات لوحة المفاتيح والتسلسلات والتكرار والسنوات والأنماط المتوقّعة. لا يغادر ما تكتبه الصفحة.' },
  },
  {
    id: 'fix-encoding',
    en: { name: 'Fix Garbled Text', description: 'Repair text that arrived as Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© or â€™ instead of readable characters — the classic mojibake you get when UTF-8 is opened as the wrong codepage. It works out which encoding mangled it and undoes the damage.' },
    ar: { name: 'إصلاح النص المشوّه', description: 'أصلح النص الذي وصل على شكل Ø§Ù„Ø¹Ø±Ø¨ÙŠØ© أو â€™ بدل الحروف المقروءة — التشويه المعتاد حين يُفتح ترميز UTF-8 بترميز خاطئ. تكتشف الأداة الترميز الذي أفسده وتُلغي الضرر.' },
  },
  {
    id: 'saudi-plate',
    en: { name: 'Saudi Plate Converter', description: 'Convert a Saudi vehicle plate between its Arabic and Latin halves. Only 17 Arabic letters appear on plates and each maps to one fixed Latin character (ح is J, م is Z), and the letters run in the opposite order on the Arabic side — so type a plate in either script, in either order, with Arabic or Western digits, and get both halves back exactly as they appear.' },
    ar: { name: 'محوّل اللوحات السعودية', description: 'حوّل لوحة مركبة سعودية بين جانبيها العربي واللاتيني. لا يظهر على اللوحات سوى ١٧ حرفًا عربيًا، ولكل حرف مقابل لاتيني واحد ثابت (ح هي J وم هي Z)، وتسير الحروف بترتيب معاكس في الجانب العربي — فاكتب اللوحة بأي خط وبأي ترتيب، بأرقام هندية أو إنجليزية، واحصل على الجانبين كما يظهران تمامًا.' },
  },
  {
    id: 'short-address',
    en: { name: 'Short Address Checker', description: 'Check a Saudi National Address short code — four letters then four digits, like RRRD2929 — before you put it on a shipment. It catches the ways that goes wrong (digits typed first, a space in the middle, a zero read as an O, Arabic-Indic numerals) and explains what each part means. Format only: only Saudi Post can turn a code into a street.' },
    ar: { name: 'مدقّق العنوان المختصر', description: 'تحقّق من رمز العنوان الوطني المختصر — أربعة حروف ثم أربعة أرقام، مثل RRRD2929 — قبل وضعه على شحنة. تلتقط الأداة ما يختل في ذلك (كتابة الأرقام أولًا، أو مسافة في المنتصف، أو صفر مكان الحرف O، أو أرقام هندية) وتشرح معنى كل جزء. الصيغة فقط: فالبريد السعودي وحده يحوّل الرمز إلى شارع.' },
  },
  {
    id: 'worksheets',
    en: { name: 'Maths Worksheets', description: 'Generate printable arithmetic worksheets — addition, subtraction, multiplication and division in whatever number range you set — with an answer key page that always matches. Every sheet has a code, so a reprint gives you the same questions rather than a new set the key no longer fits. Division problems are built from the answer, so they divide exactly.' },
    ar: { name: 'أوراق تمارين الرياضيات', description: 'أنشئ أوراق تمارين حسابية قابلة للطباعة — جمعًا وطرحًا وضربًا وقسمة ضمن المدى العددي الذي تحدّده — مع صفحة إجابات مطابقة دائمًا. لكل ورقة رمز، فإعادة الطباعة تعطيك الأسئلة نفسها لا مجموعة جديدة لا تناسبها ورقة الإجابات. وتُبنى مسائل القسمة من الناتج فتنتهي بعدد صحيح.' },
  },
  {
    id: 'bingo-cards',
    en: { name: 'Bingo Cards', description: 'Turn a list of words, names or numbers into printable bingo cards — 3×3, 4×4 or 5×5, with an optional free centre. Every card is checked against the others so no two players get the same one, and it says so honestly when your list is too short to make as many distinct cards as you asked for. Comes with a shuffled call list.' },
    ar: { name: 'بطاقات بينغو', description: 'حوّل قائمة كلمات أو أسماء أو أرقام إلى بطاقات بينغو قابلة للطباعة — ٣×٣ أو ٤×٤ أو ٥×٥، مع مربّع حر اختياري في الوسط. تُقارن كل بطاقة بغيرها فلا يحصل لاعبان على البطاقة نفسها، وتخبرك بصراحة حين تكون قائمتك أقصر من أن تصنع العدد المطلوب من البطاقات المختلفة. ومعها قائمة نداء مخلوطة.' },
  },
  {
    id: 'quiz-maker',
    en: { name: 'Quiz Maker', description: 'Write a quiz — multiple choice, true/false and short answer — then print it as a question paper with a separate answer key, or share a link anyone can take in their browser. The link carries the whole quiz after the # in the URL, and a fragment is never sent to a server: nothing is stored and there is no account.' },
    ar: { name: 'صانع الاختبارات', description: 'اكتب اختبارًا — اختيار من متعدد وصح/خطأ وإجابة قصيرة — ثم اطبعه ورقة أسئلة مع ورقة إجابات منفصلة، أو شارك رابطًا يستطيع أي أحد أداءه في متصفحه. يحمل الرابط الاختبار كاملًا بعد علامة # في العنوان، وما بعدها لا يُرسل إلى خادم أبدًا: فلا شيء مخزّن ولا حساب.' },
  },
  {
    id: 'translate',
    en: { name: 'Translator', description: 'Translate between Arabic and 50+ languages using a model that runs inside your browser, so nothing you type is uploaded anywhere — and it keeps working with no connection once the language pack is downloaded. Covers the languages actually spoken at work here: Urdu, Hindi, Bengali, Malayalam, Tamil, Nepali, Sinhala, Amharic, Tigrinya, Somali, Pashto and Farsi. Needs Chrome or Edge 138+ on a computer.' },
    ar: { name: 'المترجم', description: 'ترجم بين العربية وأكثر من ٥٠ لغة عبر نموذج يعمل داخل متصفحك، فلا يُرفع شيء مما تكتبه إلى أي مكان — ويظل يعمل دون اتصال بعد تنزيل حزمة اللغة. ويغطي اللغات المستخدمة فعلًا في العمل هنا: الأردية والهندية والبنغالية والمالايالامية والتاميلية والنيبالية والسنهالية والأمهرية والتيغرينية والصومالية والبشتوية والفارسية. يتطلب Chrome أو Edge 138+ على حاسوب.' },
  },
  {
    id: 'summarize',
    en: { name: 'Summarizer', description: 'Turn a long article, thread, email or set of meeting notes into key points, a TL;DR, a teaser or a headline — using a model that runs inside your browser, so the text is never uploaded. English, Spanish, Japanese, German and French only: the on-device model does not do Arabic yet, and the tool says so rather than guessing. Needs Chrome or Edge 138+ on a computer.' },
    ar: { name: 'الملخِّص', description: 'حوّل مقالًا طويلًا أو سلسلة تغريدات أو بريدًا أو محضر اجتماع إلى نقاط رئيسية أو خلاصة مختصرة أو تشويق أو عنوان — عبر نموذج يعمل داخل متصفحك، فلا يُرفع النص أبدًا. الإنجليزية والإسبانية واليابانية والألمانية والفرنسية فقط: فالنموذج على الجهاز لا يدعم العربية بعد، والأداة تقول ذلك صراحةً بدل أن تخمّن. يتطلب Chrome أو Edge 138+ على حاسوب.' },
  },
  {
    id: 'video-trim',
    en: { name: 'Video Trimmer', description: 'Trim an MP4 or MOV in your browser by copying its frames rather than re-encoding them — so the output is the same video at the same quality, and a half-hour recording trims in seconds instead of minutes. The start of a cut snaps to the nearest keyframe, which the tool shows you on the timeline. Nothing is uploaded.' },
    ar: { name: 'قص الفيديو', description: 'اقتطع ملف MP4 أو MOV داخل متصفحك بنسخ إطاراته بدل إعادة ترميزها — فيخرج المقطع نفسه بالجودة نفسها، ويُقتطع تسجيل نصف الساعة في ثوانٍ لا دقائق. وتنتقل بداية القص إلى أقرب إطار مفتاحي، وتعرض الأداة هذه الإطارات على الشريط الزمني. ولا يُرفع شيء.' },
  },
  {
    id: 'arabic-handwriting',
    en: { name: 'Arabic Handwriting Sheets', description: 'Printable Arabic handwriting practice — every letter in all four of its positional forms (alone, at the start, in the middle, at the end), or any word or name you type. The letters are shaped and joined properly, which is the thing generic worksheet sites get wrong when they print 28 isolated glyphs a child will never meet in a word. Ruled guide lines, faded or dotted tracing, and as many rows as you want.' },
    ar: { name: 'كراسة الخط العربي', description: 'أوراق تدريب على الخط العربي قابلة للطباعة — كل حرف في مواضعه الأربعة (مفردًا، وأول الكلمة، ووسطها، وآخرها)، أو أي كلمة أو اسم تكتبه. والحروف تُشكَّل وتُوصَل على وجهها الصحيح، وهو ما تخطئ فيه مواقع أوراق العمل العامة حين تطبع ٢٨ شكلًا مفردًا لا يلقاها الطفل في كلمة قط. مع أسطر مسطّرة، وتتبّع باهت أو منقّط، وعدد الأسطر الذي تريد.' },
  },
  {
    id: 'xlsx-convert',
    en: { name: 'Excel to CSV / JSON', description: 'Open an Excel .xlsx workbook in your browser and take the data out as CSV, TSV or JSON — nothing is uploaded. Reads every sheet, keeps blank cells in the right columns, and turns date cells back into real dates instead of the five-digit numbers a naive converter emits. Values only: formulas come out as the value the spreadsheet last calculated.' },
    ar: { name: 'إكسل إلى CSV أو JSON', description: 'افتح مصنّف إكسل ‎.xlsx‎ في متصفحك واستخرج بياناته بصيغة CSV أو TSV أو JSON — دون رفع أي شيء. يقرأ كل الأوراق، ويُبقي الخلايا الفارغة في أعمدتها الصحيحة، ويعيد خلايا التواريخ تواريخَ حقيقية بدل الأرقام ذات الخمس خانات التي تخرجها المحوّلات الساذجة. القيم فقط: فالمعادلات تخرج بالقيمة التي حسبها الجدول آخر مرة.' },
  },
  {
    id: 'khatma',
    en: { name: 'Khatma Planner', description: 'Plan a khatma over any stretch of days — Ramadan, a month, a week — divided evenly by page or by juz, with Gregorian and Hijri dates side by side. Print it with a tick box per day, or tick the days off here; your progress stays on this device. Page numbers follow the 604-page Madani mushaf, and the tool says so, because a plan quoting pages from an edition you do not own is worse than no plan.' },
    ar: { name: 'مخطّط الختمة', description: 'خطّط ختمة على أي عدد من الأيام — رمضان أو شهر أو أسبوع — مقسّمة بالتساوي بالصفحات أو بالأجزاء، مع التاريخين الميلادي والهجري جنبًا إلى جنب. اطبعها بمربّع تعليم لكل يوم، أو علّم الأيام هنا؛ ويبقى تقدّمك على جهازك. وأرقام الصفحات بحسب مصحف المدينة ذي الـ٦٠٤ صفحات، والأداة تصرّح بذلك، لأن خطة بأرقام طبعة لا تملكها أسوأ من لا خطة.' },
  },
  {
    id: 'ics-builder',
    en: { name: 'Calendar File (.ics)', description: 'Build a calendar invite anyone can open in Apple Calendar, Outlook or Google, with repeats and a reminder — or paste an .ics you have been sent and see plainly what it says in your own timezone. Follows the parts of RFC 5545 that generators usually skip: lines folded at 75 octets, commas and semicolons escaped, and all-day events written as dates rather than midnight-to-midnight.' },
    ar: { name: 'ملف تقويم (‎.ics‎)', description: 'أنشئ دعوة تقويم يفتحها أي أحد في Apple Calendar أو Outlook أو Google، مع التكرار والتذكير — أو الصق ملف ‎.ics‎ وصلك وشاهد بوضوح ما فيه بتوقيتك أنت. تلتزم الأداة بما تتخطاه المولّدات عادةً من معيار RFC 5545: طيّ الأسطر عند ٧٥ ثمانية، وتهريب الفواصل والفواصل المنقوطة، وكتابة أحداث اليوم الكامل تواريخَ لا من منتصف ليل إلى منتصف ليل.' },
  },
  {
    id: 'cert-decoder',
    en: { name: 'Certificate Decoder', description: 'Paste a PEM certificate and read what is actually in it: who it was issued to and by, when it expires and in how many days, the key and signature algorithms, every hostname it covers, its extensions and its SHA-256 fingerprint. Decoded in your browser by a small ASN.1 parser — nothing is uploaded, and no online checker sees your certificate.' },
    ar: { name: 'فاحص الشهادات', description: 'الصق شهادة بصيغة PEM واقرأ ما فيها فعلًا: لمن صدرت ومن أصدرها، ومتى تنتهي وكم بقي لها، وخوارزميتَي المفتاح والتوقيع، وكل اسم نطاق تغطيه، وامتداداتها وبصمة SHA-256. تُفك في متصفحك عبر محلّل ASN.1 صغير — فلا يُرفع شيء، ولا يطّلع فاحص إلكتروني على شهادتك.' },
  },
  {
    id: 'email-headers',
    en: { name: 'Email Header Analyser', description: 'Paste the raw headers of an email and see the route it actually took, with the delay at each hop, plus the SPF, DKIM and DMARC verdicts explained in plain words and a note of anything worth a second look — a reply address on another domain, an authentication failure. Parsed in your browser, never uploaded.' },
    ar: { name: 'محلّل ترويسات البريد', description: 'الصق ترويسات رسالة بريدية خامًا لترى الطريق الذي سلكته فعلًا وزمن كل محطة، مع نتائج SPF وDKIM وDMARC مشروحة بكلام واضح، وتنبيهًا لما يستحق نظرة ثانية — كعنوان رد على نطاق آخر، أو فشل في التوثيق. يجري التحليل في متصفحك ولا يُرفع شيء.' },
  },
  {
    id: 'seating-chart',
    en: { name: 'Seating Chart', description: 'Paste your class list, set the room out in rows and desks, and get a printable seating chart. Name the pairs who must not sit together and it works around them — and says so plainly when the room is too full to manage it, rather than quietly seating them side by side. Every chart has a code, so a reprint seats the same people in the same desks.' },
    ar: { name: 'مخطط جلوس الفصل', description: 'الصق قائمة فصلك، ورتّب القاعة صفوفًا ومقاعد، واحصل على مخطط جلوس قابل للطباعة. سمِّ من يجب ألا يجلسا معًا فيتفادى الأداة ذلك — وتقول لك صراحةً حين تكون القاعة أضيق من أن يتحقق، بدل أن تُجلسهما متجاورين في صمت. ولكل مخطط رمز، فتُجلس إعادةُ الطباعة الطلابَ أنفسهم في المقاعد نفسها.' },
  },
  {
    id: 'attendance-sheet',
    en: { name: 'Attendance Sheet', description: 'Paste a class list and print a register: columns for school days, numbered sessions, or your own headings like Quiz 1 and Final. Weekend days are skipped, defaulted to Friday and Saturday — a sheet built on a Saturday-Sunday weekend prints two columns nobody ticks and misses two teaching days. Optional Hijri dates and a total column.' },
    ar: { name: 'كشف الحضور', description: 'الصق قائمة فصلك واطبع سجلًا: أعمدة لأيام الدراسة، أو حصصًا مرقّمة، أو عناوين من عندك مثل «اختبار ١» و«النهائي». وتُتخطّى أيام العطلة، والافتراضي الجمعة والسبت — فالورقة المبنية على عطلة السبت والأحد تطبع عمودين لا يعلّم فيهما أحد وتسقط يومَي تدريس. مع تواريخ هجرية اختيارية وعمود للمجموع.' },
  },
  {
    id: 'csv-vcard',
    en: { name: 'Spreadsheet to Contacts', description: 'Turn a CSV or Excel list of people into a .vcf your phone will import — names, numbers, emails, companies and job titles. Columns are matched by their headings and you can correct them. Saudi numbers are rewritten in international form, because 0512345678 stops meaning anything once the phone leaves the country. Nothing is uploaded.' },
    ar: { name: 'جدول إلى جهات اتصال', description: 'حوّل قائمة أشخاص في ملف CSV أو إكسل إلى ملف ‎.vcf‎ يستورده هاتفك — أسماء وأرقام وبُرد إلكترونية وشركات ومسمّيات وظيفية. تُطابَق الأعمدة من عناوينها ويمكنك تصحيحها. وتُعاد كتابة الأرقام السعودية بالصيغة الدولية، لأن 0512345678 يفقد معناه متى خرج الهاتف من البلد. ولا يُرفع شيء.' },
  },
  {
    id: 'sheet-diff',
    en: { name: 'Compare Spreadsheets', description: 'Compare two versions of the same spreadsheet — CSV or Excel — and see which rows were added, removed or changed, and exactly which cell changed in each. Rows are matched on a key column rather than their position, because by the time you need a diff somebody has already sorted or inserted something. Duplicate keys are reported instead of quietly picking one.' },
    ar: { name: 'مقارنة الجداول', description: 'قارن نسختين من الجدول نفسه — CSV أو إكسل — وشاهد أي الصفوف أُضيفت وأيها حُذفت وأيها تغيّرت، وأي خلية تغيّرت في كل منها. وتُطابَق الصفوف على عمود مفتاح لا على مواضعها، لأنه حين تحتاج المقارنة يكون أحدهم قد فرز أو أدرج شيئًا. وتُذكر المفاتيح المكرّرة بدل اختيار أحدها في صمت.' },
  },
  {
    id: 'prayer-timetable',
    en: { name: 'Monthly Prayer Timetable', description: 'Print a whole month of prayer times for any Saudi city — Fajr through Isha, with Hijri dates alongside and Fridays shaded so the sheet can be read from across a room. For a fridge, a noticeboard or a mosque door. Calculated on your device with the Umm al-Qura method, the same one the Prayer Times app here uses, so the two never disagree.' },
    ar: { name: 'تقويم مواقيت الصلاة', description: 'اطبع شهرًا كاملًا من مواقيت الصلاة لأي مدينة سعودية — من الفجر إلى العشاء، مع التواريخ الهجرية بجانبها وتظليل أيام الجمعة ليمكن قراءة الورقة من بعيد. للثلاجة أو لوحة الإعلانات أو باب المسجد. تُحسب على جهازك بطريقة أم القرى، وهي نفسها التي يستخدمها تطبيق مواقيت الصلاة هنا، فلا يختلف الاثنان.' },
  },
  {
    id: 'remove-silence',
    en: { name: 'Remove Silence', description: 'Cut the silence out of an audio recording — the pauses in a lecture, the gaps in an interview, the dead air at the start. Set how quiet counts as silent and how long a gap has to be, and see exactly what will go before it goes. A margin is kept at each edge so a breath before a word survives, because a cut made exactly on the silence sounds chopped.' },
    ar: { name: 'حذف الصمت', description: 'احذف الصمت من تسجيل صوتي — سكتات المحاضرة، وفجوات المقابلة، والفراغ في البداية. حدّد ما يُعدّ صمتًا وكم يجب أن تطول السكتة، وشاهد بالضبط ما سيُحذف قبل حذفه. ويُترك هامش عند كل طرف لتبقى الشهقة قبل الكلمة، فالقص على حدّ الصمت تمامًا يجعل النتيجة مبتورة.' },
  },
  {
    id: 'epub-text',
    en: { name: 'EPUB to Text', description: 'Open an EPUB and take its text out — the whole book or one chapter at a time, as plain text or Markdown — along with its title, authors, publisher and ISBN. Chapters come out in the order the book says to read them, not the order the files happen to be named. Read in your browser; the file is never uploaded.' },
    ar: { name: 'كتاب EPUB إلى نص', description: 'افتح ملف EPUB واستخرج نصّه — الكتاب كله أو فصلًا فصلًا، نصًّا عاديًا أو ماركداون — مع عنوانه ومؤلفيه وناشره ورقمه الدولي. وتخرج الفصول بالترتيب الذي يقول الكتاب أن يُقرأ به، لا بترتيب أسماء الملفات. تجري القراءة في متصفحك؛ ولا يُرفع الملف أبدًا.' },
  },
  {
    id: 'csv-split',
    en: { name: 'Split a CSV', description: 'Break one big spreadsheet into several smaller CSVs — by row count, by file size, or one file per value in a column, so a staff list becomes one file per department. Every part keeps the header row, and a byte-order mark is added by default so Excel reads Arabic correctly instead of turning it into mojibake. Downloads as a zip.' },
    ar: { name: 'تقسيم ملف CSV', description: 'قسّم جدولًا كبيرًا إلى ملفات CSV أصغر — بعدد الصفوف أو بحجم الملف أو ملفًا لكل قيمة في عمود، فتصير قائمة الموظفين ملفًا لكل إدارة. ويحتفظ كل جزء بصف العناوين، وتُضاف علامة ترتيب البايتات افتراضيًا ليقرأ إكسل العربية صحيحة بدل أن يحيلها رموزًا. ويُنزَّل الكل في ملف مضغوط.' },
  },
  {
    id: 'name-spelling',
    en: { name: 'Name in English Letters', description: 'Write an Arabic name in Latin letters, one part at a time, choosing between the spellings that actually appear on documents here. There is no correct answer — محمد is Mohammed, Muhammad, Mohamed, Mohammad and Muhammed on five passports in the same family — so this shows the options rather than pretending to a verdict, and tells you to copy your passport if you already have one.' },
    ar: { name: 'كتابة الاسم بالإنجليزية', description: 'اكتب اسمًا عربيًا بحروف لاتينية، جزءًا جزءًا، مختارًا بين الكتابات التي تظهر فعلًا في الوثائق هنا. ولا جواب صحيح واحد — فمحمد تُكتب Mohammed وMuhammad وMohamed وMohammad وMuhammed في خمسة جوازات لأسرة واحدة — ولذلك تعرض الأداة الخيارات ولا تدّعي حكمًا، وتنصحك بنسخ جوازك إن كان لديك واحد.' },
  },
  {
    id: 'zatca-qr',
    en: { name: 'Invoice QR Reader', description: 'Photograph a receipt, or paste its QR text, and read what the invoice says: the seller, their VAT registration number, when it was issued, the total and the VAT. It also checks the arithmetic — a standard-rated sale whose VAT is not 15% of the pre-VAT amount is worth a second look. Everything happens on your device. It reads the invoice; it does not verify the signature, which needs ZATCA own certificates.' },
    ar: { name: 'قارئ رمز الفاتورة', description: 'صوّر إيصالًا أو الصق نص رمزه واقرأ ما تقوله الفاتورة: البائع ورقمه الضريبي ووقت الإصدار والإجمالي والضريبة. وتتحقق الأداة من الحساب أيضًا — فبيع خاضع للنسبة العادية لا تساوي ضريبته ١٥٪ من المبلغ قبل الضريبة يستحق نظرة ثانية. كل ذلك على جهازك. وهي تقرأ الفاتورة ولا تتحقق من توقيعها، فذلك يحتاج شهادات زاتكا نفسها.' },
  },
  {
    id: 'pdf-organise',
    en: { name: 'Organise PDF Pages', description: 'Turn sideways pages the right way up, drag them into the right order, and drop the ones you do not want — all on one screen, then save. Pages are copied rather than re-drawn, so text stays text and a scan stays exactly the scan it was. The file never leaves your device.' },
    ar: { name: 'ترتيب صفحات PDF', description: 'اضبط اتجاه الصفحات المائلة، واسحبها إلى ترتيبها الصحيح، واحذف ما لا تريده — كل ذلك في شاشة واحدة، ثم احفظ. وتُنسخ الصفحات ولا يُعاد رسمها، فيبقى النص نصًا وتبقى الصورة الممسوحة كما هي تمامًا. ولا يغادر الملف جهازك.' },
  },
  {
    id: 'pdf-ocr',
    en: { name: 'OCR a Scanned PDF', description: 'A scanned contract, a stamped letter, a photocopied receipt — a PDF that is really a picture, so nothing can be selected or searched. This reads the letters off each page and hands you the text, in English or Arabic. Pages that already carry real text are taken as they are rather than guessed at. The engine runs in your browser: the scan never leaves your device.' },
    ar: { name: 'استخراج نص من PDF ممسوح', description: 'عقد ممسوح، أو خطاب مختوم، أو إيصال مصوَّر — ملف PDF هو في الحقيقة صورة، فلا يمكن تحديد شيء فيه ولا البحث. تقرأ هذه الأداة الحروف من كل صفحة وتسلّمك النص، بالعربية أو الإنجليزية. ويعمل المحرك في متصفحك: فلا يغادر المستند جهازك.' },
  },
  {
    id: 'docx-to-text',
    en: { name: 'Word to Text', description: 'Read a Word document as plain text, with the paragraphs where they were and the table columns still apart — ready to paste into anything, on a machine with no Word on it. Headers, footers and footnotes are kept separate rather than mixed into the body. The file is read in your browser and never uploaded.' },
    ar: { name: 'وورد إلى نص', description: 'اقرأ مستند وورد نصًا عاديًا، بفقراته في مواضعها وأعمدة جداوله متباعدة كما كانت — جاهزًا للصق في أي شيء، وعلى جهاز لا وورد فيه. وتُفصل الرؤوس والتذييلات والحواشي عن المتن بدل أن تختلط به. ويُقرأ الملف في متصفحك ولا يُرفع أبدًا.' },
  },
  {
    id: 'csv-to-xlsx',
    en: { name: 'CSV to Excel', description: 'Turn a CSV into a real .xlsx, so opening it does not damage it. A CSV carries no types, so Excel guesses — and its guesses eat the leading zero off every phone number and national ID, and round a 16-digit IBAN into scientific notation. Here each column declares what it is, and the file is UTF-8 by definition, so Arabic arrives as Arabic. The conversion runs in your browser.' },
    ar: { name: 'CSV إلى إكسل', description: 'حوّل ملف CSV إلى ملف ‎.xlsx‎ حقيقي، حتى لا يفسده مجرد فتحه. فملف CSV لا يحمل أنواعًا، فيخمّن إكسل — وتخمينه يأكل الصفر الأول من كل رقم جوال وهوية، ويقرّب رقم آيبان من ستة عشر رقمًا إلى صيغة أُسّية. أما هنا فيعلن كل عمود عن نوعه، والملف بترميز UTF-8 أصلًا، فتصل العربية عربيةً.' },
  },
  {
    id: 'vcard-to-csv',
    en: { name: 'vCard to CSV', description: 'Turn the .vcf your phone exports into a spreadsheet. Arabic names written the way Android encodes them come out as names rather than gibberish, an iPhone export keeps the numbers it hides behind item groups, and a contact with three phone numbers gets three columns instead of losing two. Download it as CSV or as an Excel file that keeps the leading zero on every mobile number.' },
    ar: { name: 'vCard إلى CSV', description: 'حوّل ملف ‎.vcf‎ الذي يصدّره هاتفك إلى جدول. فالأسماء العربية المكتوبة بالطريقة التي يرمّزها بها أندرويد تخرج أسماءً لا طلاسم، وتصدير آيفون يحتفظ بالأرقام التي يخفيها خلف المجموعات، ومن له ثلاثة أرقام يحصل على ثلاثة أعمدة. ونزّله ملف CSV أو ملف إكسل يحفظ الصفر الأول في كل رقم جوال.' },
  },
]
