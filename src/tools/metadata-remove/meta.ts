import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EraseIcon } from '../../components/icons'

export const metadataRemoveTool: Tool = {
  id: 'metadata-remove',
  name: 'Remove Image Metadata',
  nameAr: 'إزالة بيانات الصورة',
  tagline: 'Strip GPS and camera data from a photo.',
  description:
    'A photo carries far more than the picture — where it was taken, on which phone, and when. This removes EXIF, GPS, XMP and IPTC data before you share it, without re-compressing the image, so the file loses its history and none of its quality. Shows you exactly what was in there first.',
  category: 'Images',
  keywords: ['remove exif', 'strip metadata', 'remove gps', 'clean photo', 'exif remover', 'privacy', 'anonymize image', 'إزالة exif', 'حذف البيانات', 'إزالة الموقع', 'خصوصية الصور'],
  status: 'stable',
  Icon: EraseIcon,
  component: lazyTool(() => import('./MetadataRemoveTool')),
  ar: {
    name: 'إزالة بيانات الصورة',
    tagline: 'احذف الموقع وبيانات الكاميرا من الصورة.',
    description:
      'تحمل الصورة أكثر من المشهد نفسه — مكان التقاطها والجهاز المستخدم ووقتها. تزيل هذه الأداة بيانات EXIF وGPS وXMP وIPTC قبل المشاركة، دون إعادة ضغط الصورة، فيفقد الملف تاريخه ولا يفقد شيئًا من جودته. وتعرض لك أولًا ما كان بداخله.',
  },
}
