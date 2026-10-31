// The bench queries themselves, so more than one harness can read them.
//
// They lived inside searchbench.mjs, which RUNS on import — so floorprobe.mjs
// could not borrow them without re-running the whole bench as a side effect.
// Same lesson as evals/lib/cvfacts.mjs: the moment a second harness needs the
// data, the data stops belonging to the first one.

export const BENCH_QUERIES = [
  ['pdf merge', 'pdf-merge'],
  ['merge pdf', 'pdf-merge'],
  ['combine pdfs', 'pdf-merge'],
  ['compress image', 'image-compressor'],
  ['make picture smaller', 'image-compressor'],
  // The expectation here was WRONG, and the bench was scoring the right answer
  // as a failure. The cropper never changes an image's dimensions — it returns
  // the pixels inside the box — while the compressor takes a max width. So the
  // compressor is what "resize photo" means, and the cropper's `resize` keyword
  // (which described dragging the crop box) has been removed.
  ['resize photo', 'image-compressor'],
  ['qr', 'qr-code'],
  ['scan qr', 'qr-reader'],
  ['password', 'password-generator'],
  ['strong password', 'password-generator'],
  ['is my password good', 'password-strength'],
  ['prayer', 'prayer-times'],
  ['prayer times print', 'prayer-times'],
  ['hijri', 'hijri-calendar'],
  ['zakat', 'zakat-calculator'],
  ['iban', 'iban-validator'],
  ['iqama expiry', 'id-expiry'],
  ['translate', 'translate'],
  ['excel to csv', 'excel-editor'],
  ['xlsx', 'excel-editor'],
  // Directionless: whichever way you read it, one of the pair is right.
  ['contacts vcf', ['csv-vcard']],
  ['trim video', 'video-edit'],
  ['cut video', 'video-edit'],
  ['certificate ssl', 'cert-decoder'],
  ['seating', 'seating-chart'],
  ['attendance', 'attendance-sheet'],
  ['worksheet', 'worksheets'],
  ['quiz', 'quiz-maker'],
  ['khatma', 'khatma'],
  ['handwriting', 'arabic-handwriting'],
  ['plate', 'saudi-plate'],
  ['short address', 'short-address'],
  ['name in english', 'name-spelling'],
  ['metronome', 'metronome'],
  ['cv', 'ats-cv-optimizer'],
  ['resume', 'ats-cv-optimizer'],
  ['book meeting', 'book-me'],
  ['video call', 'calls'],
  ['background remove', 'remove-background'],
  ['ocr', 'image-to-text'],
  ['text from image', 'image-to-text'],
  ['jwt', 'jwt-decoder'],
  ['cron', 'cron-builder'],
  ['unit convert', 'unit-converter'],
  ['currency', 'currency-converter'],
  ['weather', 'weather'],
  ['قبلة', 'qibla'],
  ['مواقيت', 'prayer-times'],
  ['زكاة', 'zakat-calculator'],
  ['ضغط صورة', 'image-compressor'],
  ['ترجمة', 'translate'],
  // The file tools added in the code-sweep batch. A tool nobody can find is a
  // tool that does not exist, so each one is benched on the words a person
  // would actually type — not the words the code uses.
  ['scanned pdf', 'pdf-ocr'],
  ['pdf ocr', 'pdf-ocr'],
  ['read a scanned document', 'pdf-ocr'],
  ['word to text', 'word-editor'],
  ['docx', 'word-editor'],
  ['open a word file', 'word-editor'],
  ['csv to excel', 'excel-editor'],
  ['leading zeros', 'excel-editor'],
  ['مسح ضوئي', 'pdf-ocr'],
  ['powerpoint to text', 'powerpoint-editor'],
  ['pptx', 'powerpoint-editor'],
  ['slides to text', 'powerpoint-editor'],
  ['speaker notes', 'powerpoint-editor'],
  ['بوربوينت', 'powerpoint-editor'],
  // The Saudi tools from the August sweeps. These are the ones where being
  // unfindable costs most: someone looking for "what is deducted from my
  // salary" will not browse a catalogue for it.
  ['stopwatch', 'stopwatch'],
  ['video to image', 'video-edit'],
  ['grab a frame from a video', 'video-edit'],
  ['thumbnail from video', 'video-edit'],
]
