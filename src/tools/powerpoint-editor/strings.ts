// The presentation editor's own words. The shared shell's are in components/office/strings.
import { LAYOUT_WORDS } from './model'

const en = {
  blurb: 'A presentation editor that runs in your browser. Open PowerPoint files, build slides with layouts, themes, shapes, pictures and tables, write speaker notes, and present full screen with a presenter view. Decks stay in this browser — nothing is uploaded — and you can invite others to edit live.',
  home: 'Home', insert: 'Insert', design: 'Design', transitions: 'Transitions', show: 'Slide Show', view: 'View', shapeTab: 'Shape', pictureTab: 'Picture', tableTab: 'Table',
  slides: 'Slides', font: 'Font', paragraph: 'Paragraph', drawing: 'Drawing', arrange: 'Arrange', editing: 'Editing', illustrations: 'Illustrations', text: 'Text', themes: 'Themes', customize: 'Customize', variants: 'Colours',
  newSlide: 'New slide', layout: 'Layout', duplicate: 'Duplicate', deleteSlide: 'Delete slide', hideSlide: 'Hide slide', showSlide: 'Show slide', reset: 'Reset', moveUp: 'Move up', moveDown: 'Move down',
  layouts: { title: 'Title slide', titleContent: 'Title and content', section: 'Section header', twoContent: 'Two content', titleOnly: 'Title only', blank: 'Blank', bigNumber: 'Big number', quote: 'Quote' } as Record<string, string>,
  bold: 'Bold', italic: 'Italic', underline: 'Underline', strike: 'Strikethrough', fontFamily: 'Font', fontSize: 'Font size', grow: 'Larger', shrink: 'Smaller', textColor: 'Text colour', highlight: 'Highlight',
  bullets: 'Bullets', numbering: 'Numbering', indentMore: 'Increase list level', indentLess: 'Decrease list level', alignStart: 'Align to start', alignCenter: 'Centre', alignEnd: 'Align to end', justify: 'Justify', rtl: 'Right to left', ltr: 'Left to right',
  anchorTop: 'Top', anchorMiddle: 'Middle', anchorBottom: 'Bottom', lineSpacing: 'Line spacing',
  fill: 'Fill', outline: 'Outline', noFill: 'No fill', noOutline: 'No outline', outlineWidth: 'Outline width', dash: 'Dashes', shadow: 'Shadow', arrows: 'Arrows', arrowEnd: 'Arrow at the end', arrowBoth: 'Arrows at both ends', noArrow: 'No arrows',
  front: 'Bring to front', back: 'Send to back', forward: 'Bring forward', backward: 'Send backward', alignObjects: 'Align', alignLeft: 'Align left', alignCentreH: 'Align centre', alignRight: 'Align right', alignTop: 'Align top', alignMiddle: 'Align middle', alignBottom: 'Align bottom', distributeH: 'Distribute horizontally', distributeV: 'Distribute vertically', toSlide: 'Relative to slide',
  rotate: 'Rotate', rotateRight: 'Rotate right 90°', rotateLeft: 'Rotate left 90°', flipH: 'Flip horizontal', flipV: 'Flip vertical', size: 'Size', width: 'Width', height: 'Height', position: 'Position',
  textBox: 'Text box', shapes: 'Shapes', picture: 'Picture', table: 'Table', line: 'Line', arrow: 'Arrow', link: 'Link', symbol: 'Symbol', icon: 'Icons', slideNumber: 'Slide number', date: 'Date',
  shapeGroups: { basic: 'Basic shapes', arrow: 'Arrows', flow: 'Flowchart', star: 'Stars', callout: 'Callouts', line: 'Lines' } as Record<string, string>,
  slideSize: 'Slide size', wide: 'Widescreen (16:9)', standard: 'Standard (4:3)', background: 'Background', bgPicture: 'Picture background', bgReset: 'Reset background', applyAll: 'Apply to all', themeFonts: 'Fonts', themeColors: 'Colours',
  transition: 'Transition', none: 'None', fade: 'Fade', push: 'Push', wipe: 'Wipe', cover: 'Cover', zoom: 'Zoom', duration: 'Duration', applyToAll: 'Apply to all slides',
  fromStart: 'From beginning', fromCurrent: 'From current slide', presenterView: 'Presenter view', separateWindow: 'Present in a separate window', rehearse: 'Rehearse timings',
  notes: 'Notes', notesPh: 'Click to add speaker notes', zoomFit: 'Fit', grid: 'Snap to guides', outlineView: 'Outline',
  altText: 'Alt text', crop: 'Crop', resetCrop: 'Reset crop', replacePicture: 'Change picture', deleteEl: 'Delete', rows: 'Rows', columns: 'Columns', rowAbove: 'Row above', rowBelow: 'Row below', colBefore: 'Column before', colAfter: 'Column after', deleteRow: 'Delete row', deleteCol: 'Delete column', merge: 'Merge cells', split: 'Split cell', headerRow: 'Header row', banded: 'Banded rows', cellFill: 'Cell fill', tableStyle: 'Table style',
  cut: 'Cut', copy: 'Copy', paste: 'Paste', selectAll: 'Select all', findPh: 'Find in slides', replacePh: 'Replace with', find: 'Find', replace: 'Replace', replaceAll: 'Replace all', noMatch: 'No matches', nOfM: (n: number, m: number) => `${n} of ${m}`, replacedN: (n: number) => `Replaced ${n}`,
  slideN: (n: number, m: number) => `Slide ${n} of ${m}`,
  linkUrl: 'Address (https://…), or pick a slide', linkSlide: 'Slide in this deck', removeLink: 'Remove link', ok: 'OK', cancel: 'Cancel', close: 'Close', apply: 'Apply',
  pictureBad: 'That picture could not be read.',
  markdown: 'Outline (Markdown)', pdf: 'PDF (print)', pptx: 'PowerPoint',
  present: { exit: 'End show', next: 'Next', prev: 'Previous', black: 'Black screen', white: 'White screen', laser: 'Laser pointer', pen: 'Pen', goTo: 'Go to slide', timer: 'Elapsed', clock: 'Time', nextSlide: 'Next slide', endOfShow: 'End of slide show — click to exit.', noNotes: 'No notes for this slide.', following: (n: string) => `Following ${n}'s slide show`, stopFollowing: 'Stop following', follow: 'Follow', isPresenting: (n: string) => `${n} is presenting`, popupBlocked: 'The browser blocked the second window. Allow pop-ups for this site and try again.' },
  templates: { blank: 'Blank presentation', pitch: 'Pitch', lesson: 'Lesson', update: 'Project update', event: 'Event' },
  words: LAYOUT_WORDS.en,
}

type Str = typeof en

const ar: Str = {
  blurb: 'محرر عروض تقديمية يعمل في متصفحك. افتح ملفات باوربوينت، وأنشئ شرائح بتخطيطات وسمات وأشكال وصور وجداول، واكتب ملاحظات المتحدث، واعرض بملء الشاشة مع عرض المقدم. تبقى العروض في هذا المتصفح ولا يُرفع شيء، ويمكنك دعوة آخرين للتحرير مباشرة.',
  home: 'الرئيسية', insert: 'إدراج', design: 'التصميم', transitions: 'الانتقالات', show: 'عرض الشرائح', view: 'عرض', shapeTab: 'الشكل', pictureTab: 'الصورة', tableTab: 'الجدول',
  slides: 'الشرائح', font: 'الخط', paragraph: 'الفقرة', drawing: 'الرسم', arrange: 'الترتيب', editing: 'التحرير', illustrations: 'الرسوم', text: 'النص', themes: 'السمات', customize: 'تخصيص', variants: 'الألوان',
  newSlide: 'شريحة جديدة', layout: 'التخطيط', duplicate: 'تكرار', deleteSlide: 'حذف الشريحة', hideSlide: 'إخفاء الشريحة', showSlide: 'إظهار الشريحة', reset: 'إعادة تعيين', moveUp: 'نقل لأعلى', moveDown: 'نقل لأسفل',
  layouts: { title: 'شريحة عنوان', titleContent: 'عنوان ومحتوى', section: 'رأس قسم', twoContent: 'محتويان', titleOnly: 'عنوان فقط', blank: 'فارغة', bigNumber: 'رقم كبير', quote: 'اقتباس' },
  bold: 'غامق', italic: 'مائل', underline: 'تسطير', strike: 'يتوسطه خط', fontFamily: 'الخط', fontSize: 'حجم الخط', grow: 'أكبر', shrink: 'أصغر', textColor: 'لون النص', highlight: 'تظليل',
  bullets: 'تعداد نقطي', numbering: 'ترقيم', indentMore: 'زيادة مستوى القائمة', indentLess: 'إنقاص مستوى القائمة', alignStart: 'محاذاة للبداية', alignCenter: 'توسيط', alignEnd: 'محاذاة للنهاية', justify: 'ضبط', rtl: 'من اليمين لليسار', ltr: 'من اليسار لليمين',
  anchorTop: 'أعلى', anchorMiddle: 'وسط', anchorBottom: 'أسفل', lineSpacing: 'تباعد الأسطر',
  fill: 'تعبئة', outline: 'حد', noFill: 'بلا تعبئة', noOutline: 'بلا حد', outlineWidth: 'سُمك الحد', dash: 'تقطيع', shadow: 'ظل', arrows: 'أسهم', arrowEnd: 'سهم في النهاية', arrowBoth: 'سهمان', noArrow: 'بلا أسهم',
  front: 'إحضار للأمام', back: 'إرسال للخلف', forward: 'تقديم خطوة', backward: 'إرجاع خطوة', alignObjects: 'محاذاة', alignLeft: 'محاذاة لليسار', alignCentreH: 'توسيط أفقي', alignRight: 'محاذاة لليمين', alignTop: 'محاذاة للأعلى', alignMiddle: 'توسيط عمودي', alignBottom: 'محاذاة للأسفل', distributeH: 'توزيع أفقي', distributeV: 'توزيع عمودي', toSlide: 'بالنسبة للشريحة',
  rotate: 'تدوير', rotateRight: 'تدوير لليمين ٩٠°', rotateLeft: 'تدوير لليسار ٩٠°', flipH: 'قلب أفقي', flipV: 'قلب عمودي', size: 'الحجم', width: 'العرض', height: 'الارتفاع', position: 'الموضع',
  textBox: 'مربع نص', shapes: 'أشكال', picture: 'صورة', table: 'جدول', line: 'خط', arrow: 'سهم', link: 'رابط', symbol: 'رمز', icon: 'أيقونات', slideNumber: 'رقم الشريحة', date: 'التاريخ',
  shapeGroups: { basic: 'أشكال أساسية', arrow: 'أسهم', flow: 'مخطط انسيابي', star: 'نجوم', callout: 'وسائل شرح', line: 'خطوط' },
  slideSize: 'حجم الشريحة', wide: 'شاشة عريضة (١٦:٩)', standard: 'قياسي (٤:٣)', background: 'الخلفية', bgPicture: 'صورة خلفية', bgReset: 'إعادة تعيين الخلفية', applyAll: 'تطبيق على الكل', themeFonts: 'الخطوط', themeColors: 'الألوان',
  transition: 'الانتقال', none: 'بلا', fade: 'تلاشٍ', push: 'دفع', wipe: 'مسح', cover: 'تغطية', zoom: 'تكبير', duration: 'المدة', applyToAll: 'تطبيق على كل الشرائح',
  fromStart: 'من البداية', fromCurrent: 'من الشريحة الحالية', presenterView: 'عرض المقدم', separateWindow: 'العرض في نافذة منفصلة', rehearse: 'تمرين التوقيت',
  notes: 'الملاحظات', notesPh: 'انقر لإضافة ملاحظات المتحدث', zoomFit: 'ملاءمة', grid: 'الالتصاق بالأدلة', outlineView: 'المخطط',
  altText: 'نص بديل', crop: 'اقتصاص', resetCrop: 'إلغاء الاقتصاص', replacePicture: 'تغيير الصورة', deleteEl: 'حذف', rows: 'الصفوف', columns: 'الأعمدة', rowAbove: 'صف أعلى', rowBelow: 'صف أسفل', colBefore: 'عمود قبل', colAfter: 'عمود بعد', deleteRow: 'حذف الصف', deleteCol: 'حذف العمود', merge: 'دمج الخلايا', split: 'تقسيم الخلية', headerRow: 'صف العناوين', banded: 'صفوف متناوبة', cellFill: 'تعبئة الخلية', tableStyle: 'نمط الجدول',
  cut: 'قص', copy: 'نسخ', paste: 'لصق', selectAll: 'تحديد الكل', findPh: 'ابحث في الشرائح', replacePh: 'استبدل بـ', find: 'بحث', replace: 'استبدال', replaceAll: 'استبدال الكل', noMatch: 'لا نتائج', nOfM: (n, m) => `${n.toLocaleString('ar-SA')} من ${m.toLocaleString('ar-SA')}`, replacedN: (n) => `استُبدل ${n.toLocaleString('ar-SA')}`,
  slideN: (n, m) => `الشريحة ${n.toLocaleString('ar-SA')} من ${m.toLocaleString('ar-SA')}`,
  linkUrl: 'العنوان (https://…) أو اختر شريحة', linkSlide: 'شريحة في هذا العرض', removeLink: 'إزالة الرابط', ok: 'موافق', cancel: 'إلغاء', close: 'إغلاق', apply: 'تطبيق',
  pictureBad: 'تعذّرت قراءة تلك الصورة.',
  markdown: 'المخطط (Markdown)', pdf: 'PDF (طباعة)', pptx: 'باوربوينت',
  present: { exit: 'إنهاء العرض', next: 'التالي', prev: 'السابق', black: 'شاشة سوداء', white: 'شاشة بيضاء', laser: 'مؤشر ليزر', pen: 'قلم', goTo: 'الانتقال إلى شريحة', timer: 'المنقضي', clock: 'الوقت', nextSlide: 'الشريحة التالية', endOfShow: 'انتهى العرض — انقر للخروج.', noNotes: 'لا ملاحظات لهذه الشريحة.', following: (n) => `تتابع عرض ${n}`, stopFollowing: 'إيقاف المتابعة', follow: 'متابعة', isPresenting: (n) => `${n} يقدّم العرض`, popupBlocked: 'منع المتصفح النافذة الثانية. اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.' },
  templates: { blank: 'عرض فارغ', pitch: 'عرض استثماري', lesson: 'درس', update: 'تحديث مشروع', event: 'فعالية' },
  words: LAYOUT_WORDS.ar,
}

export const SL_STR = { en, ar }
export type SlStr = Str

const LOSS_AR: Record<string, string> = {
  charts: 'المخططات البيانية', 'SmartArt diagrams': 'مخططات SmartArt', animations: 'الحركات', comments: 'التعليقات', sections: 'المقاطع',
  'video and sound': 'الفيديو والصوت', 'video and sound (their poster picture is kept)': 'الفيديو والصوت (بقيت صورتها)',
  'freeform shapes (drawn as their outline box)': 'الأشكال الحرة (رُسمت كمربع حدودها)', 'shapes this editor does not draw (shown as rectangles)': 'أشكال لا يرسمها هذا المحرر (عُرضت كمستطيلات)',
  'rotated groups (their shapes are placed unrotated)': 'المجموعات المدوَّرة (وُضعت أشكالها دون تدوير)', 'ink drawings': 'الرسم بالحبر',
  'embedded objects': 'الكائنات المضمّنة', 'embedded objects (their preview picture is kept)': 'الكائنات المضمّنة (بقيت صورة معاينتها)',
  'linked (not embedded) pictures': 'الصور المرتبطة (غير المضمّنة)', 'pictures in a format browsers cannot show (EMF, WMF, TIFF)': 'صور بصيغة لا تعرضها المتصفحات (EMF وWMF وTIFF)',
  'pictures that could not be read': 'صور تعذّرت قراءتها', 'pattern fills (drawn as their foreground colour)': 'التعبئة بالنقوش (رُسمت بلونها الأمامي)',
  'vertical text (shown horizontally)': 'النص العمودي (عُرض أفقيًا)', 'multiple text columns': 'الأعمدة النصية المتعددة', 'equations (kept as plain text)': 'المعادلات (بقيت نصًا عاديًا)',
  'pictures, tables and layout (an outline holds titles and text only)': 'الصور والجداول والتخطيط (المخطط يحمل العناوين والنصوص فقط)',
}
export function lossText(l: { what: string; count: number }, locale: 'en' | 'ar'): string {
  const label = locale === 'ar' ? LOSS_AR[l.what] || l.what : l.what
  return l.count > 1 ? `${label} (${new Intl.NumberFormat(locale === 'ar' ? 'ar-SA' : 'en').format(l.count)})` : label
}
