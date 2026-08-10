// HELD-OUT SET #6 — written 11 August 2026, before any of it was run.
//
// Axes so far: tool-name-ish (#1), paraphrase (#2), natural sentence (#3),
// symptom (#4), file extension (#5), and a general Arabic set (#ar). This one
// is **Arabic MORPHOLOGY**, probed systematically — and it is chosen because
// the repo has been bitten by this exact class FOUR separate times, each found
// by accident:
//
//   · «فاتورة» could not reach «منشئ الفواتير» — the PLURAL does not contain
//     the singular, so the invoice QR reader won the invoice generator's query.
//   · «ترجمة» could not reach «المترجم» — an AGENT NOUN is not the verbal noun.
//   · «كلمة مرور» could not reach «مولّد كلمات المرور» — plural again.
//   · «وقّع على عقد» found NOTHING, because the VERB is not a substring of the
//     verbal noun «توقيع».
//
// Arabic is templatic: the root sits in a pattern, so the singular, the plural,
// the verb, the verbal noun and the agent noun share letters WITHOUT any of
// them containing another as a substring. A scorer built on substring and
// subsequence matching is structurally blind to that, and every fix so far has
// been to the metadata rather than to the scorer.
//
// So this set asks the same tool for the same thing in several morphological
// shapes. A tool that only indexes one of them will be found by exactly one row
// and missed by its neighbours, which is the signature to look for.
//
// Measure ONCE. Fix only unambiguous defects — a tool below the relevance floor
// for a shape of its own subject — record the rest, and mark the set spent.

export const UNTUNED6 = [
  // --- verb vs verbal noun --------------------------------------------------
  ['اختصر النص', 'summarize'],
  ['تلخيص النص', 'summarize'],
  ['ترجم جملة', 'translate'],
  ['احسب الزكاة', 'zakat-calculator'],
  ['حساب الزكاة', 'zakat-calculator'],
  ['اقسم ملف pdf', 'pdf-split'],
  ['تقسيم ملف pdf', 'pdf-split'],
  ['ادمج الصور', 'images-to-pdf'],
  ['اضغط الصورة', 'image-compressor'],
  ['ضغط الصورة', 'image-compressor'],
  ['حوّل التاريخ', 'hijri-calendar'],
  ['قص الفيديو', 'video-trim'],
  ['اقتصاص صورة', 'image-cropper'],

  // --- singular vs plural ---------------------------------------------------
  ['عرض تقديمي إلى نص', 'pptx-to-text'],
  ['جهة اتصال إلى جدول', 'vcard-to-csv'],
  ['جهات الاتصال', 'vcard-to-csv'],
  ['كلمة سر عشوائية', 'password-generator'],
  ['كلمات سر عشوائية', 'password-generator'],
  ['بطاقة تعليمية', 'flashcards'],
  ['بطاقات تعليمية', 'flashcards'],
  ['شهادة تقدير', 'certificate'],
  ['شهادات تقدير', 'certificate'],
  ['ورقة عمل', 'worksheets'],
  ['أوراق عمل', 'worksheets'],

  // --- the definite article, and the agent noun ------------------------------
  ['المترجم', 'translate'],
  ['المدقق اللغوي للعربية', 'diacritize'],
  ['العداد', 'text-counter'],
  ['الحاسبة الهجرية', 'hijri-age'],
  ['المولّد العشوائي', 'random-picker'],
  ['الضاغط', 'image-compressor'],

  // --- the same subject, several shapes -------------------------------------
  ['موقّع pdf', 'pdf-sign'],
  ['توقيع إلكتروني', 'pdf-sign'],
  ['وقّع المستند', 'pdf-sign'],
  ['محوّل العملات', 'currency-converter'],
  ['تحويل عملة', 'currency-converter'],
  ['حوّل الريال إلى دولار', 'currency-converter'],
  ['قارئ الباركود', 'qr-reader'],
  ['قراءة الباركود', 'qr-reader'],
  ['اقرأ الباركود', 'qr-reader'],

  // --- possessive and prepositional prefixes ---------------------------------
  ['للمخالفة المرورية', 'traffic-fine'],
  ['بالهجري', 'hijri-calendar'],
  ['كمستند وورد', 'markdown-docx'],
  ['بصيغة pdf', ['images-to-pdf', 'markdown-docx', 'pdf-to-images']],
  ['وللإيجار', 'rent-rules'],
]
