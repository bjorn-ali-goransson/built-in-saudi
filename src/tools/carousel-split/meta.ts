import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { SplitIcon } from '../../components/icons'

export const carouselSplitTool: Tool = {
  id: 'carousel-split',
  name: 'Carousel Splitter',
  nameAr: 'تقسيم الكاروسيل',
  tagline: 'One wide image, cut into slides that line up.',
  description:
    'Cut a panorama or a wide graphic into Instagram carousel slides that read as one continuous picture when someone swipes. Each slide comes out at the platform’s aspect ratio — which is what makes the seams actually meet — and the files are numbered so they upload in order. Optional edge overlap hides the hairline some viewers draw between slides.',
  category: 'Images',
  keywords: ['carousel', 'instagram', 'split image', 'panorama', 'slides', 'swipe', 'كاروسيل', 'انستقرام', 'تقسيم صورة', 'شرائح', 'بانوراما'],
  status: 'stable',
  Icon: SplitIcon,
  component: lazyTool(() => import('./CarouselSplitTool')),
  ar: {
    name: 'مقسّم صور الكاروسيل',
    tagline: 'صورة عريضة واحدة، مقسّمة إلى شرائح متصلة.',
    description:
      'قسّم صورة بانورامية أو رسمًا عريضًا إلى شرائح كاروسيل انستقرام تُقرأ كصورة واحدة متصلة عند التمرير. تخرج كل شريحة بنسبة أبعاد المنصة — وهو ما يجعل الحواف تلتقي فعلًا — وتُرقَّم الملفات لترفعها بالترتيب. وتداخل الحواف الاختياري يخفي الخط الشعري الذي ترسمه بعض العارضات بين الشرائح.',
  },
}
