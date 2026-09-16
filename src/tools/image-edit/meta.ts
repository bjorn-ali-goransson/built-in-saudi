import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EditIcon } from '../../components/icons'

export const imageEditTool: Tool = {
  id: 'image-edit',
  name: 'Image Editor',
  nameAr: 'محرّر الصور',
  tagline: 'Crop, hide and caption a picture — on your device.',
  description:
    'The video editor’s screen, for the one-frame case: crop a picture to the shape a platform wants, draw a box over anything that should not be in it, and type a caption straight onto the frame — in your browser, with nothing uploaded. It shows what a crop costs before you commit to it, and the rectangle is dragged over the WHOLE picture so you can see what is being thrown away rather than watching the result appear to zoom. A dragged corner snaps onto 9:16, 1:1, 4:5 or 16:9 when it gets close and lets go again when it does not, so an arbitrary shape is still expressible. Captions are drawn with this page’s own fonts, so Arabic joins up and runs right to left. The box that hides something offers pixelate, solid or blur, with what that choice costs written next to it — a single picture gives far less back to a pixel-unpicking attack than a video does, and the tool says so rather than repeating the video figure it did not measure here. And there is a control that tilts every picture one degree clockwise, on by default, because somebody asked for it that way.',
  category: 'Images',
  keywords: [
    // EDITOR-shaped, deliberately. `image-cropper` owns 'crop image' and
    // `image-redact` owns the bare 'blur', 'redact' and «طمس» for pictures, and
    // taking either would be the documented mistake of a new tool capturing a
    // generic query an established tool already answers. What this one owns is
    // the query for doing several of those things at once.
    'image editor', 'photo editor', 'edit an image', 'edit a photo', 'edit a picture',
    'picture editor', 'image editing', 'photo editing',
    // NOT 'crop blur and caption'. It was there for one iteration and cost
    // held-out #2 a row: `blur part of a picture` came HERE over
    // `image-redact`, because the phrase carries the generic word "blur" and
    // the scorer matches the words a phrase happens to contain rather than the
    // phrase. Sixth application of the documented rule, and the documented fix
    // — the established tool keeps the word, and wrapping it in a phrase does
    // not remove it.
    'crop and caption a photo', 'add text to a photo',
    'text on a photo', 'caption a picture', 'write on a photo',
    'social media image', 'instagram post size', 'story size', 'thumbnail',
    'jpg', 'jpeg', 'png', 'webp', 'heic',
    'محرر الصور', 'تحرير الصور', 'تعديل الصور', 'تحرير صورة', 'تعديل صورة',
    'الكتابة على الصور', 'إضافة نص على صورة', 'نص على الصورة',
    'صورة للنشر', 'مقاس المنشور', 'ستوري', 'إنستغرام',
    // FROM `image-rearrange`, folded in here with the scissors and the plus.
    // Its own name first, because somebody who used it will type it — and then
    // only the phrases that say what this tool DOES. The bare 'crop', 'move',
    // 'rotate', 'cut' and 'screenshot' it also carried are deliberately left
    // behind: `image-cropper`, `image-rotate` and `screenshot-frame` own those,
    // and a merged tool inheriting a generic word is the same defect as a new
    // tool capturing one. **A MERGE IS NOT A LICENCE TO INHERIT THE LIST.**
    //
    // It was `cut out part of an image` for one measurement, and that cost
    // held-out #2 the same row the note above records: `blur part of a picture`
    // came HERE, because the phrase carries the generic word "part" — which is
    // the identical entry `video-edit` had to drop, in the identical query.
    // `piece` instead, and every one of the nine benches is byte-identical to
    // the baseline taken before the merge.
    'rearrange', 'rearrange image', 'collage',
    'cut a piece out of an image', 'put one image on another', 'place an image on a photo',
    'إعادة ترتيب الصورة', 'ترتيب الصورة', 'قص جزء من الصورة', 'ضع صورة فوق صورة',
  ],
  // NOT beta, on this repo's own rule: the badge means a figure can go stale
  // WITHOUT anyone touching the code. A crop percentage is arithmetic and an
  // output size is a measurement of the file in front of it.
  status: 'stable',
  Icon: EditIcon,
  component: lazyTool(() => import('./ImageEditTool')),
  ar: {
    name: 'محرّر الصور',
    tagline: 'اقتصّ الصورة واحجب ما فيها وضع عليها نصًّا — على جهازك.',
    description:
      'شاشة محرّر الفيديو نفسها، لحالة الإطار الواحد: اقتصّ الصورة بالشكل الذي تطلبه المنصّة، وارسم مربّعًا فوق ما لا ينبغي أن يظهر، واكتب النص على الصورة مباشرة — داخل متصفحك دون رفع شيء. وتريك الأداة ثمن الاقتصاص قبل أن تلتزم به، ويُسحب المستطيل فوق الصورة كاملةً لترى ما يُستبعد بدل أن ترى النتيجة وكأنها تتقرّب. والزاوية المسحوبة تلتقط ٩:١٦ أو ١:١ أو ٤:٥ أو ١٦:٩ إذا اقتربت منها وتتركها إذا ابتعدت، فتبقى النِّسَب الحرّة ممكنة. وتُرسم النصوص بخطوط هذه الصفحة نفسها، فتتصل الحروف العربية وتجري من اليمين إلى اليسار. ويقدّم مربّع الإخفاء بكسلةً أو حجبًا كاملًا أو تمويهًا، وإلى جانبها ثمن هذا الاختيار — فالصورة الواحدة تعيد من البكسلة أقلّ بكثير مما يعيده الفيديو، وتقول الأداة ذلك بدل أن تكرّر رقمًا لم يُقَس هنا. وفيها أيضًا خيار يُميل كل صورة درجةً واحدة مع عقارب الساعة، مفعَّلٌ تلقائيًّا، لأن أحدهم طلبه هكذا.',
  },
}
