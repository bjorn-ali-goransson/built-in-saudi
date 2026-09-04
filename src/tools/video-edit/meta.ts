import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CropIcon } from '../../components/icons'

export const videoEditTool: Tool = {
  id: 'video-edit',
  name: 'Video Editor',
  nameAr: 'محرّر الفيديو',
  tagline: 'Crop, join and caption a clip for social — on your device.',
  description:
    'Crop a video to the shape a platform wants, join a few clips end to end, and put a caption on top — all in your browser, with nothing uploaded. It shows you what a crop costs before you commit to it: going from a 16:9 recording to a 9:16 post keeps under a third of the picture, and whatever you filmed is rarely in the middle of what is left, so you drag to choose. Captions are drawn with this page’s own fonts, so Arabic joins up and runs right to left, and the preview is the export rather than an approximation of it. The sound is copied across untouched rather than re-encoded, so it loses nothing.',
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
    'vertical video', 'square video', 'reels', 'tiktok', 'shorts', 'instagram', 'social media video',
    '9:16', '4:5', '16:9', 'mp4', 'clip', 'no watermark',
    'فيديو', 'محرر فيديو', 'تحرير فيديو', 'تعديل فيديو', 'اقتصاص الفيديو', 'قص أطراف الفيديو',
    'دمج مقاطع', 'دمج فيديو', 'ضم مقاطع', 'لصق مقاطع', 'إضافة نص على فيديو', 'كتابة على الفيديو',
    'نص على المقطع', 'فيديو عمودي', 'فيديو مربع', 'ريلز', 'تيك توك', 'شورتس', 'إنستغرام',
    'أبعاد الفيديو', 'مقاس الفيديو', 'بدون علامة مائية', 'دون رفع',
  ],
  status: 'beta',
  Icon: CropIcon,
  component: lazyTool(() => import('./VideoEditTool')),
  ar: {
    name: 'محرّر الفيديو',
    tagline: 'اقتصّ المقاطع وادمجها وضع عليها نصًّا — على جهازك.',
    description:
      'اقتصّ الفيديو بالشكل الذي تطلبه المنصّة، وادمج عدة مقاطع واحدًا تلو الآخر، وضع نصًّا فوقها — كل ذلك داخل متصفحك دون رفع شيء. وتريك الأداة ثمن الاقتصاص قبل أن تلتزم به: الانتقال من تسجيل ١٦:٩ إلى منشور ٩:١٦ يُبقي أقلّ من ثلث الصورة، وما صوّرته نادرًا ما يكون في وسط ما تبقّى، فتسحب لتختار. وتُرسم النصوص بخطوط هذه الصفحة نفسها، فتتصل الحروف العربية وتجري من اليمين إلى اليسار، والمعاينة هي المُخرَج لا تقريبٌ له. ويُنسخ الصوت كما هو دون إعادة ترميز فلا يفقد شيئًا.',
  },
}
