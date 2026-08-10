// HELD-OUT SET #4 — written 10 August 2026, before any of it was run.
//
// Why a fourth. Sets #1 and #3 were BURNED by fixing what they found, and #2
// has been run as a regression check on every pass since, so none of them is a
// surprise any more. Nothing about the scorer or the metadata can be believed
// without a set nobody has seen.
//
// **This one is on an axis the other three do not cover.** Set #1 leans on
// tool-name-ish phrasings, #2 on fresh paraphrases, #3 on natural sentences —
// but all three describe the TOOL. This set describes the PROBLEM: what a
// person types when they know their symptom and not the name of the utility
// that fixes it. "my pdf is too big to email" names no tool, no format
// conversion and no verb the catalogue uses.
//
// That is the harder half of search and the more common one — somebody who
// already knows the tool exists usually knows roughly what it is called. It is
// also where a keyword list written by whoever built the tool is least likely
// to help, because it is written in the vocabulary of the solution.
//
// Written the documented way: straight off the tool list in one sitting, in
// both languages, WITHOUT running any of them. Measure ONCE, fix only
// unambiguous defects, and record in ROADMAP.md that the number is spent.

export const UNTUNED4 = [
  // --- a file that will not do what is needed of it ------------------------
  ['my pdf is too big to email', 'pdf-compress'],
  ['the photo is too heavy to upload', 'image-compressor'],
  ['my video file is too long to send', 'video-trim'],
  ['the scan has no selectable text', 'pdf-ocr'],
  ['someone sent me a spreadsheet i cannot open', 'xlsx-convert'],
  ['my phone photos are heic and will not open', 'image-format-converter'],
  ['the pdf pages are in the wrong order', 'pdf-organise'],
  ['i need to sign this without printing it', 'pdf-sign'],
  ['what type of file is this', 'file-metadata'],

  // --- text that arrived wrong ---------------------------------------------
  ['text came out as weird symbols', 'fix-encoding'],
  ['my arabic shows as question marks', 'fix-encoding'],
  ['there is something invisible pasted in my text', 'invisible-chars'],
  ['what changed between these two versions', 'text-diff'],
  ['i have two spreadsheets to compare', 'sheet-diff'],

  // --- something must not be shared ----------------------------------------
  ['remove personal info before sharing a photo', 'metadata-remove'],
  ['cover up a name in a screenshot', 'image-redact'],
  ['i need to prove a file was not changed', 'hash-generator'],
  ['i need fake customers for a demo', 'fake-data'],

  // --- media -----------------------------------------------------------------
  ['the recording has long silences in it', 'remove-silence'],
  ['i only need the sound from this clip', 'video-audio'],
  ['i want one still picture out of a video', 'video-frames'],
  ['how will my link look when someone shares it', 'link-preview'],

  // --- developer symptoms ----------------------------------------------------
  ['the api gave me a token i cannot read', 'jwt-decoder'],
  ['my colours do not pass accessibility', 'color-contrast'],
  ['my csv has duplicate rows', 'csv-clean'],

  // --- money, and the question behind it -------------------------------------
  ['how much will i take home after gosi', 'gosi-salary'],
  ['how much do i owe on a parcel from abroad', 'import-duty'],
  ['can my landlord put the rent up', 'rent-rules'],
  ['am i owed anything if i resign', 'end-of-service'],
  ['when can i renew my car registration', 'vehicle-renewal'],
  ['how much to renew my iqama with my family', 'iqama-fees'],
  ['i want to move to a new employer', 'sponsorship-transfer'],
  ['do i have to register for vat', 'vat-registration'],
  ['how much electricity am i using in riyals', 'electricity-bill'],
  ['what size air conditioner for my bedroom', 'ac-size'],

  // --- health ----------------------------------------------------------------
  ['when is the baby due', 'due-date'],
  ['which days am i most likely to conceive', 'ovulation'],
  ['what time should i go to bed', 'sleep-cycle'],
  ['how much water should i drink', 'water-intake'],

  // --- Arabic, same axis -----------------------------------------------------
  ['ملف بي دي اف كبير جدا', 'pdf-compress'],
  ['النص ظهر رموز غريبة', 'fix-encoding'],
  ['تغطية اسم في صورة', 'image-redact'],
  ['كم راتبي بعد التأمينات', 'gosi-salary'],
  ['هل يحق لي مكافأة نهاية الخدمة', 'end-of-service'],
  ['متى أجدد الاستمارة', 'vehicle-renewal'],
  ['كم رسوم تجديد الإقامة', 'iqama-fees'],
  ['هل يمكن رفع الإيجار', 'rent-rules'],
  ['كم أدفع جمارك على طرد', 'import-duty'],
  ['متى موعد الولادة', 'due-date'],
  ['حجم المكيف المناسب للغرفة', 'ac-size'],
]
