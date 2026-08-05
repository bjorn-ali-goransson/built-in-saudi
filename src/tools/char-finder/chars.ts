// A curated character set rather than the whole of Unicode. The full database is
// ~34MB of names; what people actually hunt for is a few hundred characters they
// cannot type — arrows, maths, currency, the Arabic marks, and the religious
// symbols that are genuinely hard to reach on any keyboard.

export type CharGroup = 'arabic' | 'punctuation' | 'currency' | 'maths' | 'arrows' | 'shapes' | 'symbols'

export const GROUPS: CharGroup[] = ['arabic', 'punctuation', 'currency', 'maths', 'arrows', 'shapes', 'symbols']

export interface Entry { char: string; code: number; name: string; group: CharGroup; keywords?: string }

const RAW: [string, string, CharGroup, string?][] = [
  // Arabic — the marks and ligatures people ask for by name.
  ['ﷺ', 'Arabic ligature sallallahou alayhe wasallam', 'arabic', 'pbuh peace be upon him salla'],
  ['ﷻ', 'Arabic ligature jallajalalouhou', 'arabic', 'jalla jalaluhu'],
  ['﷽', 'Arabic ligature bismillah', 'arabic', 'basmala bismillah'],
  ['ﷲ', 'Arabic ligature allah', 'arabic', 'allah'],
  ['؟', 'Arabic question mark', 'arabic', 'question'],
  ['،', 'Arabic comma', 'arabic', 'comma'],
  ['؛', 'Arabic semicolon', 'arabic', 'semicolon'],
  ['٪', 'Arabic percent sign', 'arabic', 'percent'],
  ['ـ', 'Arabic tatweel', 'arabic', 'kashida stretch'],
  ['ٰ', 'Arabic letter superscript alef', 'arabic', 'dagger alef'],
  ['ّ', 'Arabic shadda', 'arabic', 'shadda tashkeel'],
  ['ً', 'Arabic fathatan', 'arabic', 'tanween tashkeel'],
  ['ٍ', 'Arabic kasratan', 'arabic', 'tanween tashkeel'],
  ['ٌ', 'Arabic dammatan', 'arabic', 'tanween tashkeel'],
  ['ْ', 'Arabic sukun', 'arabic', 'sukoon tashkeel'],
  ['۩', 'Arabic place of sajdah', 'arabic', 'sajdah prostration quran'],
  ['۞', 'Arabic start of rub el hizb', 'arabic', 'hizb quran'],
  ['ﻻ', 'Arabic ligature lam with alef', 'arabic', 'lam alef'],
  ['ﹰ', 'Arabic fathatan isolated form', 'arabic'],
  // Punctuation.
  ['—', 'Em dash', 'punctuation', 'long dash'],
  ['–', 'En dash', 'punctuation', 'dash range'],
  ['…', 'Horizontal ellipsis', 'punctuation', 'dots ellipsis'],
  ['«', 'Left-pointing double angle quotation mark', 'punctuation', 'guillemet quote arabic'],
  ['»', 'Right-pointing double angle quotation mark', 'punctuation', 'guillemet quote arabic'],
  ['“', 'Left double quotation mark', 'punctuation', 'curly quote'],
  ['”', 'Right double quotation mark', 'punctuation', 'curly quote'],
  ['‘', 'Left single quotation mark', 'punctuation', 'curly apostrophe'],
  ['’', 'Right single quotation mark', 'punctuation', 'curly apostrophe'],
  ['·', 'Middle dot', 'punctuation', 'interpunct separator'],
  ['•', 'Bullet', 'punctuation', 'list bullet'],
  ['†', 'Dagger', 'punctuation', 'footnote'],
  ['‡', 'Double dagger', 'punctuation', 'footnote'],
  ['§', 'Section sign', 'punctuation', 'section legal'],
  ['¶', 'Pilcrow sign', 'punctuation', 'paragraph'],
  ['‰', 'Per mille sign', 'punctuation', 'permille thousand'],
  ['№', 'Numero sign', 'punctuation', 'number'],
  // Currency.
  ['﷼', 'Rial sign', 'currency', 'riyal saudi sar'],
  ['€', 'Euro sign', 'currency', 'euro'],
  ['£', 'Pound sign', 'currency', 'sterling'],
  ['¥', 'Yen sign', 'currency', 'yen yuan'],
  ['₹', 'Indian rupee sign', 'currency', 'rupee'],
  ['₽', 'Ruble sign', 'currency', 'ruble'],
  ['₺', 'Turkish lira sign', 'currency', 'lira'],
  ['¢', 'Cent sign', 'currency', 'cent'],
  ['¤', 'Currency sign', 'currency', 'generic currency'],
  // Maths.
  ['×', 'Multiplication sign', 'maths', 'times multiply'],
  ['÷', 'Division sign', 'maths', 'divide'],
  ['±', 'Plus-minus sign', 'maths', 'plus minus tolerance'],
  ['≈', 'Almost equal to', 'maths', 'approximately'],
  ['≠', 'Not equal to', 'maths', 'not equal'],
  ['≤', 'Less-than or equal to', 'maths', 'lte'],
  ['≥', 'Greater-than or equal to', 'maths', 'gte'],
  ['∞', 'Infinity', 'maths', 'infinite'],
  ['√', 'Square root', 'maths', 'sqrt root'],
  ['∑', 'N-ary summation', 'maths', 'sum sigma'],
  ['∏', 'N-ary product', 'maths', 'product pi'],
  ['∫', 'Integral', 'maths', 'integral'],
  ['π', 'Greek small letter pi', 'maths', 'pi'],
  ['µ', 'Micro sign', 'maths', 'micro'],
  ['°', 'Degree sign', 'maths', 'degree temperature'],
  ['′', 'Prime', 'maths', 'minutes feet'],
  ['″', 'Double prime', 'maths', 'seconds inches'],
  ['∅', 'Empty set', 'maths', 'empty null set'],
  ['∈', 'Element of', 'maths', 'member set'],
  // Arrows.
  ['→', 'Rightwards arrow', 'arrows', 'right arrow'],
  ['←', 'Leftwards arrow', 'arrows', 'left arrow'],
  ['↑', 'Upwards arrow', 'arrows', 'up arrow'],
  ['↓', 'Downwards arrow', 'arrows', 'down arrow'],
  ['↔', 'Left right arrow', 'arrows', 'both arrow'],
  ['⇒', 'Rightwards double arrow', 'arrows', 'implies double'],
  ['⇐', 'Leftwards double arrow', 'arrows', 'double'],
  ['⇔', 'Left right double arrow', 'arrows', 'iff equivalent'],
  ['↵', 'Downwards arrow with corner leftwards', 'arrows', 'enter return newline'],
  ['⏎', 'Return symbol', 'arrows', 'enter return'],
  ['➜', 'Heavy round-tipped rightwards arrow', 'arrows', 'arrow'],
  // Shapes.
  ['★', 'Black star', 'shapes', 'star filled favourite'],
  ['☆', 'White star', 'shapes', 'star outline'],
  ['●', 'Black circle', 'shapes', 'dot circle'],
  ['○', 'White circle', 'shapes', 'circle outline'],
  ['■', 'Black square', 'shapes', 'square'],
  ['□', 'White square', 'shapes', 'square outline'],
  ['▲', 'Black up-pointing triangle', 'shapes', 'triangle up'],
  ['▼', 'Black down-pointing triangle', 'shapes', 'triangle down'],
  ['◆', 'Black diamond', 'shapes', 'diamond'],
  ['❤', 'Heavy black heart', 'shapes', 'heart love'],
  ['♥', 'Black heart suit', 'shapes', 'heart love card'],
  ['✦', 'Black four-pointed star', 'shapes', 'sparkle star'],
  // Symbols.
  ['✓', 'Check mark', 'symbols', 'tick check yes done'],
  ['✔', 'Heavy check mark', 'symbols', 'tick check yes done'],
  ['✗', 'Ballot X', 'symbols', 'cross no wrong'],
  ['✘', 'Heavy ballot X', 'symbols', 'cross no wrong'],
  ['©', 'Copyright sign', 'symbols', 'copyright'],
  ['®', 'Registered sign', 'symbols', 'registered trademark'],
  ['™', 'Trade mark sign', 'symbols', 'trademark'],
  ['☎', 'Black telephone', 'symbols', 'phone telephone'],
  ['✉', 'Envelope', 'symbols', 'email mail'],
  ['⌘', 'Place of interest sign', 'symbols', 'command mac cmd'],
  ['⌥', 'Option key', 'symbols', 'option alt mac'],
  ['⇧', 'Upwards white arrow', 'symbols', 'shift key'],
  ['⌫', 'Erase to the left', 'symbols', 'backspace delete'],
  ['␣', 'Open box', 'symbols', 'space blank'],
  ['⚠', 'Warning sign', 'symbols', 'warning caution'],
  ['☮', 'Peace symbol', 'symbols', 'peace'],
  ['⏳', 'Hourglass with flowing sand', 'symbols', 'time waiting'],
  ['⚡', 'High voltage sign', 'symbols', 'lightning power'],
]

export const CHARS: Entry[] = RAW.map(([char, name, group, keywords]) => ({
  char, name, group, keywords, code: char.codePointAt(0)!,
}))

export function search(query: string, group: CharGroup | 'all'): Entry[] {
  const pool = group === 'all' ? CHARS : CHARS.filter((c) => c.group === group)
  const q = query.trim().toLowerCase()
  if (!q) return pool
  // Pasting the character itself should find it — that is how people arrive
  // here from a document they do not understand.
  const direct = pool.filter((c) => c.char === query.trim())
  if (direct.length) return direct
  return pool.filter((c) =>
    c.name.toLowerCase().includes(q) || (c.keywords ?? '').includes(q))
}

export interface Described { char: string; code: number; name: string; utf8: string; printable: boolean }

export function describeChar(char: string): Described {
  const code = char.codePointAt(0)!
  const known = CHARS.find((c) => c.code === code)
  const bytes = [...new TextEncoder().encode(char)].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ')
  const printable = !(code < 32 || (code >= 0x7f && code <= 0x9f) || code === 0x200b || code === 0xfeff)
  return { char, code, utf8: bytes, printable, name: known?.name ?? guessName(code) }
}

/** A block name when the exact character is not in the curated list — more use
 *  than "unknown", and honest about being a range rather than a name. */
function guessName(code: number): string {
  const blocks: [number, number, string][] = [
    [0x0000, 0x001f, 'Control character'],
    [0x0020, 0x007e, 'Basic Latin'],
    [0x0080, 0x00ff, 'Latin-1 Supplement'],
    [0x0100, 0x024f, 'Latin Extended'],
    [0x0370, 0x03ff, 'Greek'],
    [0x0400, 0x04ff, 'Cyrillic'],
    [0x0590, 0x05ff, 'Hebrew'],
    [0x0600, 0x06ff, 'Arabic'],
    [0x0750, 0x077f, 'Arabic Supplement'],
    [0x08a0, 0x08ff, 'Arabic Extended-A'],
    [0x2000, 0x206f, 'General Punctuation'],
    [0x20a0, 0x20cf, 'Currency Symbols'],
    [0x2190, 0x21ff, 'Arrows'],
    [0x2200, 0x22ff, 'Mathematical Operators'],
    [0x2600, 0x26ff, 'Miscellaneous Symbols'],
    [0x2700, 0x27bf, 'Dingbats'],
    [0xfb50, 0xfdff, 'Arabic Presentation Forms-A'],
    [0xfe70, 0xfeff, 'Arabic Presentation Forms-B'],
    [0x1f300, 0x1f5ff, 'Miscellaneous Symbols and Pictographs'],
    [0x1f600, 0x1f64f, 'Emoticons'],
    [0x1f900, 0x1f9ff, 'Supplemental Symbols and Pictographs'],
  ]
  for (const [from, to, name] of blocks) if (code >= from && code <= to) return name
  return 'Unnamed character'
}
