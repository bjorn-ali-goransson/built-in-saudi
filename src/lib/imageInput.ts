// Shared handling for "the user picked a file we can't open" across the image tools
// (#225). Two Android realities drive all of this:
//
//  1. HEIC (and occasionally other files) arrive with an EMPTY or non-image MIME, so
//     any `f.type.startsWith('image/')` guard drops them without a word.
//  2. An image `accept` on the input makes Chrome open the gallery picker, which
//     lists only MediaStore-indexed media — a file in Downloads is never offered. So
//     the inputs carry no `accept` at all, which is only safe because a bad pick now
//     reports why.
//
// Keep the copy here rather than in each tool's STR block: eight tools repeating the
// same two sentences is eight chances for them to drift.

/** Is this a HEIC/HEIF file? Read the ISO-BMFF brand from the bytes rather than
 *  trusting the MIME type, which Android frequently doesn't set. */
export async function isHeic(f: File): Promise<boolean> {
  try {
    const b = new Uint8Array(await f.slice(0, 12).arrayBuffer())
    if (String.fromCharCode(...b.slice(4, 8)) !== 'ftyp') return false
    const brand = String.fromCharCode(...b.slice(8, 12))
    return ['heic', 'heix', 'hevc', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1'].includes(brand)
  } catch { return false }
}

const MSG = {
  en: {
    cantRead: 'Couldn’t read that file. It may be damaged, or in a format this browser can’t open.',
    heic: 'This HEIC photo couldn’t be read. It may be damaged, or use an encoding we can’t decode — try sharing it from Photos, which usually converts it to JPG.',
  },
  ar: {
    cantRead: 'تعذّرت قراءة الملف. قد يكون تالفًا أو بصيغة لا يفتحها هذا المتصفح.',
    heic: 'تعذّرت قراءة صورة HEIC هذه. قد تكون تالفة أو بترميز لا نستطيع فكّه — جرّب مشاركتها من تطبيق الصور، فذلك يحوّلها عادةً إلى JPG.',
  },
}

/** Why couldn't we open this file? HEIC IS decodable now (#226) — reaching this with
 *  a HEIC means the file itself is bad, not that the format is unsupported, so the
 *  message must not blame the browser. */
export async function whyUnreadable(f: File, locale: 'en' | 'ar'): Promise<string> {
  return (await isHeic(f)) ? MSG[locale].heic : MSG[locale].cantRead
}
