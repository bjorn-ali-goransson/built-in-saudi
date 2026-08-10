// HELD-OUT SET #3 — written 10 August 2026, before any of it was run.
//
// Why a third. Set #1 was BURNED by fixing what it found (it now reads 100%,
// which measures memory rather than generalisation). Set #2 sits at 45/50 and
// its five misses are deliberately unfixed to keep it usable — but it has been
// run as a regression check on every pass since, and a set you consult
// constantly stops being a surprise even if you never tune to it. Neither can
// answer the question this pass actually has: **did the last several changes —
// the category offer, the collections, the Health / Time & Date split, and six
// new tools — help a query nobody has seen?**
//
// Written the documented way: straight off the tool list in one sitting, in
// both languages, WITHOUT running any of them. Phrasings deliberately do not
// reuse either earlier set. Weighted towards what has changed — the newer
// tools, the newer groups, and everyday phrasings for old tools that nobody has
// probed — because a set that only exercises the settled parts cannot report on
// the unsettled ones.
//
// Measure ONCE. Fix only unambiguous defects (a shipped capability nobody can
// name, a keyword that lies), record the rest, and note in ROADMAP.md that the
// number is spent.

export const UNTUNED3 = [
  // --- the newer tools -----------------------------------------------------
  ['how long will my speech take', 'speech-time'],
  ['كم دقيقة يحتاج النص', 'speech-time'],
  ['when is the next public holiday', 'saudi-holidays'],
  ['عدد أيام الإجازات', 'saudi-holidays'],
  ['turn a pdf into a document i can edit', 'pdf-to-word'],
  ['embed a picture in css', 'image-base64'],
  ['render markdown', 'markdown-html'],
  ['حوّل ماركداون إلى صفحة', 'markdown-html'],

  // --- everyday phrasings for older tools ----------------------------------
  ['make a photo smaller to email it', 'image-compressor'],
  ['أريد تصغير حجم الصورة', 'image-compressor'],
  ['take the background out of a picture', 'remove-background'],
  ['put my signature on a contract', 'pdf-sign'],
  ['وقّع على عقد', 'pdf-sign'],
  ['black out a name in a document', 'pdf-redact'],
  ['read the text in a photo', 'image-to-text'],
  ['اقرأ النص من صورة', 'image-to-text'],
  ['shrink a pdf that is too big to send', 'pdf-compress'],
  ['stick two spreadsheets together', 'csv-merge'],
  ['اجمع ملفين اكسل', 'csv-merge'],
  ['what is inside this zip', 'archive-inspector'],
  ['strip the location from my photos', 'metadata-remove'],
  ['امسح بيانات الصورة', 'metadata-remove'],
  ['check if my password was leaked', 'password-strength'],
  ['هل كلمة مروري مسربة', 'password-strength'],
  ['two factor codes', 'totp'],
  ['make a printable timetable for prayers', 'prayer-timetable'],
  ['جدول مواقيت الصلاة للطباعة', 'prayer-timetable'],
  ['which direction do i pray', 'qibla'],
  ['how much zakat do i owe', 'zakat-calculator'],
  ['كم أدفع زكاة', 'zakat-calculator'],
  ['my end of service pay', 'end-of-service'],
  ['مكافأة نهاية الخدمة', 'end-of-service'],
  ['how many days off do i get a year', 'leave-overtime'],
  ['كم يوم إجازة سنوية', 'leave-overtime'],
  ['when does my car inspection expire', 'vehicle-renewal'],
  ['متى ينتهي الفحص الدوري', 'vehicle-renewal'],
  ['electricity bill estimate', 'electricity-bill'],
  ['حساب فاتورة الكهرباء', 'electricity-bill'],
  ['convert a date to hijri', 'hijri-calendar'],
  ['حوّل التاريخ للهجري', 'hijri-calendar'],
  ['write numbers in arabic words', 'tafqeet'],
  ['اكتب الرقم بالحروف', 'tafqeet'],
  ['add harakat to arabic text', 'diacritize'],
  ['تشكيل النص', 'diacritize'],
  ['practise arabic letters for kids', 'arabic-handwriting'],
  ['make a seating plan for my class', 'seating-chart'],
  ['مخطط جلوس الطلاب', 'seating-chart'],
  ['pick a random student', 'random-picker'],
  ['a countdown to a date', 'countdown'],
  ['كم باقي على موعد', 'countdown'],
  ['what does this cron line mean', 'cron-explainer'],
]
