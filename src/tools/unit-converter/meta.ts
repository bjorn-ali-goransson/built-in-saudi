import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { RulerIcon } from '../../components/icons'

export const unitConverterTool: Tool = {
  id: 'unit-converter',
  name: 'Unit Converter',
  nameAr: 'محوّل الوحدات',
  tagline: 'Length, mass, temperature, data, speed…',
  description:
    'Convert between units across eight categories — length, mass, temperature, data, area, volume, speed and time — live as you type, with a swap button and copy. Exact conversion tables (1 mile = 1.609344 km, 1 KiB = 1024 B); temperature handled with proper offsets.',
  category: 'Converters',
  keywords: ['unit', 'converter', 'cm to inches', 'kg to lb', 'celsius fahrenheit', 'km miles', 'وحدات', 'تحويل', 'محول'],
  status: 'stable',
  Icon: RulerIcon,
  component: lazyTool(() => import('./UnitConverterTool')),
  ar: {
    name: 'محوّل الوحدات',
    tagline: 'الطول والكتلة والحرارة والبيانات والسرعة…',
    description:
      'حوّل بين الوحدات في ثماني فئات — الطول والكتلة والحرارة والبيانات والمساحة والحجم والسرعة والزمن — مباشرةً أثناء الكتابة، مع زر تبديل ونسخ. جداول تحويل دقيقة، والحرارة بمعاملات إزاحة صحيحة.',
  },
}
