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
    id: 'messages',
    en: { name: 'Messages', description: 'Private team messaging, one-to-one and in groups, that goes straight between browsers. Replies, reactions, polls, voice notes, files of any size, scheduled and disappearing messages, read receipts — stored only in your browser, and sealed end to end when a message has to wait for someone who is away.' },
    ar: { name: 'الرسائل', description: 'مراسلة خاصة للفرق، فردية وفي مجموعات، تنتقل مباشرة بين المتصفحات. ردود وتفاعلات وتصويتات ورسائل صوتية وملفات بأي حجم ورسائل مجدولة ومؤقتة وإشعارات قراءة — محفوظة في متصفحك فقط، ومختومة من طرف إلى طرف عندما تنتظر الرسالة شخصًا غير متصل.' },
  },
  {
    id: 'excel-editor',
    en: { name: 'Spreadsheet Editor — open and edit Excel files free', description: 'Open, edit and save Excel (.xlsx), ODS and CSV spreadsheets in your browser: formulas, charts, filters, drop-downs and live co-editing. Nothing is uploaded.' },
    ar: { name: 'محرر الجداول — افتح ملفات إكسل وعدّلها مجانًا', description: 'افتح جداول إكسل ‎(.xlsx)‎ وODS وCSV وعدّلها واحفظها في متصفحك: صيغ ومخططات وتصفية وقوائم منسدلة وتحرير مشترك مباشر. لا يُرفع شيء.' },
  },
  {
    id: 'word-editor',
    en: { name: 'Document Editor — open and edit Word files free', description: 'Open, edit and save Word (.docx), ODT and Markdown documents in your browser: styles, lists, tables, pictures, footnotes and live co-writing, Arabic and English. Nothing is uploaded.' },
    ar: { name: 'محرر المستندات — افتح ملفات وورد وعدّلها مجانًا', description: 'افتح مستندات وورد ‎(.docx)‎ وODT وMarkdown وعدّلها واحفظها في متصفحك: أنماط وقوائم وجداول وصور وحواشٍ وكتابة مشتركة مباشرة، بالعربية والإنجليزية. لا يُرفع شيء.' },
  },
  {
    id: 'powerpoint-editor',
    en: { name: 'Presentation Editor — open and edit PowerPoint files free', description: 'Open, edit and present PowerPoint (.pptx) decks in your browser: layouts, themes, shapes, tables, speaker notes, a presenter view and live co-editing, Arabic and English. Nothing is uploaded.' },
    ar: { name: 'محرر العروض — افتح ملفات باوربوينت وعدّلها مجانًا', description: 'افتح عروض باوربوينت ‎(.pptx)‎ وعدّلها واعرضها في متصفحك: تخطيطات وسمات وأشكال وجداول وملاحظات المتحدث وعرض المقدم وتحرير مشترك مباشر، بالعربية والإنجليزية. لا يُرفع شيء.' },
  },
  {
    id: 'prompt-analyzer',
    en: { name: 'Prompt Analyzer', description: 'Paste an LLM system prompt and one AI pass scores it 1–5 across eight dimensions — purpose coherence, context-vs-instruction harmony, spikiness, shoutiness, contradictions, framing, an escape hatch and downstream stakes — as a heatmap spider chart, with concrete issues listed. Then answer the gaps and get a rewritten, stronger prompt. Three analyses per 24 hours.' },
    ar: { name: 'محلّل الموجّهات', description: 'الصق موجّه نظام لنموذج لغوي فيقيّمه مرور واحد للذكاء الاصطناعي من ١ إلى ٥ عبر ثمانية أبعاد — تماسك الغرض وتناغم السياق مع التعليمات والحدّة والصياح والتناقضات والصياغة ومنفذ الخروج والاستخدام اللاحق — كمخطط عنكبوتي بألوان حرارية مع سرد المشكلات. ثم أجب عن الثغرات لتحصل على موجّه مُعاد صياغته أقوى. ثلاثة تحاليل كل ٢٤ ساعة.' },
  },
  {
    id: 'jwt-decoder',
    en: { name: 'JWT Decoder', description: 'Paste a JSON Web Token to decode its header and payload into readable JSON, with expiry and issued-at times shown in local time. Decoding happens entirely in your browser — the token is never uploaded and the signature is not verified.' },
    ar: { name: 'مفكّك رموز JWT', description: 'الصق رمز JSON Web Token لفكّ ترويسته وحمولته إلى JSON مقروء، مع أوقات الانتهاء والإصدار بالتوقيت المحلي. يتم الفكّ بالكامل في متصفحك — لا يُرفع الرمز ولا يُتحقَّق من التوقيع.' },
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
    id: 'split-bill',
    en: { name: 'Bill Splitter', description: 'Split a restaurant or group bill fairly: add an optional tip percentage, set how many people are paying, and see the per-person share and the grand total. Runs entirely in your browser.' },
    ar: { name: 'مقسّم الفاتورة', description: 'قسّم فاتورة مطعم أو مجموعة بإنصاف: أضف نسبة بقشيش اختيارية، وحدّد عدد الدافعين، وشاهد نصيب كل شخص والمجموع الكلي. تعمل بالكامل في متصفحك.' },
  },
  {
    id: 'zakat-calculator',
    en: { name: 'Zakat Calculator', description: 'Add up your zakatable assets — cash, gold and silver, trade goods and money owed to you — subtract short-term debts, and see 2.5% due once your net wealth is above the niṣāb and held for a lunar year. A helping estimate, not a fatwa. Runs in your browser.' },
    ar: { name: 'حاسبة الزكاة', description: 'اجمع أموالك الزكوية — النقد والذهب والفضة وعروض التجارة والديون المرجوّة لك — واطرح الديون قصيرة الأجل، لترى 2.5% الواجبة متى بلغ صافي مالك النصاب وحال عليه الحول. تقدير مُعين وليس فتوى. يعمل في متصفحك.' },
  },
  {
    id: 'cubic-bezier',
    en: { name: 'Cubic Bezier Editor', description: 'Drag the two control points to shape a CSS cubic-bezier easing curve, watch a live animation play it back, start from presets like ease-in-out, and copy the ready-to-paste value. Runs entirely in your browser.' },
    ar: { name: 'محرّر منحنى بيزييه', description: 'اسحب نقطتي التحكّم لتشكيل منحنى تنعيم CSS من نوع cubic-bezier، وشاهد حركة حيّة تعيده، وابدأ من قوالب مثل ease-in-out، وانسخ القيمة الجاهزة للّصق. يعمل بالكامل في متصفحك.' },
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
    id: 'steganography',
    en: { name: 'Hide Text in Image', description: 'Hide a text message inside an image by tweaking the least-significant bits of its pixels — the picture looks unchanged — then reveal it later from the saved PNG. Everything happens on your device; nothing is uploaded.' },
    ar: { name: 'إخفاء نص في صورة', description: 'أخفِ رسالة نصية داخل صورة بتعديل البتات الأقل أهمية في بكسلاتها — تبدو الصورة دون تغيير — ثم اكشفها لاحقًا من ملف PNG المحفوظ. كل شيء يجري على جهازك؛ لا يُرفع أي شيء.' },
  },
  {
    id: 'photo-booth',
    en: { name: 'Webcam Photo Booth', description: 'Take photos with your webcam, apply fun filters, mirror the image, and download each shot. The camera only turns on when you start it, and every photo stays on your device — nothing is uploaded.' },
    ar: { name: 'كشك تصوير الويب كام', description: 'التقط صورًا بكاميرا الويب، وطبّق مرشّحات ممتعة، واعكس الصورة، ونزّل كل لقطة. لا تعمل الكاميرا إلا حين تبدأها، وتبقى كل صورة على جهازك — لا يُرفع أي شيء.' },
  },
  {
    id: 'todo',
    en: { name: 'To-do Lists', description: 'Simple to-do lists that live in your browser: add tasks, tick them off, clear the finished ones. No account needed and nothing is uploaded. Want a list on more than one device, or shared with other people so you can tick things off together? Sign in with Google and switch sync on for just that list — everything else stays local.' },
    ar: { name: 'قوائم المهام', description: 'قوائم مهام بسيطة تعيش في متصفحك: أضِف المهام وأنجِزها وامسح المنتهي منها. بلا حساب ودون رفع أي شيء. وإن أردت قائمة على أكثر من جهاز أو مشتركة مع آخرين لتنجزوا معًا، سجّل الدخول بحساب جوجل وفعّل المزامنة لتلك القائمة وحدها — وما عداها يبقى محليًا.' },
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
    id: 'fake-data',
    en: { name: 'Fake Data Generator', description: 'Generate realistic-looking sample records — names, emails, phones, cities, companies, dates and IDs — for seeding tests, mockups and demos. Pick the fields and count, then export as JSON or CSV. Runs entirely in your browser.' },
    ar: { name: 'مولّد بيانات وهمية', description: 'ولّد سجلّات عيّنة واقعية المظهر — أسماء وبُرد إلكترونية وهواتف ومدن وشركات وتواريخ ومعرّفات — لتغذية الاختبارات والنماذج والعروض. اختر الحقول والعدد، ثم صدّر JSON أو CSV. يعمل بالكامل في متصفحك.' },
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
    id: 'pdf-merge',
    en: { name: 'Merge PDF', description: 'Combine PDFs and pictures into one PDF, then rotate, reorder and remove pages. Runs in your browser; your documents are never uploaded.' },
    ar: { name: 'دمج PDF', description: 'اجمع ملفات PDF والصور في ملف واحد، ثم أدر الصفحات ورتّبها واحذف ما لا تريد. يعمل داخل متصفحك؛ لا تُرفع مستنداتك أبدًا.' },
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
    id: 'pdf-to-images',
    en: { name: 'PDF to Images', description: 'Convert a PDF to images — one PNG, JPG or WebP per page, at screen, print or high-DPI resolution. Pick pages, save each or all as a ZIP. Never uploaded.' },
    ar: { name: 'PDF إلى صور', description: 'حوّل PDF إلى صور — ملف PNG أو JPG أو WebP لكل صفحة، بدقة الشاشة أو الطباعة أو عالية. اختر الصفحات واحفظها منفردة أو في ZIP. لا تُرفع أبدًا.' },
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
    id: 'pdf-to-word',
    en: { name: 'PDF to Word', description: 'Turn a PDF into an editable .docx with the headings, bold and lists recovered — and a locked PDF opens with your password. Free, and the file never leaves your browser.' },
    ar: { name: 'PDF إلى وورد', description: 'حوّل ملف PDF إلى مستند ‎.docx‎ قابل للتحرير مع استعادة العناوين والخط العريض والقوائم — ويُفتح الملف المحمي بكلمة مرورك. مجانًا، ولا يغادر الملف متصفحك.' },
  },
  {
    id: 'doc-scan',
    en: { name: 'Photo to Scan', description: 'Turn a photo of a page into something that looks scanned — straightened by a projective transform, paper made white, and a fraction of the size. Nothing uploaded. Free, in your browser.' },
    ar: { name: 'تصحيح صورة المستند', description: 'حوّل صورة صفحة إلى ما يشبه المسح الضوئي — معدّلة الميل بتحويل إسقاطي، والورق أبيض، وبجزء يسير من الحجم. ولا يُرفع شيء. مجانًا داخل متصفحك.' },
  },
  {
    id: 'activity-schedule',
    en: { name: 'Activity Schedule', description: 'Make an illustrated routine or activity schedule with an icon on every entry, share the whole sheet as one link, and print it as a PDF with a QR code that reopens it for editing. Free, and nothing leaves your browser.' },
    ar: { name: 'جدول الأنشطة', description: 'اصنع جدول روتين أو أنشطة مزخرفًا بأيقونة لكل خانة، وشارك الورقة كاملة برابط واحد، واطبعها ملف PDF يحمل رمز استجابة يعيد فتحها للتحرير. مجانًا، ولا يغادر شيء متصفحك.' },
  },
  {
    id: 'timetable',
    en: { name: 'Weekly Timetable', description: 'Fill in and print a weekly class or work timetable that starts on Sunday — and in Arabic reverses the columns, not just the day names. Free, in your browser.' },
    ar: { name: 'الجدول الأسبوعي', description: 'املأ جدولًا أسبوعيًا للحصص أو الدوام واطبعه، يبدأ بالأحد — وفي العربية تنعكس الأعمدة لا أسماء الأيام وحدها. مجانًا داخل متصفحك.' },
  },
  {
    id: 'readable-text',
    en: { name: 'Readable Text', description: 'Set hard-to-read text the way you can read it — size, line spacing, line length, contrast, a focus band. Letter spacing is off for Arabic, because the letters join. Free, in your browser.' },
    ar: { name: 'نص أسهل للقراءة', description: 'اضبط النص الصعب كما تستطيع قراءته — الحجم وتباعد الأسطر وطول السطر والتباين وإبراز السطر. وتباعد الحروف مُعطَّل للعربية لأن حروفها تتّصل. مجانًا داخل متصفحك.' },
  },
  {
    id: 'detect-language',
    en: { name: 'Language Detector', description: 'Detect the language of any text in your browser — script detection plus common-word matching across major languages, with a confidence score. Nothing uploaded.' },
    ar: { name: 'كاشف اللغة', description: 'اكتشف لغة أي نصٍّ داخل متصفحك — كشف النظام الكتابي ومطابقة الكلمات الشائعة لكبرى اللغات، مع درجة ثقة. دون رفع أي شيء.' },
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
    id: 'date-diff',
    en: { name: 'Date Diff', description: 'Find the exact duration between two dates — years, months, days, plus total days and weeks. Runs entirely in your browser.' },
    ar: { name: 'الفرق بين تاريخين', description: 'احسب المدة الدقيقة بين تاريخين — سنوات وأشهر وأيام، وإجمالي الأيام والأسابيع. يعمل بالكامل داخل متصفحك.' },
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
    id: 'colour-blind',
    en: { name: 'Colour Blindness Simulator', description: 'See a palette or an image as someone with colour vision deficiency sees it — and which pairs of your colours collapse into the same thing. Around one man in twelve has some form of it, so a chart relying on red-versus-green is unreadable to a real share of your users.' },
    ar: { name: 'محاكي عمى الألوان', description: 'شاهد لوحة ألوان أو صورة كما يراها من لديه قصور في رؤية الألوان — وأي أزواج ألوانك تنهار إلى الشيء نفسه. فنحو رجل من كل اثني عشر لديه شكل منه، ما يجعل رسمًا يعتمد على الأحمر مقابل الأخضر غير مقروء لشريحة حقيقية من مستخدميك.' },
  },
  {
    id: 'batch-watermark',
    en: { name: 'Batch Watermark', description: 'Watermark a whole folder of images at once with text or a logo, then download them as a zip. The mark is sized as a share of each image rather than in fixed pixels, so a 4000-pixel photo and an 800-pixel one come back looking the same.' },
    ar: { name: 'علامة مائية على دفعة صور', description: 'ضع علامة مائية نصية أو شعارًا على مجلد صور كامل دفعة واحدة، ثم نزّلها في ملف مضغوط. ويُحسب حجم العلامة كنسبة من كل صورة لا ببكسلات ثابتة، فتعود صورة بعرض ٤٠٠٠ بكسل وأخرى بـ٨٠٠ متشابهتين.' },
  },
  {
    id: 'certificate',
    en: { name: 'Certificate Generator', description: 'Make certificates of completion or participation for a whole list at once — paste the names, set the wording and signature lines, and download every page in one PDF. Arabic and Latin names both render correctly, including mixed in one list.' },
    ar: { name: 'مولّد الشهادات', description: 'أنشئ شهادات إتمام أو مشاركة لقائمة كاملة دفعة واحدة — الصق الأسماء، واضبط النص وسطور التوقيع، ونزّل كل الصفحات في ملف PDF واحد. وتظهر الأسماء العربية واللاتينية بشكل صحيح، حتى مختلطة في قائمة واحدة.' },
  },
  {
    id: 'hijri-age',
    en: { name: 'Hijri Age Calculator', description: 'Enter a date of birth in either calendar and get your exact age in both — years, months and days, total days lived, and your next Hijri birthday. A Hijri year is about 354 days, so a Hijri age runs ahead by roughly a year every 33, which is why subtracting year numbers gives the wrong answer.' },
    ar: { name: 'حاسبة العمر الهجري', description: 'أدخل تاريخ ميلادك بأي من التقويمين لتحصل على عمرك الدقيق بهما — بالسنوات والأشهر والأيام، ومجموع الأيام، وميلادك الهجري القادم. السنة الهجرية نحو ٣٥٤ يومًا، لذا يسبق العمر الهجري بنحو سنة كل ٣٣، ولهذا يعطي طرح أرقام السنوات نتيجة خاطئة.' },
  },
  {
    id: 'franco-arabic',
    en: { name: 'Franco-Arabic Converter', description: 'Convert Franco-Arabic — the chat alphabet where 3 is ع, 7 is ح and 5 is خ — into proper Arabic writing, or go the other way. Common words are recognised whole so the result reads like Arabic, and genuinely ambiguous letters are listed so you can check them.' },
    ar: { name: 'محوّل الفرانكو إلى عربي', description: 'حوّل الفرانكو — أبجدية الدردشة حيث ٣ تعني ع و٧ تعني ح و٥ تعني خ — إلى كتابة عربية سليمة، أو اعكس الاتجاه. تُعرف الكلمات الشائعة ككلمات كاملة ليقرأ الناتج كعربية، وتُذكر الحروف الملتبسة لتراجعها.' },
  },
  {
    id: 'char-finder',
    en: { name: 'Character Finder', description: 'Search for the character you need by name — arrows, maths symbols, currency, Arabic marks and ligatures like ﷺ and ﷼, punctuation, ticks and crosses — then tap to copy. Inspect mode goes the other way: paste anything and see exactly what each character is.' },
    ar: { name: 'باحث المحارف والرموز', description: 'ابحث عن المحرف الذي تريده بالاسم — أسهم ورموز رياضية وعملات وعلامات عربية وتركيبات مثل ﷺ و﷼ وعلامات ترقيم وصح وخطأ — ثم انقر لنسخه. ووضع الفحص يعمل بالعكس: الصق أي شيء لترى حقيقة كل محرف.' },
  },
  {
    id: 'json-diff',
    en: { name: 'JSON Diff', description: 'A line diff on JSON is close to useless: reformatting makes every line look changed while the data is identical. This compares values by path and lists exactly what was added, removed or changed, with an option to treat arrays as unordered.' },
    ar: { name: 'مقارنة ملفات JSON', description: 'المقارنة السطرية لملفات JSON عديمة الجدوى تقريبًا: إعادة التنسيق تجعل كل سطر يبدو متغيّرًا والبيانات نفسها. تقارن هذه الأداة القيم بالمسار وتسرد ما أُضيف وما حُذف وما تغيّر، مع خيار التعامل مع المصفوفات كغير مرتّبة.' },
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
    id: 'spin-wheel',
    en: { name: 'Wheel of Names', description: 'A spinning wheel for picking a name fairly — for a classroom, a giveaway, a team draw or deciding who presents first. Paste the names, spin, and optionally drop each winner. The result uses the browser’s cryptographic random source, not Math.random.' },
    ar: { name: 'عجلة الأسماء', description: 'عجلة دوّارة لاختيار اسم بعدل — لفصل دراسي أو مسابقة أو توزيع فريق أو تحديد من يعرض أولًا. الصق الأسماء وأدر العجلة، ويمكنك حذف كل فائز. تُختار النتيجة عبر مصدر العشوائية التعموي في المتصفح لا عبر Math.random.' },
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
    id: 'password-strength',
    en: { name: 'Password Strength', description: 'Check a password honestly. Raw entropy flatters something like Password123!, so this penalises what actually makes a password guessable: common words, keyboard walks, runs, repeats, years and predictable shapes. Nothing you type leaves the page.' },
    ar: { name: 'قوة كلمة المرور', description: 'افحص كلمة مرورك بصدق. حساب العشوائية وحده يجامل كلمة مثل Password123!‎، لذا تخصم الأداة ما يجعلها فعلًا قابلة للتخمين: الكلمات الشائعة ومسارات لوحة المفاتيح والتسلسلات والتكرار والسنوات والأنماط المتوقّعة. لا يغادر ما تكتبه الصفحة.' },
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
    id: 'quiz-maker',
    en: { name: 'Quiz Maker', description: 'Write a quiz — multiple choice, true/false and short answer — then print it as a question paper with a separate answer key, or share a link anyone can take in their browser. The link carries the whole quiz after the # in the URL, and a fragment is never sent to a server: nothing is stored and there is no account.' },
    ar: { name: 'صانع الاختبارات', description: 'اكتب اختبارًا — اختيار من متعدد وصح/خطأ وإجابة قصيرة — ثم اطبعه ورقة أسئلة مع ورقة إجابات منفصلة، أو شارك رابطًا يستطيع أي أحد أداءه في متصفحه. يحمل الرابط الاختبار كاملًا بعد علامة # في العنوان، وما بعدها لا يُرسل إلى خادم أبدًا: فلا شيء مخزّن ولا حساب.' },
  },
  {
    id: 'translate',
    en: { name: 'Translator', description: 'Translate between Arabic and 50+ languages using a model that runs inside your browser, so nothing you type is uploaded anywhere — and it keeps working with no connection once the language pack is downloaded. Covers the languages actually spoken at work here: Urdu, Hindi, Bengali, Malayalam, Tamil, Nepali, Sinhala, Amharic, Tigrinya, Somali, Pashto and Farsi. Needs Chrome or Edge 138+ on a computer.' },
    ar: { name: 'ترجمة النصوص', description: 'ترجم بين العربية وأكثر من ٥٠ لغة عبر نموذج يعمل داخل متصفحك، فلا يُرفع شيء مما تكتبه إلى أي مكان — ويظل يعمل دون اتصال بعد تنزيل حزمة اللغة. ويغطي اللغات المستخدمة فعلًا في العمل هنا: الأردية والهندية والبنغالية والمالايالامية والتاميلية والنيبالية والسنهالية والأمهرية والتيغرينية والصومالية والبشتوية والفارسية. يتطلب Chrome أو Edge 138+ على حاسوب.' },
  },
  {
    id: 'image-edit',
    en: { name: 'Image Editor', description: 'The video editor’s screen, for the one-frame case: crop a picture to the shape a platform wants, draw a box over anything that should not be in it, and type a caption straight onto the frame — in your browser, with nothing uploaded. It shows what a crop costs before you commit to it, and the rectangle is dragged over the WHOLE picture so you can see what is being thrown away rather than watching the result appear to zoom. A dragged corner snaps onto 9:16, 1:1, 4:5 or 16:9 when it gets close and lets go again when it does not, so an arbitrary shape is still expressible. Captions are drawn with this page’s own fonts, so Arabic joins up and runs right to left. The box that hides something offers pixelate, solid or blur, with what that choice costs written next to it. HEIC from an iPhone is read here too. And there is a control that tilts every picture one degree clockwise, on by default, because somebody asked for it that way.' },
    ar: { name: 'محرّر الصور', description: 'شاشة محرّر الفيديو نفسها، لحالة الإطار الواحد: اقتصّ الصورة بالشكل الذي تطلبه المنصّة، وارسم مربّعًا فوق ما لا ينبغي أن يظهر، واكتب النص على الصورة مباشرة — داخل متصفحك دون رفع شيء. وتريك الأداة ثمن الاقتصاص قبل أن تلتزم به، ويُسحب المستطيل فوق الصورة كاملةً لترى ما يُستبعد بدل أن ترى النتيجة وكأنها تتقرّب. والزاوية المسحوبة تلتقط ٩:١٦ أو ١:١ أو ٤:٥ أو ١٦:٩ إذا اقتربت منها وتتركها إذا ابتعدت، فتبقى النِّسَب الحرّة ممكنة. وتُرسم النصوص بخطوط هذه الصفحة نفسها، فتتصل الحروف العربية وتجري من اليمين إلى اليسار. ويقدّم مربّع الإخفاء بكسلةً أو حجبًا كاملًا أو تمويهًا، وإلى جانبها ثمن هذا الاختيار. وتُقرأ هنا أيضًا صور HEIC من الآيفون. وفيها خيار يُميل كل صورة درجةً واحدة مع عقارب الساعة، مفعَّلٌ تلقائيًّا، لأن أحدهم طلبه هكذا.' },
  },
  {
    id: 'video-edit',
    en: { name: 'Video Editor', description: 'Crop a video to the shape a platform wants, join a few clips end to end, and put a caption on top — all in your browser, with nothing uploaded. It shows you what a crop costs before you commit to it: going from a 16:9 recording to a 9:16 post keeps under a third of the picture, and whatever you filmed is rarely in the middle of what is left, so you drag to choose. Captions are drawn with this page’s own fonts, so Arabic joins up and runs right to left, and the preview is the export rather than an approximation of it. You can also draw a box over anything that should not be in the picture — a face, a plate, a name on a screen — and each box carries its own settings: pixelate, solid or blur, with what that choice costs written next to it. Pixelating a video gives the detail back — the mosaic grid stays still while your subject moves through it, and 64 frames of that recover 98.6% of a number plate — so solid is one tap away. The sound is copied across untouched rather than re-encoded, so it loses nothing.' },
    ar: { name: 'محرّر الفيديو', description: 'اقتصّ الفيديو بالشكل الذي تطلبه المنصّة، وادمج عدة مقاطع واحدًا تلو الآخر، وضع نصًّا فوقها — كل ذلك داخل متصفحك دون رفع شيء. وتريك الأداة ثمن الاقتصاص قبل أن تلتزم به: الانتقال من تسجيل ١٦:٩ إلى منشور ٩:١٦ يُبقي أقلّ من ثلث الصورة، وما صوّرته نادرًا ما يكون في وسط ما تبقّى، فتسحب لتختار. وتُرسم النصوص بخطوط هذه الصفحة نفسها، فتتصل الحروف العربية وتجري من اليمين إلى اليسار، والمعاينة هي المُخرَج لا تقريبٌ له. ويمكنك أيضًا رسم مربّع فوق ما لا ينبغي أن يظهر — وجه أو لوحة سيارة أو اسم على شاشة — ولكل مربّع إعداداته: بكسلة أو حجب كامل أو تمويه، وإلى جانبها ثمن هذا الاختيار. فبكسلة الفيديو تعيد التفاصيل — شبكة البكسلة تثبت بينما يتحرك من تخفيه خلالها، و٦٤ إطارًا من ذلك تستردّ ٩٨٫٦٪ من لوحة السيارة — والحجب الكامل على بُعد نقرة. ويُنسخ الصوت كما هو دون إعادة ترميز فلا يفقد شيئًا.' },
  },
  {
    id: 'arabic-handwriting',
    en: { name: 'Arabic Handwriting Sheets', description: 'Printable Arabic handwriting practice — every letter in all four of its positional forms (alone, at the start, in the middle, at the end), or any word or name you type. The letters are shaped and joined properly, which is the thing generic worksheet sites get wrong when they print 28 isolated glyphs a child will never meet in a word. Ruled guide lines, faded or dotted tracing, and as many rows as you want.' },
    ar: { name: 'كراسة الخط العربي', description: 'أوراق تدريب على الخط العربي قابلة للطباعة — كل حرف في مواضعه الأربعة (مفردًا، وأول الكلمة، ووسطها، وآخرها)، أو أي كلمة أو اسم تكتبه. والحروف تُشكَّل وتُوصَل على وجهها الصحيح، وهو ما تخطئ فيه مواقع أوراق العمل العامة حين تطبع ٢٨ شكلًا مفردًا لا يلقاها الطفل في كلمة قط. مع أسطر مسطّرة، وتتبّع باهت أو منقّط، وعدد الأسطر الذي تريد.' },
  },
  {
    id: 'khatma',
    en: { name: 'Khatma Planner', description: 'Plan a khatma over any stretch of days — Ramadan, a month, a week — divided evenly by page or by juz, with Gregorian and Hijri dates side by side. Print it with a tick box per day, or tick the days off here; your progress stays on this device. Page numbers follow the 604-page Madani mushaf, and the tool says so, because a plan quoting pages from an edition you do not own is worse than no plan.' },
    ar: { name: 'مخطّط الختمة', description: 'خطّط ختمة على أي عدد من الأيام — رمضان أو شهر أو أسبوع — مقسّمة بالتساوي بالصفحات أو بالأجزاء، مع التاريخين الميلادي والهجري جنبًا إلى جنب. اطبعها بمربّع تعليم لكل يوم، أو علّم الأيام هنا؛ ويبقى تقدّمك على جهازك. وأرقام الصفحات بحسب مصحف المدينة ذي الـ٦٠٤ صفحات، والأداة تصرّح بذلك، لأن خطة بأرقام طبعة لا تملكها أسوأ من لا خطة.' },
  },
  {
    id: 'cert-decoder',
    en: { name: 'Certificate Decoder', description: 'Paste a PEM certificate and read what is actually in it: who it was issued to and by, when it expires and in how many days, the key and signature algorithms, every hostname it covers, its extensions and its SHA-256 fingerprint. Decoded in your browser by a small ASN.1 parser — nothing is uploaded, and no online checker sees your certificate.' },
    ar: { name: 'فاحص الشهادات', description: 'الصق شهادة بصيغة PEM واقرأ ما فيها فعلًا: لمن صدرت ومن أصدرها، ومتى تنتهي وكم بقي لها، وخوارزميتَي المفتاح والتوقيع، وكل اسم نطاق تغطيه، وامتداداتها وبصمة SHA-256. تُفك في متصفحك عبر محلّل ASN.1 صغير — فلا يُرفع شيء، ولا يطّلع فاحص إلكتروني على شهادتك.' },
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
    id: 'name-spelling',
    en: { name: 'Name in English Letters', description: 'Write an Arabic name in Latin letters, one part at a time, choosing between the spellings that actually appear on documents here. There is no correct answer — محمد is Mohammed, Muhammad, Mohamed, Mohammad and Muhammed on five passports in the same family — so this shows the options rather than pretending to a verdict, and tells you to copy your passport if you already have one.' },
    ar: { name: 'كتابة الاسم بالإنجليزية', description: 'اكتب اسمًا عربيًا بحروف لاتينية، جزءًا جزءًا، مختارًا بين الكتابات التي تظهر فعلًا في الوثائق هنا. ولا جواب صحيح واحد — فمحمد تُكتب Mohammed وMuhammad وMohamed وMohammad وMuhammed في خمسة جوازات لأسرة واحدة — ولذلك تعرض الأداة الخيارات ولا تدّعي حكمًا، وتنصحك بنسخ جوازك إن كان لديك واحد.' },
  },
  {
    id: 'pdf-ocr',
    en: { name: 'PDF to Text', description: 'Copy the text out of any PDF, in your browser. A PDF with real text is read exactly and at once; a scanned contract, a stamped letter, a photocopied receipt — a PDF that is really a picture, so nothing can be selected or searched. This reads the letters off each page and hands you the text, in English or Arabic. Pages that already carry real text are taken as they are rather than guessed at. The engine runs in your browser: the scan never leaves your device.' },
    ar: { name: 'PDF إلى نص', description: 'انسخ النص من أي ملف PDF داخل متصفحك. يُقرأ الملف ذو النص الحقيقي بدقة وفورًا؛ أما العقد الممسوح، أو خطاب مختوم، أو إيصال مصوَّر — ملف PDF هو في الحقيقة صورة، فلا يمكن تحديد شيء فيه ولا البحث. تقرأ هذه الأداة الحروف من كل صفحة وتسلّمك النص، بالعربية أو الإنجليزية. ويعمل المحرك في متصفحك: فلا يغادر المستند جهازك.' },
  },
  {
    id: 'audio-convert',
    en: { name: 'Audio Converter', description: 'Turn an M4A voice memo, an OGG, an AAC or a FLAC into a WAV that every piece of software accepts — and pick the sample rate and channels while you are there. 16 kHz mono is what transcription and speech software expects and is roughly a sixth the size of 44.1 kHz stereo; the tool shows the resulting size before you commit to it. Resampling is done by the browser’s own band-limited resampler, so downsampling does not alias. The file is decoded on your device and never uploaded.' },
    ar: { name: 'محوّل الصوت', description: 'حوّل مذكرة صوتية بصيغة M4A أو ملف OGG أو AAC أو FLAC إلى ملف WAV يقبله كل برنامج — واختر معدّل العيّنات وعدد القنوات. فـ16 كيلوهرتز أحادي هو ما تتوقعه برامج التفريغ، وحجمه نحو سدس 44.1 كيلوهرتز ثنائي، والأداة تعرض الحجم الناتج قبل أن تلتزم به. ويُفكّ ترميز الملف على جهازك ولا يُرفع أبدًا.' },
  },
  {
    id: 'stopwatch',
    en: { name: 'Stopwatch & Timer', description: 'A stopwatch with laps and a countdown timer with an alarm, in one place. Both take their time from the clock rather than by counting ticks, so switching tabs, locking the phone or leaving it in the background does not lose the minutes in between — which is what usually goes wrong with a timer in a browser.' },
    ar: { name: 'ساعة إيقاف ومؤقّت', description: 'ساعة إيقاف بلفّات ومؤقّت تنازلي بمنبّه، في مكان واحد. وكلاهما يأخذ وقته من الساعة نفسها لا بعدّ النبضات، فلا تضيع الدقائق حين تنتقل بين التبويبات أو تُقفل الهاتف أو تتركه في الخلفية.' },
  },
]

/**
 * Category landing pages, prerendered at /<locale>/c/<slug>/.
 *
 * The catalogue's sections were an in-page jump and nothing more: a category
 * could not be linked, shared, or landed on from a search engine, so "free PDF
 * tools" — the shape of query people actually type — had no page on this site
 * to answer it. The home page lists all 207 tools and is therefore about
 * nothing in particular.
 *
 * The description is written per category rather than generated from a
 * template, for the same reason a tool's is: a page whose description is
 * "Free <X> tools" for fifteen values of X is fifteen pages carrying one
 * description, and a search engine treats that as one page.
 */
export interface CategorySeo {
  slug: string
  category: string
  en: { name: string; description: string }
  ar: { name: string; description: string }
}

/**
 * Curated groups that cut ACROSS the categories — see `lib/collections.ts` for
 * why these earn a page where Recommended and Recently used do not.
 *
 * They share the `/c/` route with the categories, because a category and a
 * collection are the same thing to a reader: a named group of tools. One URL
 * space, one page, and `scripts/check-collections.mjs` refuses a slug that
 * collides with a category's.
 */
export const collectionSeo: CategorySeo[] = [
  {
    slug: 'ramadan', category: '',
    en: { name: 'Ramadan tools', description: 'Prayer times and a printable timetable, the Hijri calendar, a khatma plan, the adhkār, zakat, and the everyday things Ramadan changes — when to take medicine, how much water, and the six-hour working day. Free, and everything runs in your browser.' },
    ar: { name: 'أدوات رمضان', description: 'مواقيت الصلاة وجدول للطباعة، والتقويم الهجري، وخطة ختمة، والأذكار، والزكاة، وما يغيّره رمضان في اليوم — مواعيد الدواء، وكمية الماء، ويوم العمل السداسي. مجانًا، وكل شيء يعمل داخل متصفحك.' },
  },
  {
    slug: 'teaching', category: '',
    en: { name: 'Tools for teachers', description: 'Worksheets, quizzes and flashcards to print; Arabic handwriting practice with the correct joined letter forms; plus seating charts, attendance sheets, certificates, a weekly timetable and a wheel of names. Free, no sign-up, nothing uploaded.' },
    ar: { name: 'أدوات المعلّمين', description: 'أوراق عمل واختبارات وبطاقات مراجعة للطباعة؛ وتدريب على الخط العربي بالأشكال المتصلة الصحيحة؛ مع مخططات الجلوس وكشوف الحضور والشهادات وجدول أسبوعي وعجلة أسماء. مجانًا، دون تسجيل، ولا يُرفع شيء.' },
  },
  {
    slug: 'security', category: '',
    en: { name: 'Security and privacy tools', description: 'Generate a strong password or passphrase, check whether one has leaked without sending it, read a JWT or an SSL certificate, and hide a message inside a picture. Everything runs in your browser.' },
    ar: { name: 'أدوات الأمان والخصوصية', description: 'أنشئ كلمة مرور أو عبارة قوية، وتحقّق من تسرّبها دون إرسالها، واقرأ رمز JWT أو شهادة SSL، وأخفِ رسالة داخل صورة. كل ذلك داخل متصفحك.' },
  },
]

export const categorySeo: CategorySeo[] = [
  {
    slug: 'pdf', category: 'PDF',
    en: { name: 'Free PDF tools', description: 'Merge, split, compress, sign, fill, redact and rearrange PDFs — and read the text out of one, even a password-protected one. Every tool runs in your browser: the file is never uploaded.' },
    ar: { name: 'أدوات PDF مجانية', description: 'ادمج ملفات PDF وقسّمها واضغطها ووقّعها واملأ نماذجها واطمس منها وأعد ترتيب صفحاتها — واستخرج نصّها، حتى المحمي بكلمة مرور. كل أداة تعمل في متصفحك: ولا يُرفع الملف أبدًا.' },
  },
  {
    slug: 'images', category: 'Images',
    en: { name: 'Free image tools', description: 'Compress, crop, convert, resize and redact images, remove a background, read the text out of a picture, and strip the metadata a photo carries. Nothing is uploaded — including HEIC photos from an iPhone.' },
    ar: { name: 'أدوات الصور المجانية', description: 'اضغط الصور وقصّها وحوّلها وغيّر مقاسها واطمس منها، وأزل الخلفية، واستخرج النص من صورة، وامسح البيانات التي يحملها كل تصوير. ولا يُرفع شيء — بما في ذلك صور HEIC من الآيفون.' },
  },
  {
    slug: 'saudi', category: 'Saudi / Local',
    en: { name: 'Saudi tools and calculators', description: 'GOSI and net salary, end of service, iqama renewal cost, exit and re-entry, VAT and ZATCA e-invoicing, vehicle inspection and registration, rent rules, IBAN and the national short address. Each one names the authority to check it against.' },
    ar: { name: 'أدوات وحاسبات سعودية', description: 'التأمينات والراتب الصافي، ومكافأة نهاية الخدمة، وتكلفة تجديد الإقامة، والخروج والعودة، وضريبة القيمة المضافة والفوترة الإلكترونية، والفحص الدوري والاستمارة، وأحكام الإيجار، والآيبان والعنوان الوطني المختصر. وكل أداة تسمّي الجهة التي تُراجَع عندها.' },
  },
  {
    slug: 'islamic', category: 'Islamic',
    en: { name: 'Islamic tools', description: 'Prayer times and a printable timetable, qibla direction, the Hijri calendar and Hijri age, zakat, adhkār and Ḥiṣn al-Muslim, istikhāra, a khatma planner, and a Hajj and Umrah guide.' },
    ar: { name: 'أدوات إسلامية', description: 'مواقيت الصلاة وجدول للطباعة، واتجاه القبلة، والتقويم الهجري والعمر بالهجري، والزكاة، والأذكار وحصن المسلم، والاستخارة، ومخطط الختمة، ودليل الحج والعمرة.' },
  },
  {
    slug: 'arabic', category: 'Arabic',
    en: { name: 'Arabic language tools', description: 'Normalise hamzas and alef forms, convert between Arabic-Indic and Western digits, write numbers out in words (tafqīt), conjugate a verb, add diacritics, transliterate a name, and read Franco-Arabic.' },
    ar: { name: 'أدوات اللغة العربية', description: 'وحّد الهمزات وصور الألف، وحوّل بين الأرقام الهندية والعربية، واكتب الأرقام تفقيطًا، وصرّف فعلًا، وأضف التشكيل، واكتب الاسم بالإنجليزية، واقرأ العربيزي.' },
  },
  {
    slug: 'calculators', category: 'Calculators',
    en: { name: 'Free online calculators', description: 'Units and currency, map coordinates, the days between two dates with working days and an exact age, a stopwatch, timer and pomodoro, a tempo tap and a bill split. No sign-up and no adverts.' },
    ar: { name: 'حاسبات مجانية على الإنترنت', description: 'الوحدات والعملات، والإحداثيات، والمدة بين تاريخين مع أيام العمل والعمر بدقة، وساعة إيقاف ومؤقّت وبومودورو، وعدّاد الإيقاع، وتقسيم الفاتورة. بلا تسجيل وبلا إعلانات.' },
  },
  {
    slug: 'text', category: 'Text',
    en: { name: 'Free text tools', description: 'Count, compare, clean, change case, slugify, find invisible characters, fix mojibake, pull the text out of a document, and build a markdown table. Your text stays in the browser.' },
    ar: { name: 'أدوات النصوص المجانية', description: 'العدّ والمقارنة والتنظيف وتغيير حالة الأحرف والـslug، وكشف المحارف الخفية، وإصلاح النص المشوّه، واستخراج النص من مستند، وبناء جدول ماركداون. ويبقى نصّك في المتصفح.' },
  },
  {
    slug: 'developer', category: 'Developer',
    en: { name: 'Free developer tools', description: 'JSON, base64, hashes and HMAC, JWT and certificate decoding, regex, cron, UUIDs, subnets, timestamps, curl conversion and fake data. All client-side, so a secret you paste stays on your machine.' },
    ar: { name: 'أدوات المطوّرين المجانية', description: 'JSON وbase64 والبصمات وHMAC، وفكّ JWT والشهادات، والتعابير النمطية، وcron، والمعرّفات، والشبكات الفرعية، والطوابع الزمنية، وتحويل curl، وبيانات وهمية. كلها في المتصفح، فما تلصقه من أسرار يبقى على جهازك.' },
  },
  {
    slug: 'files', category: 'Files',
    en: { name: 'Free file tools', description: 'Inspect and extract a zip, read a file’s metadata, encrypt a file with a password, verify a hash, view the raw bytes, and hide a message in a picture. Files are read on your device.' },
    ar: { name: 'أدوات الملفات المجانية', description: 'افحص أرشيف zip واستخرج منه، واقرأ بيانات الملف، وشفّر ملفًا بكلمة مرور، وتحقّق من البصمة، واستعرض البايتات، وأخفِ رسالة في صورة. وتُقرأ الملفات على جهازك.' },
  },
  {
    slug: 'generators', category: 'Generators',
    en: { name: 'Free generators', description: 'QR codes and barcodes, passwords and passphrases, invoices and quotations, certificates, labels, worksheets, quizzes, bingo cards and lorem ipsum — generated in the browser and ready to print.' },
    ar: { name: 'مولّدات مجانية', description: 'الباركود ورموز QR، وكلمات المرور والعبارات، والفواتير وعروض الأسعار، والشهادات، والملصقات، وأوراق العمل، والاختبارات، وبطاقات البينغو، والنص البديل — تُولَّد في المتصفح وجاهزة للطباعة.' },
  },
  {
    slug: 'business', category: 'Business',
    en: { name: 'Free business tools', description: 'Invoices and quotations that print properly, and a scheduling page people can book you on. Free, and with no sign-up for the tools that need none.' },
    ar: { name: 'أدوات أعمال مجانية', description: 'فواتير وعروض أسعار تُطبع كما ينبغي، وصفحة حجز يحجز عليها الناس موعدًا معك. مجانًا، وبلا تسجيل فيما لا يحتاج إليه.' },
  },
  {
    slug: 'office', category: 'Office',
    en: { name: 'Free office apps in your browser', description: 'Edit Excel spreadsheets, Word documents and PowerPoint decks without installing anything or uploading a file. Everything stays in your browser, and you can edit live with others.' },
    ar: { name: 'تطبيقات مكتبية مجانية في متصفحك', description: 'عدّل جداول إكسل ومستندات وورد وعروض باوربوينت دون تثبيت شيء أو رفع أي ملف. يبقى كل شيء في متصفحك، ويمكنك التحرير مباشرة مع الآخرين.' },
  },
  {
    slug: 'communication', category: 'Communication',
    en: { name: 'Free communication tools', description: 'Browser-to-browser calls with no app and no account, and a personal link people can call you on. The audio and video go straight between the two devices.' },
    ar: { name: 'أدوات تواصل مجانية', description: 'مكالمات من متصفح إلى متصفح بلا تطبيق وبلا حساب، ورابط شخصي يتصل بك الناس عليه. ويمرّ الصوت والصورة مباشرة بين الجهازين.' },
  },
]
