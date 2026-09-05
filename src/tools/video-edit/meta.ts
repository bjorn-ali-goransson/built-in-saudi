import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CropIcon } from '../../components/icons'

export const videoEditTool: Tool = {
  id: 'video-edit',
  name: 'Video Editor',
  nameAr: 'محرّر الفيديو',
  tagline: 'Crop, join, caption and censor a clip — on your device.',
  description:
    'Crop a video to the shape a platform wants, join a few clips end to end, and put a caption on top — all in your browser, with nothing uploaded. It shows you what a crop costs before you commit to it: going from a 16:9 recording to a 9:16 post keeps under a third of the picture, and whatever you filmed is rarely in the middle of what is left, so you drag to choose. Captions are drawn with this page’s own fonts, so Arabic joins up and runs right to left, and the preview is the export rather than an approximation of it. You can also draw a box over anything that should not be in the picture — a face, a plate, a name on a screen — and each box carries its own settings: pixelate, solid or blur, with what that choice costs written next to it. Pixelating a video gives the detail back — the mosaic grid stays still while your subject moves through it, and 64 frames of that recover 98.6% of a number plate — so solid is one tap away. The sound is copied across untouched rather than re-encoded, so it loses nothing.',
  category: 'Files',
  keywords: [
    'video editor', 'edit video', 'crop video', 'crop a video', 'resize video', 'aspect ratio',
    'merge videos', 'join videos', 'combine videos', 'concatenate video', 'stitch clips', 'add clips together',
    // The PLURAL and the Arabic DUAL, deliberately. A query is matched against
    // the indexed word and cannot be longer than it, so «فيديوهين» — which is
    // simply how you say "two videos" — could never reach «فيديو», and neither
    // could the English `videos`. It is the same trap as «كلمات» hiding «كلمة»
    // and as the -ise/-ize pair, in the one family where the plural IS the
    // intent: only this tool takes more than one video at a time.
    'videos', 'clips', 'two videos', 'two clips',
    'فيديوهات', 'فيديوهين', 'فيديوين', 'مقطعين', 'مقاطع',
    'add text to video', 'caption video', 'text on video', 'subtitle burn in', 'watermark video',
    // Video-QUALIFIED on purpose. `image-redact` owns the bare 'blur',
    // 'censor', 'redact' and «طمس»/«تمويه» for pictures, and taking those would
    // be the documented mistake of a new tool capturing a generic query another
    // tool answers. Measured before and after: every bench unchanged.
    // FEWER, and every one of them naming video. Two regressions came out of a
    // longer list, both measured rather than guessed:
    //   `black out part of a video` handed over the generic word "part", so
    //   `blur part of a picture` went to this tool over `image-redact`;
    //   and piling on near-duplicates ('blur a video', 'blur faces in video',
    //   'blur a face in a video') strengthened this tool's match on the bare
    //   word "video" until `my video file is too long to send` beat
    //   `video-trim` by 2%. A keyword list is not free — every entry also
    //   competes for the words it happens to contain.
    'blur a face in a video', 'censor video', 'hide a face in a video',
    'redact video', 'pixelate video', 'hide a number plate',
    'vertical video', 'square video', 'reels', 'tiktok', 'shorts', 'instagram', 'social media video',
    '9:16', '4:5', '16:9', 'mp4', 'clip', 'no watermark',
    'فيديو', 'محرر فيديو', 'تحرير فيديو', 'تعديل فيديو', 'اقتصاص الفيديو', 'قص أطراف الفيديو',
    'دمج مقاطع', 'دمج فيديو', 'ضم مقاطع', 'لصق مقاطع', 'إضافة نص على فيديو', 'كتابة على الفيديو',
    'نص على المقطع', 'فيديو عمودي', 'فيديو مربع', 'ريلز', 'تيك توك', 'شورتس', 'إنستغرام',
    'أبعاد الفيديو', 'مقاس الفيديو', 'بدون علامة مائية', 'دون رفع',
    'طمس وجه في فيديو', 'تمويه فيديو', 'إخفاء وجه في مقطع', 'حجب جزء من الفيديو',
    'تمويه لوحة السيارة', 'بكسلة فيديو',
  ],
  // NOT beta, and that is this repo's own rule rather than a downgrade in
  // confidence. The badge here means "this figure can go stale WITHOUT anyone
  // touching the code" — a GOSI rate that steps every July, a tariff that
  // moves. Nothing this tool prints can rot on its own: a crop percentage is
  // arithmetic and the pixel-recovery figure is a measurement in this repo. It
  // was carrying the badge in the maturity sense the badge explicitly is not
  // for, and paying for it with a bar above the video on every visit.
  status: 'stable',
  Icon: CropIcon,
  component: lazyTool(() => import('./VideoEditTool')),
  ar: {
    name: 'محرّر الفيديو',
    tagline: 'اقتصّ المقاطع وادمجها وضع عليها نصًّا واحجب ما تريد — على جهازك.',
    description:
      'اقتصّ الفيديو بالشكل الذي تطلبه المنصّة، وادمج عدة مقاطع واحدًا تلو الآخر، وضع نصًّا فوقها — كل ذلك داخل متصفحك دون رفع شيء. وتريك الأداة ثمن الاقتصاص قبل أن تلتزم به: الانتقال من تسجيل ١٦:٩ إلى منشور ٩:١٦ يُبقي أقلّ من ثلث الصورة، وما صوّرته نادرًا ما يكون في وسط ما تبقّى، فتسحب لتختار. وتُرسم النصوص بخطوط هذه الصفحة نفسها، فتتصل الحروف العربية وتجري من اليمين إلى اليسار، والمعاينة هي المُخرَج لا تقريبٌ له. ويمكنك أيضًا رسم مربّع فوق ما لا ينبغي أن يظهر — وجه أو لوحة سيارة أو اسم على شاشة — ولكل مربّع إعداداته: بكسلة أو حجب كامل أو تمويه، وإلى جانبها ثمن هذا الاختيار. فبكسلة الفيديو تعيد التفاصيل — شبكة البكسلة تثبت بينما يتحرك من تخفيه خلالها، و٦٤ إطارًا من ذلك تستردّ ٩٨٫٦٪ من لوحة السيارة — والحجب الكامل على بُعد نقرة. ويُنسخ الصوت كما هو دون إعادة ترميز فلا يفقد شيئًا.',
  },
}
