import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { CloudIcon } from '../../components/icons'

export const weatherTool: Tool = {
  id: 'weather',
  name: 'Weather',
  nameAr: 'الطقس',
  tagline: 'Forecast, dust and the temperature at every prayer time.',
  description:
    'A clean forecast for any Saudi city or your own location: current conditions, the next 24 hours, the week ahead with Hijri dates, UV, and the dust and PM10 reading that actually matters here — plus the temperature at each prayer time, so you know before you go. Prayer times are worked out on your device; only a rounded coordinate is ever sent.',
  category: 'Saudi / Local',
  keywords: ['weather', 'forecast', 'temperature', 'dust', 'pm10', 'uv', 'rain', 'طقس', 'حالة الطقس', 'غبار', 'درجة الحرارة', 'توقعات', 'مطر'],
  status: 'stable',
  Icon: CloudIcon,
  component: lazyTool(() => import('./WeatherTool')),
  ar: {
    name: 'الطقس',
    tagline: 'النشرة والغبار ودرجة الحرارة عند كل صلاة.',
    description:
      'نشرة جوية نظيفة لأي مدينة سعودية أو لموقعك: الحالة الآن، والـ٢٤ ساعة القادمة، والأسبوع القادم بالتواريخ الهجرية، والأشعة فوق البنفسجية، وقراءة الغبار وPM10 التي تهمّ فعلًا هنا — مع درجة الحرارة عند كل وقت صلاة لتعرف قبل أن تخرج. تُحسب أوقات الصلاة على جهازك، ولا يُرسل سوى إحداثي مُقرَّب.',
  },
}
