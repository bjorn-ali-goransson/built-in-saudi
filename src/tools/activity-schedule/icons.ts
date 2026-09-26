// Picking the icon so that mostly nobody has to.
//
// An emoji here is CONTENT, not chrome: the sheet is pinned at child height
// and the icon is what a four-year-old who cannot yet read the word «رياضيات»
// uses to find their place in the day. That is the same exception the
// reactions palette gets, and it is why this file exists at all rather than
// the tool reaching for the icon components everything else on the site uses —
// those are a fixed set drawn in one ink, and this needs a hundred distinct,
// instantly recognisable pictures that survive being printed.
//
// Three sources, in order:
//
//   1. what this person chose for this activity before — across every schedule
//      they have saved, not just the open one;
//   2. a guess from the words in the name;
//   3. nothing, and the cell simply carries no icon.
//
// The order matters more than the table does. A guess that overrules a choice
// is a tool arguing with somebody about their own wall chart, and a tool that
// forgets what you picked last week makes you pick it again every week.

import { nameKey } from './schedule'

/** The palette offered in the picker, grouped so it can be scanned. */
export const PALETTE: Array<{ group: string; groupAr: string; icons: string[] }> = [
  {
    group: 'Lessons', groupAr: 'الدروس',
    icons: ['📖', '📕', '📗', '📘', '📚', '✏️', '🖊️', '📝', '🔤', '🔢', '➕', '🧮', '🔬', '🧪', '🌍', '🗺️', '🕰️', '💻', '🧠'],
  },
  {
    group: 'Faith', groupAr: 'العبادة',
    icons: ['🕌', '🕋', '📿', '🤲', '🌙', '⭐', '🧕', '🕊️'],
  },
  {
    group: 'Play and art', groupAr: 'اللعب والفن',
    icons: ['🧩', '🧱', '🎨', '🖍️', '✂️', '🎭', '🎵', '🎹', '🥁', '⚽', '🏀', '🏐', '🤸', '🪁', '🧸', '🎲', '🎪'],
  },
  {
    group: 'Day', groupAr: 'اليوم',
    icons: ['🍎', '🥪', '🥛', '🍽️', '🚻', '😴', '🚌', '🏠', '🏫', '🔔', '🧹', '🪥', '🧼', '☀️', '🌳', '🧺'],
  },
  {
    group: 'Work', groupAr: 'العمل',
    icons: ['💼', '📊', '📈', '📞', '📧', '🗓️', '👥', '🎯', '⏰', '✅', '🛠️', '🚗'],
  },
]

export const ALL_ICONS: string[] = PALETTE.flatMap((g) => g.icons)

/**
 * Words that suggest a picture, in both languages.
 *
 * Arabic is matched on the same folded key the rest of the tool uses, so the
 * definite article and the harakāt do not have to be repeated in every entry —
 * `nameKey` has already taken «القرآن» to «قران» by the time this runs. That
 * is the trap this repo has recorded four times: «قرآن» is not a substring of
 * «القرآن», so a raw table would miss the commonest spelling of half of these.
 */
const GUESS: Array<[string, string[]]> = [
  ['📖', ['quran', 'قران', 'تلاوه', 'حفظ', 'تجويد', 'تبيان', 'recitation']],
  ['🕌', ['prayer', 'صلاه', 'salah', 'مسجد', 'وضوء']],
  ['📿', ['athkar', 'اذكار', 'ذكر', 'dhikr', 'دعاء', 'ادعيه']],
  ['🕋', ['hajj', 'حج', 'عمره', 'umrah', 'سيره', 'seerah']],
  ['🔤', ['english', 'انجليزي', 'انقلش', 'alphabet', 'حروف', 'letters', 'spelling', 'املاء']],
  ['🔢', ['math', 'رياضيات', 'حساب', 'numbers', 'ارقام', 'عدد', 'جمع', 'طرح', 'counting']],
  ['📝', ['arabic', 'عربي', 'لغتي', 'كتابه', 'writing', 'خط', 'انشاء', 'تعبير']],
  ['🔬', ['science', 'علوم', 'تجربه', 'experiment']],
  ['🌍', ['geography', 'جغرافيا', 'اجتماعيات', 'social', 'وطني', 'تاريخ', 'history']],
  ['💻', ['computer', 'حاسب', 'برمجه', 'coding', 'تقنيه', 'digital']],
  ['🎨', ['art', 'فن', 'رسم', 'drawing', 'تلوين', 'colour', 'color']],
  ['🎵', ['music', 'موسيقى', 'نشيد', 'اناشيد', 'انشوده', 'song', 'singing', 'غناء']],
  ['⚽', ['sport', 'رياضه بدنيه', 'بدنيه', 'pe', 'football', 'كره', 'ملعب', 'gym']],
  ['🤸', ['exercise', 'حركه', 'تمارين', 'نشاط حركي', 'movement']],
  ['🧩', ['puzzle', 'الغاز', 'تركيب', 'ذكاء']],
  ['🧱', ['blocks', 'اركان', 'مكعبات', 'بناء', 'centres', 'centers', 'corners', 'stations']],
  ['🎲', ['free play', 'لعب حر', 'لعب', 'play', 'العاب', 'game', 'ترفيه']],
  ['🍎', ['snack', 'وجبه', 'فطور', 'breakfast', 'افطار', 'اكل', 'طعام', 'lunch', 'غداء', 'فاكهه']],
  ['🥛', ['milk', 'حليب', 'عصير', 'juice', 'ماء', 'water', 'شرب']],
  ['🚻', ['toilet', 'دوره المياه', 'حمام', 'bathroom', 'نظافه شخصيه']],
  ['🪥', ['brush', 'اسنان', 'teeth', 'غسيل']],
  ['😴', ['nap', 'نوم', 'قيلوله', 'راحه', 'rest', 'sleep', 'استراحه', 'break', 'فسحه']],
  ['🔔', ['assembly', 'طابور', 'اصطفاف', 'تجمع', 'صباح', 'morning', 'lineup']],
  ['🏠', ['home', 'انصراف', 'مغادره', 'dismissal', 'خروج', 'نهايه', 'end', 'بيت']],
  ['🚌', ['bus', 'باص', 'حافله', 'نقل', 'transport']],
  ['🏫', ['school', 'مدرسه', 'حضور', 'وصول', 'arrival', 'دوام']],
  ['📚', ['review', 'مراجعه', 'revision', 'study', 'مذاكره', 'واجب', 'homework', 'reading', 'قراءه', 'مكتبه', 'library']],
  ['🧸', ['story', 'قصه', 'حكايه', 'ركن القراءه']],
  ['🌳', ['outdoor', 'ساحه', 'حديقه', 'خارجي', 'garden', 'رحله', 'trip']],
  ['🧹', ['tidy', 'ترتيب', 'نظافه', 'clean']],
  ['📞', ['call', 'اتصال', 'مكالمه', 'meeting', 'اجتماع']],
  ['💼', ['work', 'عمل', 'مهام', 'tasks', 'شغل']],
  ['📧', ['email', 'ايميل', 'بريد', 'رسائل']],
  ['⏰', ['deadline', 'موعد', 'تسليم', 'appointment']],
  ['🎯', ['goal', 'هدف', 'تركيز', 'focus']],
  ['🚗', ['drive', 'قياده', 'طريق', 'commute', 'مشوار']],
]

/**
 * A picture for a name nobody has picked one for yet.
 *
 * Longest keyword first, so «رياضه بدنيه» beats «رياضيات» rather than
 * whichever happened to be written higher up the table. A keyword must be
 * contained in the folded name — not the other way round — so a name is
 * allowed to be longer and more specific than the word that identifies it.
 */
export function guessIcon(name: string): string {
  const key = nameKey(name)
  if (!key) return ''
  let best = ''
  let len = 0
  for (const [icon, words] of GUESS) {
    for (const w of words) {
      if (w.length > len && key.includes(w)) { best = icon; len = w.length }
    }
  }
  return best
}

// --- what this person has picked before ------------------------------------

const KEY = 'bis-schedule-icons'

export type IconMemory = Record<string, string>

export function loadIconMemory(): IconMemory {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? JSON.parse(raw) : null
    return v && typeof v === 'object' ? (v as IconMemory) : {}
  } catch { return {} }
}

export function rememberIcon(name: string, icon: string): IconMemory {
  const key = nameKey(name)
  const mem = loadIconMemory()
  if (!key) return mem
  if (icon) mem[key] = icon
  else delete mem[key]
  try { localStorage.setItem(KEY, JSON.stringify(mem)) } catch { /* ignore */ }
  return mem
}

/**
 * The icon a name should carry: remembered first, guessed second.
 *
 * Remembered wins on purpose. The guess table is a convenience for a name
 * nobody has ruled on; once somebody has chosen, overruling them is the tool
 * arguing about their own sheet.
 */
export function iconFor(name: string, mem: IconMemory): string {
  return mem[nameKey(name)] || guessIcon(name)
}
