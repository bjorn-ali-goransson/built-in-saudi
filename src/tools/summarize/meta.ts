import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SummarizeIcon } from '../../components/icons'

export const summarizeTool: Tool = {
  id: 'summarize',
  name: 'Summarizer',
  nameAr: 'الملخِّص',
  tagline: 'Key points from long text, without uploading it.',
  description:
    'Turn a long article, thread, email or set of meeting notes into key points, a TL;DR, a teaser or a headline — using a model that runs inside your browser, so the text is never uploaded. Choose the style, the length and whether you want Markdown. English, Spanish, Japanese, German and French only: the on-device model does not do Arabic yet, and the tool says so rather than guessing. Needs Chrome or Edge 138+ on a computer.',
  category: 'Text',
  keywords: [
    'summarize', 'summariser', 'summary', 'tldr', 'key points', 'shorten', 'condense', 'article', 'notes',
    'offline', 'private', 'on-device', 'no upload',
    'تلخيص', 'ملخص', 'نقاط رئيسية', 'اختصار', 'مقال', 'ملاحظات', 'خصوصية', 'على الجهاز',
  ],
  status: 'beta',
  Icon: SummarizeIcon,
  component: lazyTool(() => import('./SummarizeTool')),
  ar: {
    name: 'الملخِّص',
    tagline: 'نقاط رئيسية من نص طويل، دون رفعه.',
    description:
      'حوّل مقالًا طويلًا أو سلسلة تغريدات أو بريدًا أو محضر اجتماع إلى نقاط رئيسية أو خلاصة مختصرة أو تشويق أو عنوان — عبر نموذج يعمل داخل متصفحك، فلا يُرفع النص أبدًا. اختر الأسلوب والطول وصيغة ماركداون إن أردت. الإنجليزية والإسبانية واليابانية والألمانية والفرنسية فقط: فالنموذج على الجهاز لا يدعم العربية بعد، والأداة تقول ذلك صراحةً بدل أن تخمّن. يتطلب Chrome أو Edge 138+ على حاسوب.',
  },
}
