// The ARABIC held-out set. Nothing here may be tuned against.
//
// The three existing sets are 10–16% Arabic — 32 queries out of 233 — on a site
// whose audience is half Arabic-speaking and whose two worst search defects
// were both Arabic morphology: a name in the plural not containing its
// singular, and the definite article making the QUERY longer than the indexed
// text. Measuring the Arabic half at a tenth of the rate is how those survived
// as long as they did.
//
// Written in one sitting off the tool list, before any was run, and sharing no
// query with the other three sets. Where a phrasing came close to an existing
// one it was changed rather than reused: a paraphrase of a query the scorer was
// already fixed for is not held out.
//
// These are phrasings, not transliterations. Somebody looking for the redactor
// types «طمس», not «redact».
//
// FIRST RUN, 8 August 2026: **90% top-1, 98% top-3, 0 unfindable** — the same
// as the English held-out set, which refutes the hypothesis that the Arabic
// half was markedly worse. That 90% is the number to quote.
//
// Of the four misses, ONE was a defect and three were this file being wrong:
//   · «كلمة مرور قوية» went to the strength checker, because the generator's
//     Arabic name was «مولّد كلمات المرور» — the PLURAL, which does not contain
//     the singular «كلمة» a person types. The same morphology trap already
//     recorded for فاتورة and ترجمة. Renamed; 90% -> 93%.
//   · «طمس» was missing from the redactor entirely (41.67, below the floor).
//   · two rows were genuinely ambiguous and are marked as such.
//
// STATUS: partly burned. Re-run it, but write a new set before believing a
// number from it about an unseen query.
export const UNTUNED_AR = [
  // PDF
  ['ضغط ملف pdf كبير', 'pdf-compress'],
  ['دمج ملفات pdf', 'pdf-merge'],
  ['تقسيم ملف pdf', 'pdf-split'],
  ['توقيع مستند pdf', 'pdf-sign'],
  ['استخراج النص من ملف pdf', 'pdf-to-text'],
  ['ترقيم صفحات pdf', 'pdf-stamp'],
  // Images
  ['إزالة الخلفية من الصورة', 'remove-background'],
  ['قص الصورة', 'image-cropper'],
  ['تصغير حجم الصورة', 'image-compressor'],
  ['صورة شخصية للجواز', 'passport-photo'],
  ['حذف بيانات الصورة', 'metadata-remove'],
  // EXPECTATION WAS WRONG. «إخفاء معلومات في صورة» is literally "hiding
  // information inside an image", which IS steganography — the tool that won.
  // The Arabic for redaction is «طمس», so that is what the redactor is benched
  // on, and «طمس» turned out to be missing from its keywords entirely: it
  // scored 41.67, below the relevance floor, so it did not appear at all.
  ['إخفاء معلومات في صورة', 'steganography'],
  ['طمس وجه في صورة', 'image-redact'],
  ['استخراج الألوان من صورة', 'color-palette'],
  // Saudi / official
  ['مكافأة نهاية الخدمة', 'end-of-service'],
  ['رسوم تجديد الإقامة', 'iqama-fees'],
  ['متى ينتهي الفحص الدوري', 'vehicle-renewal'],
  ['ضريبة القيمة المضافة', 'vat-calculator'],
  ['هل يلزمني التسجيل في الضريبة', 'vat-registration'],
  ['تحويل لوحة السيارة', 'saudi-plate'],
  ['التحقق من الآيبان', 'iban-validator'],
  ['العنوان الوطني المختصر', 'short-address'],
  ['تنسيق رقم الجوال السعودي', 'saudi-phone'],
  // Islamic
  ['اتجاه القبلة', 'qibla'],
  ['أذكار الصباح والمساء', 'adhkar'],
  ['حساب زكاة المال', 'zakat-calculator'],
  ['التقويم الهجري', 'hijri-calendar'],
  ['دليل الحج والعمرة', 'hajj-umrah'],
  // Arabic language
  ['تصحيح النص المشوّه', 'fix-encoding'],
  ['كتابة الاسم بالإنجليزية', 'name-spelling'],
  ['توحيد الهمزات', 'arabic-normalize'],
  ['الأرقام الهندية والعربية', 'arabic-numerals'],
  // Everyday
  ['كلمة مرور قوية', 'password-generator'],
  // Ambiguous BY DESIGN, and this file already says so: CLAUDE.md records that
  // «باركود» is what Saudi usage calls a QR code. Both readings are right.
  ['مولّد باركود', ['barcode', 'qr-code']],
  ['تقسيم الفاتورة بين الأصدقاء', 'split-bill'],
  ['مقارنة نصين', 'text-diff'],
  ['تسجيل الشاشة', 'screen-recorder'],
  ['قص مقطع صوتي', 'audio-trim'],
  ['ساعة إيقاف', 'stopwatch'],
  // Two tools that are both a wheel you spin to choose. Nothing in the phrase
  // picks between them.
  ['عجلة الاختيار العشوائي', ['spin-wheel', 'random-picker']],
  ['تحويل ملف إكسل إلى csv', 'xlsx-convert'],
]
