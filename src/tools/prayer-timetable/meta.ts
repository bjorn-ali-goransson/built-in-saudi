import { lazyTool } from '../../lib/lazyTool'
import type { Tool } from '../types'
import { MosqueIcon } from '../../components/icons'

export const prayerTimetableTool: Tool = {
  id: 'prayer-timetable',
  name: 'Monthly Prayer Timetable',
  nameAr: 'تقويم مواقيت الصلاة',
  tagline: 'A month of prayer times on one printable sheet.',
  description:
    'Print a whole month of prayer times for any Saudi city — Fajr through Isha, with Hijri dates alongside and Fridays shaded so the sheet can be read from across a room. For a fridge, a noticeboard or a mosque door. Calculated on your device with the Umm al-Qura method, the same one the Prayer Times app here uses, so the two never disagree.',
  category: 'Islamic',
  keywords: [
    'prayer', 'times', 'timetable', 'calendar', 'month', 'salah', 'fajr', 'maghrib', 'printable', 'mosque', 'hijri', 'imsakiya',
    'مواقيت', 'الصلاة', 'تقويم', 'شهر', 'إمساكية', 'الفجر', 'المغرب', 'طباعة', 'مسجد', 'هجري',
  ],
  status: 'stable',
  Icon: MosqueIcon,
  component: lazyTool(() => import('./PrayerTimetableTool')),
  ar: {
    name: 'تقويم مواقيت الصلاة',
    tagline: 'شهر كامل من المواقيت في ورقة واحدة.',
    description:
      'اطبع شهرًا كاملًا من مواقيت الصلاة لأي مدينة سعودية — من الفجر إلى العشاء، مع التواريخ الهجرية بجانبها وتظليل أيام الجمعة ليمكن قراءة الورقة من بعيد. للثلاجة أو لوحة الإعلانات أو باب المسجد. تُحسب على جهازك بطريقة أم القرى، وهي نفسها التي يستخدمها تطبيق مواقيت الصلاة هنا، فلا يختلف الاثنان.',
  },
}
