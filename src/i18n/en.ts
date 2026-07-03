// English dictionary — the source of truth for the translation shape.
// `ar.ts` must match this type exactly (enforced by `Dict`).

export const en = {
  dir: 'ltr' as 'ltr' | 'rtl',
  nav: { tools: 'Tools', source: 'Source' },

  hero: {
    kicker: 'BUILT IN SAUDI',
    title1: 'Sharp little tools.',
    title2: 'No ads. No catch.',
    lede:
      'The everyday utilities you keep googling — QR codes, converters, generators — gathered into one honest toolbox. Free, fast, and private: nothing is uploaded, everything runs in your browser.',
    badgeDevice: 'Runs on your device',
    badgeNoAds: 'No sign-up, no ads',
    badgeOpen: 'Open source',
  },

  catalog: {
    title: 'The toolbox',
    count: (live: number, soon: number) => `${live} live · ${soon} on the way`,
    searchPlaceholder: 'Search tools — try “wifi”, “pdf”, “convert”…',
    searchAria: 'Search tools',
    clear: 'Clear search',
    empty: (q: string) => `No tools match “${q}” yet — but the toolbox is growing.`,
  },

  card: { comingSoon: 'Coming soon', beta: 'Beta', open: 'Open' },

  toolPage: { breadcrumb: 'Tools' },

  footer: {
    ethos:
      'Free & open. Your data never leaves your device — every tool runs entirely in your browser.',
    made: 'Made with care in the Kingdom of Saudi Arabia',
    allTools: 'All apps',
    github: 'GitHub',
    reportIssue: 'Report an issue',
  },

  notif: {
    title: 'Say hello 👋',
    message:
      'New tools just landed — Prayer Times, a Password Generator and a QR code maker. All free, all private. More on the way.',
    open: 'Open announcement',
    minimize: 'Minimize announcement',
    dismiss: 'Dismiss announcement',
  },

  notFound: {
    code: '404',
    title: 'Nothing here',
    body: 'That page could not be found. It may have moved, or never existed.',
    soonCode: 'SOON',
    soonTitle: (tool: string) => `${tool} is on the way`,
    soonBody:
      'This tool is on the roadmap and being built. Check back soon — or explore the ones that are ready today.',
    back: 'Back to the toolbox',
  },

  // Shown to a user whose browser prefers THIS language but who landed on the other.
  langSuggest: {
    message: 'This site is available in English. Switch?',
    switch: 'Switch to English',
    dismiss: 'Not now',
  },
  languageName: 'English',
  switchLanguage: 'العربية', // label to switch TO the other language, shown in that language

  qr: {
    types: { link: 'Link', text: 'Text', wifi: 'Wi-Fi', email: 'Email', phone: 'Phone' },
    fieldUrl: 'Website / URL',
    fieldText: 'Text',
    fieldSsid: 'Network name (SSID)',
    fieldPassword: 'Password',
    fieldSecurity: 'Security',
    secWpa: 'WPA / WPA2 / WPA3',
    secWep: 'WEP',
    secNone: 'None (open)',
    hidden: 'Hidden network',
    fieldTo: 'To',
    fieldSubject: 'Subject',
    fieldMessage: 'Message',
    fieldPhone: 'Phone number',
    style: 'Style',
    errorCorrection: 'Error correction',
    exportSize: 'Export size',
    quietZone: 'Quiet zone',
    foreground: 'Foreground',
    background: 'Background',
    png: 'PNG',
    svg: 'SVG',
    copy: 'Copy',
    copied: 'Copied!',
    encodes: 'Encodes',
    empty: 'Fill in the fields to generate your QR code.',
    privacy: 'Generated locally — nothing is uploaded.',
    copyUnsupported: 'Copying images isn’t supported in this browser — use Download instead.',
    share: 'Share',
    download: 'Download',
    advanced: 'Advanced settings',
    type: 'Type',
    size: 'Size',
    sizeSmall: 'Small',
    sizeMedium: 'Medium',
    sizeLarge: 'Large',
    sizeHD: 'Super Extra HD',
    sizeCustom: 'Custom',
    theme: 'Theme',
    randomTheme: 'Surprise me',
    dotStyle: 'Pattern',
    frame: 'Frame',
    logo: 'Logo in the middle',
    addLogo: 'Add image',
    removeLogo: 'Remove',
    dots: { square: 'Square', dots: 'Circles', rounded: 'Rounded', cube: '3D cubes', liquid: 'Liquid' },
    placeholderUrl: 'example.com',
    placeholderText: 'Any text to encode…',
    placeholderSsid: 'MyNetwork',
    placeholderEmail: 'name@example.com',
    placeholderPhone: '+966 5X XXX XXXX',
  },
}

export type Dict = typeof en
