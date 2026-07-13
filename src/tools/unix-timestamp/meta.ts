import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { EpochIcon } from '../../components/icons'

export const unixTimestampTool: Tool = {
  id: 'unix-timestamp',
  name: 'Unix Timestamp',
  tagline: 'Convert between Unix time and human dates.',
  description:
    'Convert a Unix timestamp (seconds or milliseconds) to a readable date and back, in both your local timezone and UTC, with a live current-time readout. Runs entirely in your browser.',
  category: 'Developer',
  keywords: ['unix', 'timestamp', 'epoch', 'time', 'date', 'utc', 'seconds', 'milliseconds', 'طابع زمني', 'يونكس'],
  status: 'stable',
  Icon: EpochIcon,
  component: lazyTool(() => import('./UnixTimestampTool')),
  ar: {
    name: 'الطابع الزمني يونكس',
    tagline: 'حوّل بين وقت يونكس والتواريخ المقروءة.',
    description:
      'حوّل طابعًا زمنيًا يونكس (بالثواني أو المللي ثانية) إلى تاريخ مقروء والعكس، بتوقيتك المحلي وبتوقيت UTC، مع عرض حيّ للوقت الحالي. يعمل بالكامل في متصفحك.',
  },
}
