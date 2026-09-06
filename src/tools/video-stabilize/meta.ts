import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SteadyIcon } from '../../components/icons'

export const videoStabilizeTool: Tool = {
  id: 'video-stabilize',
  name: 'Video Stabilizer',
  nameAr: 'تثبيت الفيديو',
  tagline: 'Take the wobble out of handheld video — on your device.',
  description:
    'Handheld video shakes, and every tool that fixes it wants your file on somebody else’s server first. This measures how the camera actually moved — a grid of points tracked from frame to frame, so a person walking through the shot does not drag the estimate after them — smooths that path, and slides each frame back under it. What it will not do is pretend the correction is free: sliding a frame back means its far edge slides out of the picture, so a stabiliser always crops, and this one works out how much from YOUR clip and shows the figure before you commit rather than making you pick a percentage in advance. One slider re-prices the trade instantly, because the clip is only measured once. It can also hold a moving SUBJECT in the middle instead of the camera: drag a box around it, and the frame follows it — which costs far more picture, and the figure says how much before you commit. The sound is copied across untouched rather than re-encoded, so it loses nothing.',
  category: 'Files',
  keywords: [
    'video stabilizer', 'video stabiliser', 'stabilize video', 'stabilise video',
    'stabilize a video', 'video stabilization', 'video stabilisation',
    // The SYMPTOM, not the remedy. Held-out set #4 measured the catalogue being
    // written in the vocabulary of the solution while people type the vocabulary
    // of the problem — and "my video is shaky" is exactly that shape.
    'shaky video', 'shaky footage', 'my video is shaky', 'camera shake',
    'jerky video', 'wobbly video', 'bumpy footage', 'smooth out a video',
    'steady a video', 'steady cam', 'handheld video', 'no gimbal',
    'remove camera shake', 'fix shaky video',
    // The FOLLOW half, and it is TWO entries after measuring rather than the
    // five it started as. Held-out #4's "my video file is too long to send"
    // went to this tool over `video-trim`, and bisecting found no single
    // culprit — it was cumulative, which is this file's own rule that every
    // keyword also competes for the words it happens to contain. `keep subject
    // centred` was the worst: "send" is a SUBSEQUENCE of it, so the scorer's
    // fallback credited coverage the phrase never meant. These two cost
    // nothing on any bench.
    'follow a subject', 'track a moving subject',
    'mp4', 'clip',
    'تثبيت الفيديو', 'تثبيت المقطع', 'فيديو مهتز', 'اهتزاز الكاميرا',
    'إزالة اهتزاز الفيديو', 'تنعيم حركة الكاميرا', 'فيديو غير ثابت',
    'تصوير باليد', 'ثبّت الفيديو', 'مقطع مهتز', 'رجفة الكاميرا',
    'تتبع هدف في الفيديو', 'إبقاء الهدف في المنتصف', 'تتبع شخص في الفيديو',
  ],
  // NOT beta, on this repo's own rule: the badge means a figure can go stale
  // WITHOUT anyone touching the code — a GOSI rate that steps every July. Every
  // number this tool prints is measured from the clip in front of it.
  status: 'stable',
  Icon: SteadyIcon,
  component: lazyTool(() => import('./VideoStabilizeTool')),
  ar: {
    name: 'تثبيت الفيديو',
    tagline: 'أزل اهتزاز الفيديو المصوَّر باليد — على جهازك.',
    description:
      'الفيديو المصوَّر باليد يهتزّ، وكل أداة تعالج ذلك تريد ملفك على خادم غيرك أولًا. أما هنا فتُقاس حركة الكاميرا فعليًّا — شبكة من النقاط تُتتبَّع من إطار إلى إطار، فلا يجرّ عابرٌ في المشهد التقديرَ خلفه — ثم يُنعَّم المسار وتُزحزح الإطارات لتعود تحته. وما لا تدّعيه الأداة أن التصحيح مجّاني: فإزاحة الإطار تُخرج طرفه البعيد من الصورة، ولذلك يقتصّ كل مثبِّت، وهذا يحسب المقدار من مقطعك أنت ويعرضه قبل أن تلتزم به بدل أن يطلب منك نسبةً مسبقة. ويُعاد التسعير فورًا عند تحريك المؤشر، لأن المقطع يُقاس مرة واحدة. وتستطيع الأداة كذلك تثبيت هدف متحرك في المنتصف بدل الكاميرا: ارسم مربّعًا حوله فيتبعه الإطار — وهذا يكلّف من الصورة أكثر بكثير، والرقم يقول كم قبل أن تلتزم. ويُنسخ الصوت كما هو دون إعادة ترميز فلا يفقد شيئًا.',
  },
}
