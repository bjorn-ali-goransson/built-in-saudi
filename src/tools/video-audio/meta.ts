import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { VolumeIcon } from '../../components/icons'

export const videoAudioTool: Tool = {
  id: 'video-audio',
  name: 'Extract Audio from Video',
  nameAr: 'استخراج الصوت من فيديو',
  tagline: 'Take the sound out of a video, without uploading it.',
  description:
    'Pull the soundtrack out of an MP4, MOV, WebM or MKV and save it as an audio file. The video is decoded in your browser — it is never uploaded, never watched, and only the audio track is read. Useful for lectures, khutbahs, interviews and anything you would rather listen to than watch.',
  category: 'Files',
  keywords: ['video', 'audio', 'extract', 'mp4', 'mp3', 'soundtrack', 'convert', 'فيديو', 'صوت', 'استخراج', 'تحويل', 'محاضرة'],
  status: 'stable',
  Icon: VolumeIcon,
  component: lazyTool(() => import('./VideoAudioTool')),
  ar: {
    name: 'استخراج الصوت من الفيديو',
    tagline: 'استخرج الصوت من مقطع فيديو، دون رفعه.',
    description:
      'استخرج المسار الصوتي من ملف MP4 أو MOV أو WebM أو MKV واحفظه ملفًا صوتيًا. يُفك ترميز الفيديو داخل متصفحك — فلا يُرفع أبدًا، ولا يُشاهَد، ولا يُقرأ منه إلا مسار الصوت. مفيد للمحاضرات والخطب والمقابلات وكل ما تفضّل سماعه على مشاهدته.',
  },
}
